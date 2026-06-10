###############################################################################
# iam.tf
# Papel (role) e perfil de instância para a EC2, com privilégio mínimo:
#   - SSM Session Manager (acesso administrativo sem SSH/porta 22)
#   - Leitura do bucket S3 de estáticos
#   - Leitura do segredo do banco no Secrets Manager
###############################################################################

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "frontend" {
  name               = "${local.prefix}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json

  tags = {
    Name = "${local.prefix}-ec2-role"
  }
}

# Permite administração via SSM Session Manager (sem abrir SSH).
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.frontend.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Política de privilégio mínimo: ler estáticos do S3 e ler o segredo do banco.
data "aws_iam_policy_document" "frontend_inline" {
  statement {
    sid     = "ReadWriteStaticBucket"
    actions = ["s3:GetObject", "s3:ListBucket", "s3:PutObject"]
    resources = [
      aws_s3_bucket.static.arn,
      "${aws_s3_bucket.static.arn}/*",
    ]
  }

  statement {
    sid       = "ReadDbSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.db.arn]
  }
}

resource "aws_iam_role_policy" "frontend_inline" {
  name   = "${local.prefix}-ec2-inline"
  role   = aws_iam_role.frontend.id
  policy = data.aws_iam_policy_document.frontend_inline.json
}

resource "aws_iam_instance_profile" "frontend" {
  name = "${local.prefix}-ec2-profile"
  role = aws_iam_role.frontend.name
}
