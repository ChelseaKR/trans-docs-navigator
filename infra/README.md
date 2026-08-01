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

## Cost allocation
Both configurations set `project = "trans-docs-navigator"` (plus a `stack` of
`prod` / `preview`) via the AWS provider's `default_tags` block, so every taggable
resource they create is attributable in Cost Explorer and to a per-project budget.
`project` is the activated cost-allocation tag key; anything created without it
lands in the account's untagged bucket, where a per-project budget cannot see it.

These are billing labels on infrastructure. They observe nothing about users and
collect no data, so they do not touch the no-analytics posture.

Resource-level `tags` blocks merge *over* provider defaults, so the `Name` and
`PII = "none"` tags on individual resources are unaffected.

**Not covered by `default_tags`** — these AWS resource types accept no tags at all,
so they will always appear untagged (they are also free, so they carry no spend of
their own; the billable parents they attach to *are* tagged):

- `aws_route_table_association`, `aws_security_group_rule`
- `aws_cloudwatch_log_metric_filter`
- `aws_wafv2_web_acl_association`
- preview: `aws_ecr_lifecycle_policy`, `aws_iam_role_policy`,
  `aws_iam_role_policy_attachment`, `aws_lambda_function_url`,
  `aws_budgets_budget`

Also outside this Terraform, and therefore not tagged by it: the Render deployment
(`render.yaml`, billed by Render, not AWS), the ECR image pushed by CD, and any
resource created by hand in the console. Tags apply from the next `apply` onward —
resources already live in the account keep whatever tags they were created with
until Terraform next reconciles them.

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
