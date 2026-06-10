###############################################################################
# storage.tf
# Bucket S3 para arquivos estáticos do portal. Endurecimento:
#   - Bloqueio total de acesso público
#   - Criptografia em repouso (SSE)
#   - Versionamento habilitado
#   - Acesso somente via CloudFront (Origin Access Control)
###############################################################################
 
resource "random_id" "bucket_suffix" {
  byte_length = 4
}
 
resource "aws_s3_bucket" "static" {
  bucket = "${local.prefix}-static-${random_id.bucket_suffix.hex}"
 
  # Permite que o "terraform destroy" apague o bucket mesmo com objetos/versões
  # dentro. Evita que a destruição falhe e deixe recursos ligados gerando custo.
  force_destroy = true
 
  tags = {
    Name = "${local.prefix}-static"
  }
}
 
# Bloqueio de acesso público — nenhuma ACL/política pode tornar o bucket público.
resource "aws_s3_bucket_public_access_block" "static" {
  bucket                  = aws_s3_bucket.static.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
 
# Versionamento — recuperação de objetos sobrescritos/apagados.
resource "aws_s3_bucket_versioning" "static" {
  bucket = aws_s3_bucket.static.id
  versioning_configuration {
    status = "Enabled"
  }
}
 
# Criptografia em repouso (SSE-S3 / AES256).
resource "aws_s3_bucket_server_side_encryption_configuration" "static" {
  bucket = aws_s3_bucket.static.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
 
# Política do bucket: leitura apenas pela distribuição CloudFront (via OAC).
data "aws_iam_policy_document" "static_bucket" {
  statement {
    sid     = "AllowCloudFrontOAC"
    actions = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.static.arn}/*"]
 
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
 
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}
 
resource "aws_s3_bucket_policy" "static" {
  bucket = aws_s3_bucket.static.id
  policy = data.aws_iam_policy_document.static_bucket.json
}
 