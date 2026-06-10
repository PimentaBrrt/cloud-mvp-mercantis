import { useEffect, useState } from "react";
import { api, formatPrice } from "../api.js";

function ProductCard({ p }) {
  const out = p.stock <= 0;
  return (
    <article className="card rise">
      <div className="card-media">
        {p.image_url
          ? <img src={p.image_url} alt={p.name} loading="lazy" />
          : <div className="ph">{p.name.charAt(0).toUpperCase()}</div>}
      </div>
      <div className="card-body">
        <h3>{p.name}</h3>
        {p.description && <p className="card-desc">{p.description}</p>}
        <div className="card-foot">
          <span className="price">{formatPrice(p.price_cents)}</span>
          <span className={`badge ${out ? "out" : ""}`}>{out ? "Esgotado" : `${p.stock} em estoque`}</span>
        </div>
      </div>
    </article>
  );
}

export default function Storefront() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listProducts()
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section className="hero">
        <span className="blob" />
        <div className="container hero-inner">
          <span className="eyebrow">Loja Mercantis</span>
          <h1>Produtos do dia a dia, <em>com preço justo</em>.</h1>
          <p>
            Escolhemos itens úteis para a casa e o trabalho e entregamos rápido.
            Veja o catálogo e encontre o que precisa.
          </p>
          <div className="hero-actions">
            <a href="#catalogo" className="btn btn-primary">Ver o catálogo</a>
          </div>
        </div>
      </section>

      <section className="section container" id="catalogo">
        <div className="section-head">
          <div>
            <h2>Catálogo</h2>
            <p>{products.length} {products.length === 1 ? "produto disponível" : "produtos disponíveis"}.</p>
          </div>
        </div>

        {loading && <div className="spinner" />}
        {error && <div className="alert alert-error">{error}</div>}
        {!loading && !error && products.length === 0 && (
          <div className="empty">Ainda não há produtos no catálogo.</div>
        )}

        <div className="grid">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>
    </>
  );
}
