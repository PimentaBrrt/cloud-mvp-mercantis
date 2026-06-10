###############################################################################
# providers.tf
# Provider AWS principal (região do MVP) + provider auxiliar em us-east-1.
#
# Por que dois providers?
#   AWS WAF com escopo CLOUDFRONT e os certificados ACM usados pelo CloudFront
#   PRECISAM existir em us-east-1, independentemente da região onde roda o
#   restante da infraestrutura. Por isso criamos um alias "us_east_1".
###############################################################################

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Mercantis-MVP"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Course      = "TI5A-Cloud-Computing-ESPM-2026.1"
    }
  }
}

# Provider auxiliar — obrigatório para WAF (escopo CLOUDFRONT) e ACM do CloudFront.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "Mercantis-MVP"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Course      = "TI5A-Cloud-Computing-ESPM-2026.1"
    }
  }
}
