###############################################################################
# variables.tf
# Variáveis de entrada do projeto. Valores padrão refletem o MVP da Mercantis.
###############################################################################

variable "aws_region" {
  description = "Região AWS principal do MVP."
  type        = string
  default     = "sa-east-1" # São Paulo — menor latência para e-commerce nacional.
}

variable "environment" {
  description = "Nome do ambiente (usado em tags e nomes de recursos)."
  type        = string
  default     = "mvp"
}

variable "project_name" {
  description = "Prefixo aplicado aos nomes dos recursos."
  type        = string
  default     = "mercantis"
}

variable "vpc_cidr" {
  description = "Bloco CIDR da VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDRs das subnets públicas (uma por AZ)."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDRs das subnets privadas (uma por AZ)."
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "az_count" {
  description = "Quantidade de Availability Zones a utilizar."
  type        = number
  default     = 2
}

variable "instance_type" {
  description = "Tipo da instância EC2 que roda o container Docker do frontend."
  type        = string
  default     = "t3.micro" # Elegível ao Free Tier (750h/mês nos primeiros 12 meses).
}

variable "frontend_image" {
  description = "Imagem Docker do frontend a ser executada na EC2."
  type        = string
  default     = "nginxdemos/hello:plain-text"
}

variable "frontend_container_port" {
  description = "Porta interna exposta pelo container do frontend."
  type        = number
  default     = 80
}

variable "db_engine_version" {
  description = "Versão do MariaDB no Amazon RDS."
  type        = string
  default     = "10.11"
}

variable "db_instance_class" {
  description = "Classe da instância RDS."
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Armazenamento alocado (GB) para o RDS."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Nome do banco de dados inicial."
  type        = string
  default     = "mercantis"
}

variable "db_username" {
  description = "Usuário administrador do banco (a senha é gerada e guardada no Secrets Manager)."
  type        = string
  default     = "mercantis_admin"
}

variable "db_multi_az" {
  description = "Habilita Multi-AZ no RDS. false no MVP para reduzir custo; true na arquitetura final."
  type        = bool
  default     = false
}

variable "enable_deletion_protection" {
  description = "Proteção contra exclusão acidental do RDS."
  type        = bool
  default     = false
}
