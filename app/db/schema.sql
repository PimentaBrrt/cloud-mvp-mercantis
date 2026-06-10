-- ============================================================================
-- schema.sql — Banco de dados da Mercantis (MariaDB)
-- Tabelas: users (contas de acesso à gestão) e products (catálogo).
-- O backend executa este schema na inicialização (CREATE TABLE IF NOT EXISTS),
-- então rodar manualmente é opcional. Mantido aqui para documentação.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS mercantis
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mercantis;

-- ----------------------------------------------------------------------------
-- Usuários: quem acessa a área de gestão. A senha é guardada como hash bcrypt.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(180)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Produtos: catálogo da loja. image_url guarda o caminho servido pelo
-- CloudFront (ex.: /static/products/<arquivo>), apontando para o bucket S3.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(160)   NOT NULL,
  description TEXT           NULL,
  price_cents INT            NOT NULL DEFAULT 0,
  stock       INT            NOT NULL DEFAULT 0,
  image_url   VARCHAR(512)   NULL,
  active      TINYINT(1)     NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_products_active ON products (active);
CREATE INDEX idx_products_name   ON products (name);

-- ----------------------------------------------------------------------------
-- Dados de exemplo (preços em centavos). O backend só insere estes registros
-- quando a tabela está vazia, para não duplicar a cada reinício.
-- A senha do admin de exemplo é definida pelo backend a partir da variável
-- de ambiente SEED_ADMIN_PASSWORD (padrão: mercantis123).
-- ----------------------------------------------------------------------------
INSERT INTO products (name, description, price_cents, stock, image_url) VALUES
  ('Fone de ouvido sem fio', 'Bluetooth 5.3, bateria de 30 horas e cancelamento de ruído.', 24990, 40, NULL),
  ('Cafeteira compacta',     'Prepara até 4 xícaras e cabe em qualquer bancada.',             18990, 25, NULL),
  ('Mochila urbana 20L',     'Compartimento acolchoado para notebook e tecido impermeável.',  15990, 60, NULL),
  ('Teclado mecânico',       'Switches táteis, layout ABNT2 e iluminação regulável.',         32990, 18, NULL),
  ('Garrafa térmica 1L',     'Mantém a temperatura por 12 horas em aço inox.',                 8990, 100, NULL),
  ('Luminária de mesa LED',  'Três tons de luz e braço articulado.',                          11990, 35, NULL);
