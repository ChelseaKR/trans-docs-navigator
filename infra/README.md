# Infrastructure

Terraform skeleton for a **closed-VPC, PII-free** deployment (ROADMAP §6 / §11).

## Posture
- App runs in **private subnets**; only an ALB faces the internet.
- Grounded generation reaches **Bedrock via an interface VPC endpoint** — generation
  traffic never traverses the public internet.
- **No database, no user-data bucket.** The default mode stores zero PII, so there is
  nothing to persist. This is a deliberate data-minimization control, not an omission.
- Task role is **least-privilege**: `bedrock:InvokeModel` only.

## Zero-egress runtime (FIX-09)
The app's security group (`aws_security_group.app`) is **deny-all egress by default** —
it declares no `egress` block at all, which (unlike leaving a security group
unconfigured) makes Terraform remove AWS's automatic "allow all outbound" default
rather than merely fail to add to it. The one exception is a scoped rule
(`aws_security_group_rule.app_egress_bedrock`) that permits HTTPS to the Bedrock
interface VPC endpoint's security group only. The app's private subnet
(`aws_subnet.app_private`) also carries no route to an Internet Gateway or NAT
Gateway — neither resource exists in this configuration — so the egress-denial holds
at the network layer even if a security-group rule were ever misconfigured.

**Honesty note (the writable-now / provable-later split):** this Terraform is
`terraform validate`-clean and describes the intended security posture precisely, but
egress-denial as an *empirical, runtime property* — "this instance genuinely cannot
reach the public internet" — can only be proven by `terraform apply`-ing it into a real
AWS account and attempting (and failing) an outbound connection from inside the app SG.
Static config review can't substitute for that. See `docs/audits/dpia.md` for the
corresponding STRIDE entries and the `docs/DEPLOY-AWS-PREVIEW.md` caveat below (the
turnkey Lambda preview intentionally runs *outside* this VPC and has different,
weaker egress guarantees — don't mistake a working preview deploy for a proof of this
posture).

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
  `terraform validate`-clean without provider credentials). The `aws_vpc`, subnet,
  route table, security groups, VPC endpoint, and IAM policy demonstrate the
  security-relevant decisions; attach `aws_security_group.app.id` to whatever compute
  resource (ECS task, EC2, etc.) actually runs the service.
