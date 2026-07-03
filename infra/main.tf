# Infrastructure-as-code skeleton (portability §8, ADR: VPC-parity deployment).
# Validated by `terraform validate` in CI (no backend). This is a closed-VPC posture:
# the service runs in private subnets; Bedrock is reached via a VPC endpoint; nothing
# stores PII, so there is no database and no user-data bucket by design.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for the deployment."
}

variable "bedrock_model_id" {
  type        = string
  default     = "anthropic.claude-3-5-haiku-20241022-v1:0"
  description = "Bedrock model id for grounded generation (Haiku-first per ROADMAP §6)."
}

provider "aws" {
  region = var.region
}

# Closed VPC: private subnets only for the app; no public ingress except via the ALB.
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "trans-docs-navigator", PII = "none" }
}

# App private subnet — NO route to an Internet Gateway or NAT Gateway (FIX-09 §B,
# zero-egress runtime). This is the network-layer half of the egress-denial posture:
# even if a security-group rule were ever misconfigured, there is no path off this
# subnet to the public internet at all. The route table below carries only the VPC's
# implicit local route; the ONLY way out is the Bedrock interface VPC endpoint's ENI,
# which resolves via VPC-internal DNS and never touches an IGW/NAT route.
resource "aws_subnet" "app_private" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.region}a"
  tags              = { Name = "trans-docs-navigator-app-private", PII = "none" }
}

# No `route` block here is deliberate: no aws_internet_gateway, no aws_nat_gateway —
# neither resource is declared anywhere in this configuration, so there is nothing for
# this table to route toward except the VPC's own local CIDR. Local-only.
resource "aws_route_table" "app_private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "trans-docs-navigator-app-private-rt" }
}

resource "aws_route_table_association" "app_private" {
  subnet_id      = aws_subnet.app_private.id
  route_table_id = aws_route_table.app_private.id
}

# ── Security groups (FIX-09 §B: deny-all egress by default) ────────────────────────
# The ALB is the only internet-facing ingress. Its egress is scoped to the app subnet
# CIDR (not a security-group cross-reference, to avoid a dependency cycle with the app
# SG below) rather than left open to 0.0.0.0/0.
resource "aws_security_group" "alb" {
  name        = "trans-docs-navigator-alb"
  description = "Public ALB. Ingress: internet on 443. Egress: the app subnet only."
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from the internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Forward to the app service in the private subnet only"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [aws_subnet.app_private.cidr_block]
  }

  tags = { Name = "trans-docs-navigator-alb", PII = "none" }
}

# The service. Deliberately NO inline `egress` block: Terraform manages a security
# group's rule set declaratively, so omitting egress here removes AWS's automatic
# "allow all outbound" default rather than merely failing to add to it — the app SG
# denies ALL egress by default. The one exception (Bedrock) is the pair of
# aws_security_group_rule resources below, kept out-of-line to avoid the mutual-SG-
# reference dependency cycle that inline cross-referencing rules would create.
resource "aws_security_group" "app" {
  name        = "trans-docs-navigator-app"
  description = "The service. Ingress from the ALB only. NO egress by default (deny-all) - see the scoped Bedrock exception below."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP from the ALB only"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  tags = { Name = "trans-docs-navigator-app", PII = "none" }
}

# VPC endpoint security group: attached to the Bedrock interface endpoint's ENI.
# Its own ingress is scoped to the app SG (added as a standalone rule below), so
# nothing but the app can reach Bedrock through it either.
resource "aws_security_group" "bedrock_endpoint" {
  name        = "trans-docs-navigator-bedrock-endpoint"
  description = "Attached to the Bedrock interface VPC endpoint. Reachable only from the app SG."
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "trans-docs-navigator-bedrock-endpoint", PII = "none" }
}

# The ONE scoped egress path out of the app SG: HTTPS to the Bedrock endpoint SG, and
# nothing else. Declared as aws_security_group_rule (not inline on either group) so
# the two SGs can reference each other's id without Terraform seeing a dependency cycle
# between the two aws_security_group resources themselves.
resource "aws_security_group_rule" "app_egress_bedrock" {
  type                     = "egress"
  description              = "Bedrock invoke traffic - the only egress the app SG allows"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  security_group_id        = aws_security_group.app.id
  source_security_group_id = aws_security_group.bedrock_endpoint.id
}

resource "aws_security_group_rule" "bedrock_endpoint_ingress_app" {
  type                     = "ingress"
  description              = "Only the app SG may reach the Bedrock endpoint"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  security_group_id        = aws_security_group.bedrock_endpoint.id
  source_security_group_id = aws_security_group.app.id
}

# VPC endpoint so generation traffic to Bedrock never traverses the public internet.
# Bound to the app's private subnet and the scoped endpoint SG above.
resource "aws_vpc_endpoint" "bedrock" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.bedrock-runtime"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.app_private.id]
  security_group_ids  = [aws_security_group.bedrock_endpoint.id]
  private_dns_enabled = true
}

# Least-privilege task role: invoke Bedrock only. No S3/DynamoDB — there is no PII to store.
data "aws_iam_policy_document" "task" {
  statement {
    sid       = "InvokeBedrock"
    actions   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
    resources = ["arn:aws:bedrock:${var.region}::foundation-model/${var.bedrock_model_id}"]
  }
}

resource "aws_iam_policy" "task" {
  name   = "trans-docs-navigator-task"
  policy = data.aws_iam_policy_document.task.json
}

output "vpc_id" {
  value = aws_vpc.main.id
}

# --- D5 / Phase 5.1: Edge rate-limiter/WAF ----------------------------------------
# Fronts the deployment with a coarse, IP-aggregated rate limit at the edge, above the
# in-process per-IP limiter in `api/server.ts` (120 req/min ≈ 600 req/5min) — WAF is
# the blunt outer bound; the in-process limiter stays the finer-grained one. Empty
# `alb_arn` default + `count` guard on the association keep this credential-free and
# deploy-optional so `terraform validate`/`fmt -check` pass without a real ALB.

variable "alb_arn" {
  type        = string
  default     = ""
  description = "ARN of the app ALB to protect with the edge WAF. Empty by default so `terraform validate` passes without a real ALB; the web ACL association is skipped (count = 0) until this is set."
}

resource "aws_wafv2_web_acl" "edge" {
  name        = "trans-docs-navigator-edge"
  description = "Coarse edge rate limiter in front of the ALB (D5 / Phase 5.1)."
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit-per-ip"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        aggregate_key_type = "IP"
        # Per 5-minute evaluation window; comfortably above the in-process 600/5min
        # equivalent so WAF only trips on abuse the app-level limiter didn't catch.
        limit = 1200
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      sampled_requests_enabled   = true
      metric_name                = "trans-docs-navigator-rate-limit"
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    sampled_requests_enabled   = true
    metric_name                = "trans-docs-navigator-edge"
  }

  tags = { Name = "trans-docs-navigator-edge", PII = "none" }
}

resource "aws_wafv2_web_acl_association" "edge" {
  count = var.alb_arn == "" ? 0 : 1

  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.edge.arn
}

# --- D5 / Phase 5.1: metrics backend + OPERATIONS.md alarm wiring ------------------
# Routes the existing non-PII structured events (`api/log.ts` safeLog) to CloudWatch
# metric filters and alarms, matching the "Alarms -> actions" table in
# docs/OPERATIONS.md. `alarm_sns_topic_arn` defaults to "" so no external SNS/paid
# dependency is required to validate; alarms simply have no action wired until set.

variable "metrics_namespace" {
  type        = string
  default     = "TransDocsNavigator"
  description = "CloudWatch namespace for metric filters derived from safeLog events (api/log.ts)."
}

variable "alarm_sns_topic_arn" {
  type        = string
  default     = ""
  description = "SNS topic ARN notified by the OPERATIONS.md alarms below. Empty by default — no external SNS/paid dependency required to validate."
}

# Log group the app writes its safeLog JSON lines to. No PII by construction
# (api/log.ts allowlists only non-PII fields; enforced by `make privacy`).
resource "aws_cloudwatch_log_group" "app" {
  name              = "/trans-docs-navigator/app"
  retention_in_days = 30
  tags              = { PII = "none" }
}

# rate_limited -> Rate429Count. Abuse visibility for the in-process/edge limiters.
resource "aws_cloudwatch_log_metric_filter" "rate_limited" {
  name           = "trans-docs-navigator-rate-limited"
  log_group_name = aws_cloudwatch_log_group.app.name
  pattern        = "{ $.event = \"rate_limited\" }"

  metric_transformation {
    name          = "Rate429Count"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

# error + status 500 -> ServerErrorCount. OPERATIONS.md: "Citation gate throws at
# runtime (500s spike)" — a 500 here is the citation gate working, not a bug.
resource "aws_cloudwatch_log_metric_filter" "server_error" {
  name           = "trans-docs-navigator-server-error"
  log_group_name = aws_cloudwatch_log_group.app.name
  pattern        = "{ $.event = \"error\" && $.status = 500 }"

  metric_transformation {
    name          = "ServerErrorCount"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

# corpus_quarantine with quarantined > 0 -> CorpusQuarantineCount. OPERATIONS.md:
# "A malformed record shipped; the server dropped it (fail-degraded)."
resource "aws_cloudwatch_log_metric_filter" "corpus_quarantine" {
  name           = "trans-docs-navigator-corpus-quarantine"
  log_group_name = aws_cloudwatch_log_group.app.name
  pattern        = "{ $.event = \"corpus_quarantine\" && $.quarantined > 0 }"

  metric_transformation {
    name          = "CorpusQuarantineCount"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

# answer with degraded true -> DegradedAnswerCount. OPERATIONS.md: "Users are hitting
# stale/volatile records surfaced as 'needs reverification'."
resource "aws_cloudwatch_log_metric_filter" "degraded_answer" {
  name           = "trans-docs-navigator-degraded-answer"
  log_group_name = aws_cloudwatch_log_group.app.name
  pattern        = "{ $.event = \"answer\" && $.degraded IS TRUE }"

  metric_transformation {
    name          = "DegradedAnswerCount"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_metric_alarm" "server_error_spike" {
  alarm_name          = "trans-docs-navigator-500s-spike"
  alarm_description   = "OPERATIONS.md 'Citation gate throws at runtime (500s spike)': roll back the generator/corpus change that produced an uncited claim."
  namespace           = var.metrics_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.server_error.metric_transformation[0].name
  comparison_operator = "GreaterThanThreshold"
  threshold           = 5
  evaluation_periods  = 1
  period              = 300
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arn == "" ? [] : [var.alarm_sns_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "corpus_quarantine" {
  alarm_name          = "trans-docs-navigator-corpus-quarantine"
  alarm_description   = "OPERATIONS.md 'corpus_quarantine log at startup (quarantined > 0)': inspect the bad record named by CI `make content`, fix or revert it, redeploy."
  namespace           = var.metrics_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.corpus_quarantine.metric_transformation[0].name
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1
  period              = 300
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arn == "" ? [] : [var.alarm_sns_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "degraded_answer_spike" {
  alarm_name          = "trans-docs-navigator-degraded-answer-spike"
  alarm_description   = "OPERATIONS.md 'answer logs degraded: true spiking': check whether a record fell past its freshness SLA and reverify it."
  namespace           = var.metrics_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.degraded_answer.metric_transformation[0].name
  comparison_operator = "GreaterThanThreshold"
  threshold           = 20
  evaluation_periods  = 1
  period              = 300
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arn == "" ? [] : [var.alarm_sns_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "rate_limited_spike" {
  alarm_name          = "trans-docs-navigator-rate-limited-spike"
  alarm_description   = "Abuse visibility: sustained 429s from the in-process/edge rate limiters."
  namespace           = var.metrics_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.rate_limited.metric_transformation[0].name
  comparison_operator = "GreaterThanThreshold"
  threshold           = 100
  evaluation_periods  = 1
  period              = 60
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arn == "" ? [] : [var.alarm_sns_topic_arn]
}

output "app_security_group_id" {
  description = "Deny-all-egress SG for the service (FIX-09 §B) — attach to the ECS/Fargate task or EC2 instances."
  value       = aws_security_group.app.id
}

output "app_private_subnet_id" {
  description = "Private subnet with no IGW/NAT route — the app's only network home."
  value       = aws_subnet.app_private.id
}
