variable "aws_region" {
  description = "Region for the preview (us-east-1 keeps Lambda + ECR costs lowest)."
  type        = string
  default     = "us-east-1"
}

variable "github_repo" {
  description = "owner/name of the repo allowed to deploy via GitHub OIDC."
  type        = string
  default     = "ChelseaKR/trans-docs-navigator"
}

variable "budget_email" {
  description = "Email to alert when the monthly cost budget crosses a threshold."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Hard cost tripwire. The architecture should sit near $0; this alerts if not."
  type        = number
  default     = 5
}

variable "image_tag" {
  description = "ECR image tag the Lambda runs. CD updates the function code out of band."
  type        = string
  default     = "latest"
}

variable "lambda_memory_mb" {
  description = "Small memory = lower per-ms cost. 512MB is plenty for this app."
  type        = number
  default     = 512
}

variable "max_concurrency" {
  description = "Reserved concurrency cap — bounds the maximum cost rate and blast radius of a traffic spike."
  type        = number
  default     = 10
}

variable "create_oidc_provider" {
  description = "Create the GitHub Actions OIDC provider. Set false if the account already has one."
  type        = bool
  default     = true
}
