import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { auth } from "./api.js";
import Navbar from "./components/Navbar.jsx";
import Storefront from "./pages/Storefront.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import AdminProducts from "./pages/AdminProducts.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";

function RequireAuth({ user, children }) {
  const location = useLocation();
  if (!user) return <Navigate to="/entrar" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(auth.user);

  function handleLogin(u) { auth.user = u; setUser(u); }
  function handleLogout() { auth.clear(); setUser(null); }

  return (
    <>
      <Navbar user={user} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Storefront />} />
        <Route path="/entrar" element={<Login user={user} onLogin={handleLogin} />} />
        <Route path="/cadastrar" element={<Register user={user} onLogin={handleLogin} />} />
        <Route
          path="/gestao/produtos"
          element={<RequireAuth user={user}><AdminProducts /></RequireAuth>}
        />
        <Route
          path="/gestao/usuarios"
          element={<RequireAuth user={user}><AdminUsers currentUser={user} /></RequireAuth>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="footer container">
        <span>Mercantis · loja de demonstração</span>
        <span>MVP na AWS · TI5A Cloud Computing</span>
      </footer>
    </>
  );
}
