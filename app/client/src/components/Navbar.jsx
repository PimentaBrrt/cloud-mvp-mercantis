import { NavLink, Link, useNavigate } from "react-router-dom";

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();

  function logout() {
    onLogout();
    navigate("/");
  }

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          Mercantis<span className="dot">.</span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>Loja</NavLink>
          {user && <NavLink to="/gestao/produtos">Produtos</NavLink>}
          {user && <NavLink to="/gestao/usuarios">Usuários</NavLink>}
          {user ? (
            <button onClick={logout}>Sair</button>
          ) : (
            <NavLink to="/entrar" className="btn nav-cta">Entrar</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
