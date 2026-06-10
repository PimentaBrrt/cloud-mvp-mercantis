###############################################################################
# cdn_waf.tf
# Camada de borda: AWS WAF + Amazon CloudFront (+ AWS Shield Standard).
#   - WAF com regras gerenciadas da AWS (OWASP comuns, IPs ruins, rate limit)
#   - CloudFront como CDN/entrada única, com OAC para o S3 e a EC2 como origem
#   - Shield Standard é aplicado automaticamente e sem custo ao CloudFront
###############################################################################

# ---------------------------------------------------------------------------
# AWS WAF (Web ACL) — DEVE estar em us-east-1 para escopo CLOUDFRONT.
# ---------------------------------------------------------------------------
resource "aws_wafv2_web_acl" "main" {
  provider = aws.us_east_1
  name     = "${local.prefix}-waf"
  scope    = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Regra 1: conjunto gerenciado da AWS contra ameaças comuns (inclui OWASP).
  rule {
    name     = "AWSCommonRules"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSCommonRules"
      sampled_requests_enabled   = true
    }
  }

  # Regra 2: bloqueia entradas de IPs com má reputação conhecida.
  rule {
    name     = "AWSReputationList"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSReputationList"
      sampled_requests_enabled   = true
    }
  }

  # Regra 3: rate limiting — mitiga DDoS/força bruta na camada de aplicação.
  rule {
    name     = "RateLimit"
    priority = 3
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.prefix}-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${local.prefix}-waf"
  }
}

# ---------------------------------------------------------------------------
# Origin Access Control — autentica o CloudFront junto ao bucket S3 privado.
# ---------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${local.prefix}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ---------------------------------------------------------------------------
# Distribuição CloudFront — entrada única, com WAF associado.
# Duas origens: a EC2 (frontend dinâmico) e o S3 (estáticos via /static/*).
# ---------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "main" {
  enabled         = true
  comment         = "${local.prefix} - distribuicao do portal Mercantis"
  web_acl_id      = aws_wafv2_web_acl.main.arn
  default_root_object = ""

  # Origem dinâmica: a EC2 com o container do frontend.
  origin {
    domain_name = aws_eip.frontend.public_dns
    origin_id   = "ec2-frontend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" # CloudFront -> origem em HTTP no MVP.
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Origem estática: o bucket S3, acessado via OAC.
  origin {
    domain_name              = aws_s3_bucket.static.bucket_regional_domain_name
    origin_id                = "s3-static"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  # Comportamento padrão: tudo vai para a EC2, forçando HTTPS para o usuário.
  default_cache_behavior {
    target_origin_id       = "ec2-frontend"
    viewer_protocol_policy = "redirect-to-https" # HTTPS obrigatório (TLS).
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # Conteúdo estático servido do S3 sob o prefixo /static/*.
  ordered_cache_behavior {
    path_pattern           = "/static/*"
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Certificado padrão do CloudFront (*.cloudfront.net) garante HTTPS ao usuário.
  # Para domínio próprio, troque por um certificado ACM em us-east-1.
  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  price_class = "PriceClass_100"

  tags = {
    Name = "${local.prefix}-cloudfront"
  }
}
