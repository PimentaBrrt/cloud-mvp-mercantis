#!/bin/bash
###############################################################################
# user_data.sh
# Inicializa a EC2: instala Docker e executa o container do frontend.
# Variáveis interpoladas pelo Terraform (templatefile):
#   ${frontend_image}, ${container_port}, ${aws_region}, ${db_secret_arn}
###############################################################################
set -euxo pipefail

# Atualiza pacotes e instala Docker (Amazon Linux 2023).
dnf update -y
dnf install -y docker
systemctl enable --now docker

# (Opcional) Recupera as credenciais do banco do Secrets Manager para que a
# aplicação as utilize. A EC2 tem permissão de leitura via IAM role.
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "${db_secret_arn}" \
  --region "${aws_region}" \
  --query SecretString --output text || echo "{}")

# Sobe o container do frontend, reiniciando sempre que necessário.
docker run -d \
  --name mercantis-frontend \
  --restart unless-stopped \
  -p ${container_port}:${container_port} \
  -e DB_SECRET="$DB_SECRET" \
  "${frontend_image}"
