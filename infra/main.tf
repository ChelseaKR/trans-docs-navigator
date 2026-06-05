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

# VPC endpoint so generation traffic to Bedrock never traverses the public internet.
resource "aws_vpc_endpoint" "bedrock" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.bedrock-runtime"
  vpc_endpoint_type = "Interface"
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
