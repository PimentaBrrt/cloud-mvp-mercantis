###############################################################################
# outputs.tf
# Valores úteis exibidos ao final do "terraform apply".
###############################################################################

output "cloudfront_url" {
  description = "URL pública do portal (entrada via CloudFront/WAF)."
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "frontend_public_ip" {
  description = "IP elástico da EC2 do frontend (origem do CloudFront)."
  value       = aws_eip.frontend.public_ip
}

output "rds_endpoint" {
  description = "Endpoint do RDS MariaDB (acessível apenas de dentro da VPC)."
  value       = aws_db_instance.mariadb.address
}

output "db_secret_arn" {
  description = "ARN do segredo com as credenciais do banco no Secrets Manager."
  value       = aws_secretsmanager_secret.db.arn
}

output "static_bucket_name" {
  description = "Nome do bucket S3 de arquivos estáticos."
  value       = aws_s3_bucket.static.bucket
}

output "vpc_id" {
  description = "ID da VPC criada."
  value       = aws_vpc.main.id
}

output "ssm_access_hint" {
  description = "Como acessar a EC2 sem SSH."
  value       = "aws ssm start-session --target ${aws_instance.frontend.id} --region ${var.aws_region}"
}
