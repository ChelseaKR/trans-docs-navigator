# Cost-light AWS preview (docs/DEPLOY-AWS-PREVIEW.md).
#
# Architecture chosen for COST GUARDRAILS, not production parity:
#   • Lambda (container image) behind a public Function URL — scale-to-zero, billed per
#     request. No ALB, no Fargate, no NAT gateway, so an idle preview costs ~$0.
#   • Reserved concurrency cap bounds the maximum cost rate of any traffic spike.
#   • An AWS Budget alerts (and is the hard tripwire) if monthly cost ever crosses a
#     small threshold — the architecture should otherwise sit at or near $0.
#   • No VPC: the preview runs the deterministic composer (Bedrock OFF), so it needs no
#     Bedrock VPC endpoint and no private networking. The production posture in
#     ../main.tf is the closed-VPC path for when content is launch-cleared.
#   • CloudWatch log retention is bounded so logs can't accrue storage cost.
#
# Deploy is OIDC-based (no long-lived keys) and manual (workflow_dispatch), so nothing
# bills until you deliberately deploy. Tear down with `terraform destroy` → back to $0.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      project = "trans-docs-navigator"
      stack   = "preview"
      PII     = "none"
    }
  }
}

data "aws_caller_identity" "current" {}

# ── Container registry ─────────────────────────────────────────────────────────
resource "aws_ecr_repository" "app" {
  name = "trans-docs-navigator"
  # Immutable tags: a pushed tag can't be overwritten, so a deployed image can't be
  # swapped under you. CD pushes one immutable tag per commit (the git SHA).
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true # preview: allow `terraform destroy` to remove images too
  image_scanning_configuration {
    scan_on_push = true
  }
}

# Keep only the few most recent images so registry storage can't creep.
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 5 }
      action       = { type = "expire" }
    }]
  })
}

# ── Lambda execution role (least privilege: write its own logs, nothing else) ───
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "tdn-preview-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# X-Ray write access for the tracing enabled on the function below.
resource "aws_iam_role_policy_attachment" "lambda_xray" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# Bounded log retention → no unbounded CloudWatch storage cost.
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/trans-docs-navigator-preview"
  retention_in_days = 14
}

# ── The function ───────────────────────────────────────────────────────────────
resource "aws_lambda_function" "app" {
  function_name = "trans-docs-navigator-preview"
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
  memory_size   = var.lambda_memory_mb
  timeout       = 30

  # Cost guardrail: cap concurrent executions so a spike can't run up the bill.
  reserved_concurrent_executions = var.max_concurrency

  # End-to-end tracing. Demo traffic stays within the X-Ray free tier (100k traces/mo).
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      NODE_ENV                     = "production"
      AWS_LWA_READINESS_CHECK_PATH = "/healthz"
      # SITE_ORIGIN is set by the deploy workflow once the Function URL exists, so
      # canonical/OG/sitemap match the real preview address.
    }
  }

  # CD updates the image out of band (aws lambda update-function-code); don't fight it.
  lifecycle {
    ignore_changes = [image_uri, environment]
  }

  depends_on = [aws_cloudwatch_log_group.lambda]
}

# Public URL — this is a public demo, so no auth. Abuse is bounded by the in-app rate
# limit and the reserved-concurrency cap above.
resource "aws_lambda_function_url" "app" {
  function_name      = aws_lambda_function.app.function_name
  authorization_type = "NONE"
}

# ── Cost tripwire ──────────────────────────────────────────────────────────────
resource "aws_budgets_budget" "preview" {
  name         = "tdn-preview-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = [50, 80, 100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.budget_email]
    }
  }
}

# ── GitHub Actions OIDC deploy role (no long-lived keys) ────────────────────────
resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Restrict to this repo (any branch/tag). Tighten to a ref if you prefer.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "tdn-preview-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

# Deploy permissions: push to this ECR repo and update this one Lambda. Nothing else.
data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload", "ecr:InitiateLayerUpload",
      "ecr:PutImage", "ecr:UploadLayerPart", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer",
    ]
    resources = [aws_ecr_repository.app.arn]
  }
  statement {
    sid       = "LambdaDeploy"
    actions   = ["lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration", "lambda:GetFunction"]
    resources = [aws_lambda_function.app.arn]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
