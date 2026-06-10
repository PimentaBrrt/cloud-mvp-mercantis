import { useEffect, useState } from "react";
import { api, formatPrice } from "../api.js";

const EMPTY = { name: "", description: "", price_reais: "", stock: 0, image_url: "", active: true };

function ProductModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function pickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url } = await api.uploadImage(file);
      set("image_url", url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      name: form.name,
      description: form.description,
      price_cents: Math.round(parseFloat(String(form.price_reais).replace(",", ".") || "0") * 100),
      stock: parseInt(form.stock || 0, 10),
      image_url: form.image_url || null,
      active: form.active,
    };
    try {
      if (initial.id) await api.updateProduct(initial.id, payload);
      else await api.createProduct(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="panel modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{initial.id ? "Editar produto" : "Novo produto"}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={save}>
          <div className="field">
            <label>Nome</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="field">
            <label>Descrição</label>
            <textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="form-row">
            <div className="field">
              <label>Preço (R$)</label>
              <input type="text" inputMode="decimal" placeholder="0,00"
                value={form.price_reais} onChange={(e) => set("price_reais", e.target.value)} required />
            </div>
            <div className="field">
              <label>Estoque</label>
              <input type="number" min="0" value={form.stock}
                onChange={(e) => set("stock", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Imagem</label>
            <div className="uploader">
              {form.image_url
                ? <img className="preview" src={form.image_url} alt="prévia" />
                : <div className="preview" />}
              <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                {uploading ? "Enviando..." : "Enviar imagem"}
                <input type="file" accept="image/*" hidden onChange={pickImage} disabled={uploading} />
              </label>
            </div>
          </div>
          <div className="field">
            <label style={{ display: "flex", gap: 8, alignItems: "center", flexDirection: "row" }}>
              <input type="checkbox" checked={!!form.active}
                onChange={(e) => set("active", e.target.checked)} style={{ width: "auto" }} />
              Visível na loja
            </label>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={busy || uploading}>
              {busy ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // objeto do form ou null

  function load() {
    setLoading(true);
    api.listAllProducts().then(setProducts).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openNew() { setEditing({ ...EMPTY }); }
  function openEdit(p) {
    setEditing({ ...p, price_reais: (p.price_cents / 100).toFixed(2).replace(".", ","), active: !!p.active });
  }
  async function remove(p) {
    if (!confirm(`Excluir o produto "${p.name}"?`)) return;
    await api.deleteProduct(p.id);
    load();
  }

  return (
    <div className="page container">
      <div className="page-head">
        <div>
          <h1>Produtos</h1>
          <p className="lead">Cadastre, edite e remova itens do catálogo.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>Novo produto</button>
      </div>

      {loading ? <div className="spinner" /> : (
        <table className="table">
          <thead>
            <tr>
              <th></th><th>Nome</th><th>Preço</th><th className="hide-sm">Estoque</th>
              <th className="hide-sm">Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.image_url ? <img className="thumb" src={p.image_url} alt="" /> : <div className="thumb" />}</td>
                <td>{p.name}</td>
                <td>{formatPrice(p.price_cents)}</td>
                <td className="hide-sm">{p.stock}</td>
                <td className="hide-sm"><span className={`tag ${p.active ? "" : "off"}`}>{p.active ? "Visível" : "Oculto"}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan="6"><div className="empty">Nenhum produto cadastrado.</div></td></tr>
            )}
          </tbody>
        </table>
      )}

      {editing && (
        <ProductModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
