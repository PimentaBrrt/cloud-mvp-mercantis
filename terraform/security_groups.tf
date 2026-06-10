###############################################################################
# security_groups.tf
# Security Groups (firewall stateful em nível de instância) com privilégio
# mínimo. Princípio central: o front só recebe tráfego do CloudFront, e o
# banco só recebe tráfego do front.
###############################################################################

# Prefix list gerenciada pela AWS contendo os IPs de origem do CloudFront.
# Usar isso (em vez de 0.0.0.0/0) garante que SOMENTE o CloudFront alcance a EC2.
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# ---------------------------------------------------------------------------
# SG do frontend (EC2 com Docker) na subnet pública.
# ---------------------------------------------------------------------------
resource "aws_security_group" "frontend" {
  name        = "${local.prefix}-sg-frontend"
  description = "Permite HTTP/HTTPS apenas a partir do CloudFront."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.prefix}-sg-frontend"
  }
}

# HTTP apenas da prefix list do CloudFront — bloqueia acesso direto pela internet.
# Apenas a porta 80: o CloudFront fala com a origem em http-only (ver cdn_waf.tf).
# A prefix list do CloudFront pesa 55 regras; usar uma única porta cabe no limite
# padrão de 60 regras por Security Group (duas portas estourariam o limite).
resource "aws_security_group_rule" "frontend_http_from_cloudfront" {
  type              = "ingress"
  security_group_id = aws_security_group.frontend.id
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  prefix_list_ids   = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  description       = "HTTP somente do CloudFront (origin-facing)."
}

# Saída liberada (necessária para puxar a imagem Docker, patches, etc.).
resource "aws_security_group_rule" "frontend_egress" {
  type              = "egress"
  security_group_id = aws_security_group.frontend.id
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Saida liberada para download de imagem/patches."
}

# OBS.: Não há regra de SSH (porta 22). O acesso administrativo é feito via
# AWS Systems Manager Session Manager (ver iam.tf), eliminando a exposição
# da porta 22 — medida de segurança adicional em relação ao diagrama base.

# ---------------------------------------------------------------------------
# SG do banco de dados (RDS MariaDB) na subnet privada.
# ---------------------------------------------------------------------------
resource "aws_security_group" "database" {
  name        = "${local.prefix}-sg-database"
  description = "Permite MySQL/MariaDB (3306) apenas a partir do SG do frontend."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.prefix}-sg-database"
  }
}

# Porta 3306 SOMENTE a partir do SG do frontend (referência de SG, não CIDR).
resource "aws_security_group_rule" "db_ingress_from_frontend" {
  type                     = "ingress"
  security_group_id        = aws_security_group.database.id
  from_port                = 3306
  to_port                  = 3306
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.frontend.id
  description              = "MariaDB 3306 somente do frontend."
}

# Saída restrita: o banco não inicia conexões externas.
resource "aws_security_group_rule" "db_egress" {
  type              = "egress"
  security_group_id = aws_security_group.database.id
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Saida para manutencao gerenciada do RDS."
}
