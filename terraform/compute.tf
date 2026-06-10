###############################################################################
# compute.tf
# EC2 que roda o frontend em container Docker, na subnet pública.
# Endurecimento aplicado: IMDSv2 obrigatório, disco EBS criptografado,
# sem chave SSH (acesso via SSM), IP público elástico fixo.
###############################################################################

# AMI mais recente do Amazon Linux 2023 (mantida pela AWS, com SSM agent embutido).
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Script de inicialização: instala Docker e sobe o container do frontend.
locals {
  user_data = templatefile("${path.module}/user_data.sh", {
    frontend_image = var.frontend_image
    container_port = var.frontend_container_port
    aws_region     = var.aws_region
    db_secret_arn  = aws_secretsmanager_secret.db.arn
  })
}

resource "aws_instance" "frontend" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.frontend.id]
  iam_instance_profile   = aws_iam_instance_profile.frontend.name
  user_data              = local.user_data

  # IMDSv2 obrigatório — protege contra roubo de credenciais via SSRF.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  # Disco raiz criptografado.
  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name = "${local.prefix}-frontend"
  }
}

# IP público elástico — endereço estável usado como origem pelo CloudFront.
resource "aws_eip" "frontend" {
  domain   = "vpc"
  instance = aws_instance.frontend.id

  tags = {
    Name = "${local.prefix}-frontend-eip"
  }

  depends_on = [aws_internet_gateway.main]
}
