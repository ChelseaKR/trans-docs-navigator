# Deploying the preview on AWS (cost-light)

This deploys the real app to **your** AWS account as a container-image **Lambda behind a
public Function URL**, using the AWS Lambda Web Adapter (the same image that runs on
Render — the adapter is inert outside Lambda). It is chosen to be cheap, not
production-grade; the closed-VPC ECS posture in `infra/` is the production path for when
content is legally cleared.

> Demonstration, not a launched service: illustrative seed content with corrected
> official sources but placeholder verifiers; every page carries the "information, not
> legal advice" disclosure.

## Why this is cost-safe

| Guardrail | Effect |
|---|---|
| Lambda Function URL (no ALB, no Fargate, no NAT) | Scale-to-zero; an idle preview costs ~$0. No always-on hourly charges. |
| Pay-per-request + 1M free requests/month | Demo traffic is effectively free. |
| `reserved_concurrent_executions` cap (default 10) | Bounds the maximum cost rate — a spike can't run up the bill. |
| `aws_budgets_budget` (default $5/mo, alerts 50/80/100%) | Hard tripwire emailing you if cost ever rises. |
| No VPC, Bedrock OFF | No endpoint/NAT cost and no per-request model cost (the paid path needs `TDN_BEDROCK=aws`). |
| 14-day CloudWatch log retention; ECR keeps last 5 images | Logs and image storage can't creep. |
| `terraform destroy` | Removes everything → back to $0. |

## First deploy

Prereqs: AWS credentials with permission to create these resources, plus Terraform.

```sh
cd infra/preview
terraform init

# 1. Create the registry + roles + budget first (the Lambda needs an image to exist).
terraform apply -target=aws_ecr_repository.app

# 2. Build and push the image (from the repo root).
cd ../..
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "$(cd infra/preview && terraform output -raw ecr_repository_url | cut -d/ -f1)"
IMAGE="$(cd infra/preview && terraform output -raw ecr_repository_url):latest"
docker build -t "$IMAGE" . && docker push "$IMAGE"

# 3. Create the Lambda, Function URL, OIDC deploy role, and budget.
cd infra/preview && terraform apply -var budget_email=you@example.com

# 4. Point SITE_ORIGIN at the live URL so canonical/OG/sitemap are correct.
FN=trans-docs-navigator-preview
URL="$(terraform output -raw preview_url)"; URL="${URL%/}"
aws lambda update-function-configuration --function-name "$FN" \
  --environment "Variables={NODE_ENV=production,AWS_LWA_READINESS_CHECK_PATH=/healthz,SITE_ORIGIN=$URL}"
```

`terraform output preview_url` is your live link.

## Continuous deploys (no long-lived keys)

`terraform apply` also creates a GitHub OIDC deploy role. Wire it up once:

1. `terraform output -raw deploy_role_arn`
2. In the repo: **Settings → Secrets and variables → Actions → Variables**, set
   `AWS_DEPLOY_ROLE_ARN` to that ARN and `AWS_REGION` to your region.
3. Run the **deploy-aws-preview** workflow (Actions tab → Run workflow). It builds,
   pushes, updates the Lambda, and re-points `SITE_ORIGIN` to the live URL. It's
   manual-only (`workflow_dispatch`), so deploys never happen by surprise.

## Tear down

```sh
cd infra/preview && terraform destroy
```

Removes the Lambda, Function URL, ECR repo (and images), roles, log group, and budget —
the account returns to $0 for this stack.

## If the account already has a GitHub OIDC provider

Pass `-var create_oidc_provider=false`; the config reuses the existing provider.
