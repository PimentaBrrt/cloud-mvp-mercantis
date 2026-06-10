# Deploy da aplicação Mercantis na EC2

A aplicação é um container único: backend Node/Express que serve o frontend React
e expõe a API CRUD de usuários e produtos. Ele conecta no RDS MariaDB e envia as
imagens dos produtos para o S3 (servidas depois pelo CloudFront em `/static/...`).

A estratégia escolhida foi **buildar a imagem na própria EC2**. O código chega na
instância por meio do bucket S3 (a EC2 já tem permissão de leitura via IAM role).

## 0. Pré-requisito: reaplicar o Terraform

As últimas mudanças adicionam a permissão de `s3:PutObject` (upload de imagens) e
ajustam o IMDS (`http_put_response_hop_limit = 2`) para o container acessar a role.
São alterações in-place: a instância e o IP não mudam.

```bash
cd terraform
terraform apply
```

Anote os valores que vamos usar:

```bash
terraform output -raw static_bucket_name   # ex.: mercantis-mvp-static-ab12cd34
terraform output -raw db_secret_arn         # ARN do segredo do banco
terraform output ssm_access_hint            # contém o --target <instance-id>
```

## 1. Enviar o código para o S3 (na sua máquina)

Compacte a pasta `app` (sem `node_modules`) e suba para o bucket. No **PowerShell** (Windows):

```powershell
cd mercantis-mvp
Compress-Archive -Path app\* -DestinationPath app.zip -Force
aws s3 cp app.zip s3://<STATIC_BUCKET>/deploy/app.zip --region sa-east-1
```

No **Linux/macOS**:

```bash
cd mercantis-mvp
zip -r app.zip app -x 'app/node_modules/*' 'app/client/node_modules/*' 'app/client/dist/*'
aws s3 cp app.zip s3://<STATIC_BUCKET>/deploy/app.zip --region sa-east-1
```

## 2. Entrar na instância via SSM

```bash
aws ssm start-session --target <INSTANCE_ID> --region sa-east-1
```

Vire root para facilitar:

```bash
sudo su -
```

## 3. Garantir as ferramentas (unzip e AWS CLI)

```bash
dnf install -y unzip
# Só instale a AWS CLI se "aws --version" falhar:
if ! command -v aws >/dev/null; then
  curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
  unzip -q awscliv2.zip && ./aws/install
fi
```

## 4. Baixar o código, buildar e rodar

```bash
cd /root
aws s3 cp s3://<STATIC_BUCKET>/deploy/app.zip . --region sa-east-1
unzip -o app.zip
cd app

# Build da imagem (o Dockerfile builda o React e empacota o backend).
docker build -t mercantis:latest .

# Remove o container de demonstração que ocupa a porta 80.
docker rm -f mercantis-frontend 2>/dev/null || true
docker rm -f mercantis 2>/dev/null || true

# Sobe a aplicação. Troque o JWT_SECRET e a senha do admin.
docker run -d --name mercantis --restart unless-stopped -p 80:80 \
  -e DB_SECRET_ARN="<DB_SECRET_ARN>" \
  -e STATIC_BUCKET="<STATIC_BUCKET>" \
  -e AWS_REGION="sa-east-1" \
  -e JWT_SECRET="troque-por-um-valor-aleatorio" \
  -e SEED_ADMIN_EMAIL="admin@mercantis.com" \
  -e SEED_ADMIN_PASSWORD="mercantis123" \
  mercantis:latest

# Acompanhe a inicialização (cria as tabelas e popula os dados de exemplo).
docker logs -f mercantis
```

Quando aparecer `Mercantis no ar na porta 80`, está pronto.

## 5. Testar

Abra a URL do CloudFront (`terraform output -raw cloudfront_url`). Você verá a loja
com os produtos de exemplo. Clique em **Entrar** e use:

- E-mail: `admin@mercantis.com`
- Senha: `mercantis123` (ou o valor que você definiu em `SEED_ADMIN_PASSWORD`)

Depois de entrar, aparecem os menus **Produtos** e **Usuários** para o CRUD completo.
Ao cadastrar um produto, o upload de imagem vai para o S3 e é servido via CloudFront.

## Como funciona a integração

- O **CloudFront** serve `/static/*` direto do **S3** e todo o resto vai para a **EC2**.
  Por isso o React, a API (`/api/*`) e as imagens compartilham o mesmo domínio.
- O backend lê as credenciais do banco a partir do **Secrets Manager** (`DB_SECRET_ARN`),
  usando a **role da instância**. Nenhuma senha fica no código nem no histórico do shell.
- O upload de imagem usa a mesma role para gravar no **S3** (`s3:PutObject`).
- O banco continua **privado**: só a EC2 alcança a porta 3306.

## Atualizar a aplicação depois

Repita o passo 1 (subir o novo `app.zip`) e, na instância:

```bash
cd /root && aws s3 cp s3://<STATIC_BUCKET>/deploy/app.zip . --region sa-east-1
unzip -o app.zip && cd app
docker build -t mercantis:latest .
docker rm -f mercantis
docker run -d --name mercantis --restart unless-stopped -p 80:80 \
  -e DB_SECRET_ARN="<DB_SECRET_ARN>" -e STATIC_BUCKET="<STATIC_BUCKET>" \
  -e AWS_REGION="sa-east-1" -e JWT_SECRET="..." mercantis:latest
```

## Solução de problemas

| Sintoma | Causa provável | Ação |
|---|---|---|
| `docker logs` repete "Falha ao conectar no banco" | RDS ainda subindo ou SG | aguarde; confirme que o SG do banco libera 3306 do SG do front |
| Upload de imagem retorna 503 | `STATIC_BUCKET` não passado | confira a variável no `docker run` |
| Upload retorna erro de credenciais | IMDS hop limit | confirme `terraform apply` com `http_put_response_hop_limit = 2` |
| Porta 80 ocupada | container de demo ainda rodando | `docker rm -f mercantis-frontend` |
| 502 no CloudFront logo após subir | app ainda iniciando | aguarde os logs mostrarem "Mercantis no ar" |
