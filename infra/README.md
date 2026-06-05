# Infrastructure

Terraform skeleton for a **closed-VPC, PII-free** deployment (ROADMAP §6 / §11).

## Posture
- App runs in **private subnets**; only an ALB faces the internet.
- Grounded generation reaches **Bedrock via an interface VPC endpoint** — generation
  traffic never traverses the public internet.
- **No database, no user-data bucket.** The default mode stores zero PII, so there is
  nothing to persist. This is a deliberate data-minimization control, not an omission.
- Task role is **least-privilege**: `bedrock:InvokeModel` only.

## Commands
```sh
cd infra
terraform init -backend=false
terraform validate    # run in CI (container-and-infra job)
terraform plan        # requires AWS credentials
```

`make deploy-plan` wraps `init` + `validate`. If Terraform is not installed locally,
the command prints a pointer here rather than failing the developer's shell.

## Not included (intentionally)
- State backend / remote state config (environment-specific).
- ECS/Fargate service + ALB wiring (kept out of the reference skeleton to stay
  `terraform validate`-clean without provider credentials). The `aws_vpc`,
  VPC endpoint, and IAM policy demonstrate the security-relevant decisions.
