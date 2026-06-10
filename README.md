# MVP Mercantis na AWS - Infraestrutura como Código (Terraform)

Este repositório provisiona, com Terraform, o MVP de migração da **Mercantis** para a AWS: um portal de e-commerce com o **frontend em container Docker (EC2)**, **banco de dados MariaDB gerenciado (Amazon RDS)** em sub-rede privada e uma camada de borda com **CloudFront + AWS WAF + AWS Shield**. A arquitetura segue o diagrama-base fornecido e adiciona controles de segurança extras (descritos na documentação).

> Disciplina TI5A - Cloud Computing (ESPM 2026-I). Estudo de caso Mercantis / move2cloud.

---

## 1. O que será criado

| Componente | Serviço AWS | Sub-rede |
|---|---|---|
| Rede isolada | VPC `10.0.0.0/16` em 2 AZs | — |
| Entrada/borda | CloudFront + WAF + Shield Standard | Edge (global) |
| Frontend (Docker) | EC2 (Amazon Linux 2023 + Docker) | Pública |
| Banco de dados | RDS MariaDB | Privada |
| Estáticos | S3 (privado, via CloudFront OAC) | — |
| Segredos | Secrets Manager + KMS | — |
| Auditoria | VPC Flow Logs → CloudWatch | — |

Custo aproximado em repouso (sa-east-1): dominado por NAT Gateway, RDS `db.t3.micro` e EC2 `t3.small`. **Rodar `terraform destroy` ao terminar** para evitar cobranças.

---

## 2. Pré-requisitos

1. **Conta AWS** com permissões para criar VPC, EC2, RDS, S3, CloudFront, WAF, IAM, KMS e Secrets Manager.
2. **Terraform** ≥ 1.5 - instale em <https://developer.hashicorp.com/terraform/install>.
3. **AWS CLI** v2 - instale em <https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>.
4. (Opcional) **Session Manager plugin** da AWS CLI, para acessar a EC2 sem SSH.

Verifique:

```bash
terraform version
aws --version
```

---

## 3. Configurar credenciais AWS

Use um usuário/role **com MFA e privilégio mínimo** (não a conta root). A forma recomendada:

```bash
aws configure
# AWS Access Key ID:     <sua-access-key>
# AWS Secret Access Key: <sua-secret-key>
# Default region name:   sa-east-1
# Default output format:  json
```

Ou via variáveis de ambiente:

```bash
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="sa-east-1"
```

Confirme a identidade:

```bash
aws sts get-caller-identity
```

---

## 4. Preparar as variáveis

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edite `terraform.tfvars` se quiser mudar região, tipos de instância ou a imagem Docker do frontend (`frontend_image`). Os padrões já sobem um MVP funcional.

> O **`terraform.tfvars` não deve ser versionado** (já está no `.gitignore`). A senha do banco **não** é definida aqui, é gerada automaticamente e guardada no Secrets Manager.

---

## 5. Provisionar (deploy)

```bash
cd terraform

terraform init      # baixa os providers
terraform fmt       # (opcional) formata os arquivos
terraform validate  # valida a configuração
terraform plan      # mostra o que será criado (revise antes de aplicar)
terraform apply      # cria a infraestrutura - confirme com "yes"
```

O `apply` leva alguns minutos (o RDS e o CloudFront são os mais lentos). Ao final, os **outputs** mostram:

- `cloudfront_url` - URL pública do portal (abra no navegador).
- `frontend_public_ip` - IP da EC2 (origem do CloudFront).
- `rds_endpoint` - endpoint do banco (acessível só de dentro da VPC).
- `db_secret_arn` - ARN do segredo com as credenciais do banco.
- `static_bucket_name` - bucket S3 de estáticos.
- `ssm_access_hint` - comando pronto para acessar a EC2 via SSM.

> A primeira carga do CloudFront pode levar ~15 min para propagar. Se aparecer erro 502 logo após o apply, aguarde a EC2 terminar o `user_data` (instalação do Docker + container).

---

## 6. Acessar e operar

**Abrir o portal:** copie o valor de `cloudfront_url` no navegador.

**Acessar a EC2 sem SSH (via SSM Session Manager):**

```bash
aws ssm start-session --target <instance-id> --region sa-east-1
# Dentro da instância:
sudo docker ps          # ver o container do frontend
sudo docker logs mercantis-frontend
```

**Ler a senha do banco (Secrets Manager):**

```bash
aws secretsmanager get-secret-value \
  --secret-id mercantis-mvp-db-credentials \
  --region sa-east-1 --query SecretString --output text
```

**Subir um estático para o S3 (servido em `/static/...`):**

```bash
aws s3 cp ./logo.png s3://<static_bucket_name>/static/logo.png
# Acesse: https://<cloudfront_url>/static/logo.png
```

---

## 7. Trocar o frontend pela sua aplicação

O MVP sobe uma imagem de demonstração (`nginxdemos/hello`). Para usar a sua:

1. Publique sua imagem em um registry (Docker Hub ou Amazon ECR).
2. Defina `frontend_image` no `terraform.tfvars` (ex.: `123456789012.dkr.ecr.sa-east-1.amazonaws.com/mercantis-front:latest`).
3. Ajuste `frontend_container_port` se o container não escutar na 80.
4. `terraform apply` novamente.

A aplicação lê as credenciais do banco a partir da variável de ambiente `DB_SECRET` (injetada pelo `user_data.sh` a partir do Secrets Manager).

---

## 8. Destruir o ambiente

```bash
cd terraform
terraform destroy   # confirme com "yes"
```

Isso remove todos os recursos e interrompe as cobranças. Como `skip_final_snapshot = true` no MVP, o RDS é apagado sem snapshot final (ajuste em produção).

---

## 9. Estrutura do projeto

```
mercantis-mvp/
├── README.md
├── docs/
│   ├── Documentacao_MVP_Mercantis.docx   # documentação completa
│   ├── diagrama_infra_final.png
│   └── diagrama_infra_mvp.png
└── terraform/
    ├── versions.tf            # versões de Terraform/providers
    ├── providers.tf           # providers AWS (sa-east-1 + us-east-1 p/ WAF)
    ├── variables.tf           # variáveis de entrada
    ├── network.tf             # VPC, subnets, IGW, NAT, rotas, NACLs
    ├── security_groups.tf     # firewalls (SG) com privilégio mínimo
    ├── iam.tf                 # role/perfil da EC2 (SSM, S3, Secrets)
    ├── compute.tf             # EC2 + Docker (frontend)
    ├── database.tf            # RDS MariaDB + KMS + Secrets Manager
    ├── storage.tf             # bucket S3 de estáticos
    ├── cdn_waf.tf             # CloudFront + WAF (+ Shield)
    ├── flow_logs.tf           # VPC Flow Logs → CloudWatch
    ├── outputs.tf             # saídas úteis
    ├── user_data.sh           # bootstrap do Docker na EC2
    └── terraform.tfvars.example
```

---

## 10. Solução de problemas

| Sintoma | Causa provável | Ação |
|---|---|---|
| `terraform init` falha em providers | sem internet/proxy | verifique a conexão e proxy |
| `AccessDenied` no apply | permissões insuficientes | revise a policy do seu usuário IAM |
| Portal retorna 502/erro | EC2 ainda rodando o `user_data` | aguarde ~3 min; veja `docker logs` via SSM |
| Não consigo conectar no RDS de fora | comportamento esperado | o banco é privado; acesse de dentro da VPC |
| WAF não cria | provider us-east-1 ausente | confirme o bloco `aws.us_east_1` em `providers.tf` |
