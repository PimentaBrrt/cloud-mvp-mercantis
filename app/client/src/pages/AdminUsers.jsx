import { useEffect, useState } from "react";
import { api } from "../api.js";

const EMPTY = { name: "", email: "", password: "", role: "staff" };

function UserModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = !!initial.id;

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = { name: form.name, email: form.email, role: form.role };
    if (form.password) payload.password = form.password;
    try {
      if (editing) await api.updateUser(initial.id, payload);
      else await api.createUser({ ...payload, password: form.password });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="panel modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{editing ? "Editar usuário" : "Novo usuário"}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={save}>
          <div className="field">
            <label>Nome</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          </div>
          <div className="form-row">
            <div className="field">
              <label>{editing ? "Nova senha (opcional)" : "Senha"}</label>
              <input type="password" value={form.password || ""} autoComplete="new-password"
                onChange={(e) => set("password", e.target.value)} required={!editing} />
            </div>
            <div className="field">
              <label>Perfil</label>
              <select value={form.role} onChange={(e) => set("role", e.target.value)}>
                <option value="staff">Equipe</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsers({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    api.listUsers().then(setUsers).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function remove(u) {
    if (!confirm(`Excluir o usuário "${u.name}"?`)) return;
    try {
      await api.deleteUser(u.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="page container">
      <div className="page-head">
        <div>
          <h1>Usuários</h1>
          <p className="lead">Controle quem tem acesso à gestão da loja.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY })}>Novo usuário</button>
      </div>

      {loading ? <div className="spinner" /> : (
        <table className="table">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th className="hide-sm">Perfil</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}{currentUser?.id === u.id && <span className="tag" style={{ marginLeft: 8 }}>você</span>}</td>
                <td>{u.email}</td>
                <td className="hide-sm"><span className={`tag ${u.role === "admin" ? "" : "staff"}`}>{u.role === "admin" ? "Administrador" : "Equipe"}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...u, password: "" })}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(u)}
                      disabled={currentUser?.id === u.id}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan="4"><div className="empty">Nenhum usuário cadastrado.</div></td></tr>
            )}
          </tbody>
        </table>
      )}

      {editing && (
        <UserModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
