###############################################################################
# database.tf
# Amazon RDS MariaDB na subnet privada. Endurecimento:
#   - Não acessível publicamente
#   - Criptografia em repouso (KMS) e SSL/TLS em trânsito
#   - Senha gerada aleatoriamente e guardada no AWS Secrets Manager
#   - Backups automáticos habilitados
###############################################################################

# Senha forte gerada pelo Terraform (não fica em texto plano no código).
resource "random_password" "db" {
  length           = 20
  special          = true
  override_special = "!#$%&*()-_=+[]{}"
}

# Segredo no Secrets Manager com usuário/senha do banco.
resource "aws_secretsmanager_secret" "db" {
  name        = "${local.prefix}-db-credentials"
  description = "Credenciais do RDS MariaDB da Mercantis."
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db.result
    engine   = "mariadb"
    host     = aws_db_instance.mariadb.address
    port     = 3306
    dbname   = var.db_name
  })
}

# DB Subnet Group: exige subnets em pelo menos 2 AZs (já provisionadas).
resource "aws_db_subnet_group" "main" {
  name       = "${local.prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${local.prefix}-db-subnet-group"
  }
}

# Chave KMS dedicada para criptografar o armazenamento do RDS.
resource "aws_kms_key" "rds" {
  description             = "KMS para criptografia do RDS MariaDB da Mercantis."
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "${local.prefix}-kms-rds"
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${local.prefix}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

resource "aws_db_instance" "mariadb" {
  identifier     = "${local.prefix}-mariadb"
  engine         = "mariadb"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2 # storage autoscaling
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result
  port     = 3306

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  multi_az               = var.db_multi_az

  # Segurança: nunca exposto à internet.
  publicly_accessible = false

  # Backups e retenção.
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Logs de auditoria/erro enviados ao CloudWatch.
  enabled_cloudwatch_logs_exports = ["error", "general", "slowquery"]

  deletion_protection = var.enable_deletion_protection
  skip_final_snapshot = true # MVP: simplifica destroy. Em produção, defina false.

  tags = {
    Name = "${local.prefix}-mariadb"
  }
}
