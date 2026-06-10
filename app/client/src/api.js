// Cliente HTTP simples. Mesma origem do CloudFront, então usamos caminhos relativos.
const TOKEN_KEY = "mercantis_token";

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  set token(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },
  get user() {
    const raw = localStorage.getItem("mercantis_user");
    return raw ? JSON.parse(raw) : null;
  },
  set user(u) { u ? localStorage.setItem("mercantis_user", JSON.stringify(u)) : localStorage.removeItem("mercantis_user"); },
  clear() { this.token = null; this.user = null; },
};

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  let payload;
  if (form) {
    payload = form; // FormData: o browser define o Content-Type
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Algo deu errado. Tente de novo.");
  return data;
}

export const api = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  // Produtos
  listProducts: () => request("/products"),
  listAllProducts: () => request("/products/all"),
  createProduct: (p) => request("/products", { method: "POST", body: p }),
  updateProduct: (id, p) => request(`/products/${id}`, { method: "PUT", body: p }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return request("/uploads", { method: "POST", form: fd });
  },
  // Usuários
  listUsers: () => request("/users"),
  createUser: (u) => request("/users", { method: "POST", body: u }),
  updateUser: (id, u) => request(`/users/${id}`, { method: "PUT", body: u }),
  deleteUser: (id) => request(`/users/${id}`, { method: "DELETE" }),
};

export function formatPrice(cents) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
