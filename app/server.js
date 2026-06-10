/* ============================================================================
 * server.js — Portal Mercantis
 * Backend Express que serve o frontend React e expõe a API CRUD de
 * usuários e produtos. Conecta ao MariaDB (RDS) e envia imagens ao S3.
 * ==========================================================================*/
"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

// ---------------------------------------------------------------------------
// Configuração via variáveis de ambiente
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || "80", 10);
const JWT_SECRET = process.env.JWT_SECRET || "troque-este-segredo-em-producao";
const AWS_REGION = process.env.AWS_REGION || "sa-east-1";
const STATIC_BUCKET = process.env.STATIC_BUCKET || "";
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@mercantis.com";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "mercantis123";

// Credenciais do banco. Aceita:
//   DB_SECRET      -> JSON do Secrets Manager já resolvido (string)
//   DB_SECRET_ARN  -> ARN do segredo; o backend busca via SDK (usa a role da EC2)
//   ou variáveis soltas (DB_HOST, DB_USER, ...) para desenvolvimento local.
async function loadDbConfig() {
  let raw = process.env.DB_SECRET;
  if (!raw && process.env.DB_SECRET_ARN) {
    const sm = new SecretsManagerClient({ region: AWS_REGION });
    const out = await sm.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }));
    raw = out.SecretString;
  }
  if (!raw) {
    return {
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "mercantis",
      port: parseInt(process.env.DB_PORT || "3306", 10),
    };
  }
  const s = JSON.parse(raw);
  return {
    host: s.host,
    user: s.username || s.user,
    password: s.password,
    database: s.dbname || s.database || "mercantis",
    port: s.port || 3306,
  };
}

let pool;

const s3 = STATIC_BUCKET ? new S3Client({ region: AWS_REGION }) : null;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ---------------------------------------------------------------------------
// Inicialização do banco: cria as tabelas e popula dados de exemplo.
// ---------------------------------------------------------------------------
async function initDatabase() {
  const dbConfig = await loadDbConfig();
  pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      name          VARCHAR(120) NOT NULL,
      email         VARCHAR(180) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(160) NOT NULL,
      description TEXT NULL,
      price_cents INT NOT NULL DEFAULT 0,
      stock       INT NOT NULL DEFAULT 0,
      image_url   VARCHAR(512) NULL,
      active      TINYINT(1) NOT NULL DEFAULT 1,
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Admin inicial, criado só se não houver nenhum usuário.
  const [[{ total: userCount }]] = await pool.query("SELECT COUNT(*) AS total FROM users");
  if (userCount === 0) {
    const hash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
      ["Administrador", SEED_ADMIN_EMAIL, hash]
    );
    console.log(`Usuário admin criado: ${SEED_ADMIN_EMAIL}`);
  }

  // Produtos de exemplo, só se a tabela estiver vazia.
  const [[{ total: productCount }]] = await pool.query("SELECT COUNT(*) AS total FROM products");
  if (productCount === 0) {
    const samples = [
      ["Fone de ouvido sem fio", "Bluetooth 5.3, bateria de 30 horas e cancelamento de ruído.", 24990, 40],
      ["Cafeteira compacta", "Prepara até 4 xícaras e cabe em qualquer bancada.", 18990, 25],
      ["Mochila urbana 20L", "Compartimento acolchoado para notebook e tecido impermeável.", 15990, 60],
      ["Teclado mecânico", "Switches táteis, layout ABNT2 e iluminação regulável.", 32990, 18],
      ["Garrafa térmica 1L", "Mantém a temperatura por 12 horas em aço inox.", 8990, 100],
      ["Luminária de mesa LED", "Três tons de luz e braço articulado.", 11990, 35],
    ];
    for (const [name, description, price, stock] of samples) {
      await pool.query(
        "INSERT INTO products (name, description, price_cents, stock) VALUES (?, ?, ?, ?)",
        [name, description, price, stock]
      );
    }
    console.log("Produtos de exemplo inseridos.");
  }
}

// ---------------------------------------------------------------------------
// Autenticação (JWT)
// ---------------------------------------------------------------------------
function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// Log de cada requisição: método, rota, status e tempo de resposta.
// Sai no stdout do container e é coletado pelo Docker (e pelo CloudWatch).
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`
    );
  });
  next();
});

const api = express.Router();

api.get("/health", (req, res) => res.json({ status: "ok" }));

// --- Auth ---
api.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Informe e-mail e senha." });
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  }
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

api.get("/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

// --- Produtos ---
// Catálogo público: somente produtos ativos.
api.get("/products", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC"
  );
  res.json(rows);
});

// Gestão: lista tudo (inclui inativos).
api.get("/products/all", requireAuth, async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
  res.json(rows);
});

api.get("/products/:id", async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Produto não encontrado." });
  res.json(rows[0]);
});

api.post("/products", requireAuth, async (req, res) => {
  const { name, description, price_cents, stock, image_url, active } = req.body || {};
  if (!name || price_cents == null) return res.status(400).json({ error: "Nome e preço são obrigatórios." });
  const [result] = await pool.query(
    "INSERT INTO products (name, description, price_cents, stock, image_url, active) VALUES (?, ?, ?, ?, ?, ?)",
    [name, description || null, price_cents, stock || 0, image_url || null, active == null ? 1 : active ? 1 : 0]
  );
  const [rows] = await pool.query("SELECT * FROM products WHERE id = ?", [result.insertId]);
  res.status(201).json(rows[0]);
});

api.put("/products/:id", requireAuth, async (req, res) => {
  const { name, description, price_cents, stock, image_url, active } = req.body || {};
  await pool.query(
    `UPDATE products SET name = ?, description = ?, price_cents = ?, stock = ?, image_url = ?, active = ?
     WHERE id = ?`,
    [name, description || null, price_cents, stock || 0, image_url || null, active ? 1 : 0, req.params.id]
  );
  const [rows] = await pool.query("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Produto não encontrado." });
  res.json(rows[0]);
});

api.delete("/products/:id", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM products WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// --- Upload de imagem para o S3 (servido depois via CloudFront em /static/...) ---
api.post("/uploads", requireAuth, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
  if (!s3) return res.status(503).json({ error: "Upload indisponível: STATIC_BUCKET não configurado." });
  const ext = (req.file.originalname.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `static/products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: STATIC_BUCKET,
    Key: key,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  }));
  // Caminho relativo: o próprio CloudFront roteia /static/* para o S3.
  res.status(201).json({ url: `/${key}` });
});

// --- Usuários (toda a gestão exige login) ---
api.get("/users", requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC"
  );
  res.json(rows);
});

api.post("/users", requireAuth, async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, email, hash, role === "admin" ? "admin" : "staff"]
    );
    res.status(201).json({ id: result.insertId, name, email, role: role || "staff" });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Já existe um usuário com este e-mail." });
    throw e;
  }
});

api.put("/users/:id", requireAuth, async (req, res) => {
  const { name, email, password, role } = req.body || {};
  const fields = [];
  const values = [];
  if (name) { fields.push("name = ?"); values.push(name); }
  if (email) { fields.push("email = ?"); values.push(email); }
  if (role) { fields.push("role = ?"); values.push(role === "admin" ? "admin" : "staff"); }
  if (password) { fields.push("password_hash = ?"); values.push(await bcrypt.hash(password, 10)); }
  if (fields.length === 0) return res.status(400).json({ error: "Nada para atualizar." });
  values.push(req.params.id);
  await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
  const [rows] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ?", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Usuário não encontrado." });
  res.json(rows[0]);
});

api.delete("/users/:id", requireAuth, async (req, res) => {
  if (String(req.user.id) === String(req.params.id)) {
    return res.status(400).json({ error: "Você não pode excluir o próprio usuário." });
  }
  await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.use("/api", api);

// Tratamento de erro genérico para não derrubar o processo.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

// ---------------------------------------------------------------------------
// Frontend React (build estático) + fallback SPA
// ---------------------------------------------------------------------------
const clientDir = path.join(__dirname, "client", "dist");
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.get("*", (req, res) => res.sendFile(path.join(clientDir, "index.html")));
}

// ---------------------------------------------------------------------------
// Sobe o servidor (com retry para esperar o RDS aceitar conexões).
// ---------------------------------------------------------------------------
async function start() {
  let attempts = 0;
  while (true) {
    try {
      await initDatabase();
      break;
    } catch (e) {
      attempts += 1;
      console.error(`Falha ao conectar no banco (tentativa ${attempts}): ${e.message}`);
      if (attempts >= 15) throw e;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  app.listen(PORT, () => console.log(`Mercantis no ar na porta ${PORT}`));
}

start().catch((e) => {
  console.error("Não foi possível iniciar a aplicação:", e);
  process.exit(1);
});
