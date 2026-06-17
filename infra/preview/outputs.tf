output "preview_url" {
  description = "Public URL of the deployed preview (set this as SITE_ORIGIN after first deploy)."
  value       = aws_lambda_function_url.app.function_url
}

output "ecr_repository_url" {
  description = "Push target for the container image."
  value       = aws_ecr_repository.app.repository_url
}

output "deploy_role_arn" {
  description = "Set this as the AWS_DEPLOY_ROLE_ARN repo variable for the GitHub Actions deploy."
  value       = aws_iam_role.github_deploy.arn
}
