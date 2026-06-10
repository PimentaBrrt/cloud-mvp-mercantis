import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { api, auth } from "../api.js";

export default function Register({ user, onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (user) return <Navigate to="/gestao/produtos" replace />;

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { token, user: u } = await api.register(name.trim(), email.trim(), password);
      auth.token = token;
      onLogin(u);
      navigate("/gestao/produtos", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="panel auth-card rise">
        <h1>Criar conta</h1>
        <p className="sub">Cadastre-se para acessar a gestão da Mercantis.</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" value={name} autoComplete="name"
              onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <div className="pw-wrap">
              <input id="password" type={showPw ? "text" : "password"} value={password}
                autoComplete="new-password" minLength={6}
                onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}>
                {showPw ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Criando..." : "Criar conta"}
          </button>
        </form>
        <p className="auth-alt">
          Já tem conta? <Link to="/entrar">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
