import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { RecommendationResponse } from "@conveyx/shared-types";
import { Alert } from "../components/ui";

const POPULAR = [
  "1 George St, Sydney NSW 2000",
  "100 Collins St, Melbourne VIC 3000",
  "Queen St, Brisbane QLD 4000",
];

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: "Automated fulfillment",
    desc: "Fast turnaround where authorities support API delivery",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      </svg>
    ),
    title: "Streamlined workflow",
    desc: "Search, select certificates, and place orders in one flow",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Compliance ready",
    desc: "Full audit trail for every matter and certificate",
  },
];

const CATEGORIES = [
  {
    title: "Council & LGA",
    desc: "Rates, zoning & land information certificates from local councils.",
    tags: ["Section 603", "Planning"],
    icon: "🏛",
  },
  {
    title: "Land Registry",
    desc: "Title searches, plans & dealings from state land information services.",
    tags: ["Title search", "Plan copy"],
    icon: "📋",
  },
  {
    title: "Body Corporate",
    desc: "Strata records, levies & owners corporation certificates.",
    tags: ["OC certificate", "Strata"],
    icon: "🏢",
  },
  {
    title: "Utilities",
    desc: "Water, sewer & special meter readings from water authorities.",
    tags: ["Water info", "SMR"],
    icon: "💧",
  },
  {
    title: "State Government",
    desc: "EPA, planning & statutory certificates from state agencies.",
    tags: ["EPA", "Planning"],
    icon: "⚖️",
  },
  {
    title: "Specialist",
    desc: "Niche providers and bundled settlement services.",
    tags: ["Other"],
    icon: "✦",
  },
];

export function SearchPage() {
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [includeBodyCorp, setIncludeBodyCorp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(value: string, bodyCorp = includeBodyCorp) {
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<RecommendationResponse>("/v1/intelligence/recommend", {
        identifier_type: "address",
        value: value.trim(),
        include_body_corp: bodyCorp,
      });
      sessionStorage.setItem(
        "cx_search",
        JSON.stringify({ address: value.trim(), includeBodyCorp: bodyCorp, recommendations: data })
      );
      navigate("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void runSearch(address);
  }

  return (
    <>
      <section className="hero">
        <span className="pill-label">Conveyancing · Property searches</span>
        <h1 className="hero-title">
          Streamlined orders for
          <br />
          <span className="text-gradient">property due diligence</span>
        </h1>
        <p className="hero-sub">
          Enter an address and get the right council, land registry, utility, and strata certificates
          — recommended automatically, fulfilled fast, and tracked for compliance.
        </p>

        {error && <Alert type="error" message={error} />}

        <form className="hero-search" onSubmit={(e) => void handleSearch(e)}>
          <span className="hero-search-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Search by address, lot/plan OR title reference…"
            aria-label="Property address"
          />
          <button type="submit" className="btn btn-primary hero-search-btn" disabled={loading}>
            {loading ? "Searching…" : "Find records"}
          </button>
        </form>

        <div className="hero-popular">
          <span className="hero-popular-label">Popular:</span>
          {POPULAR.map((a) => (
            <button
              key={a}
              type="button"
              className="text-link hero-popular-link"
              onClick={() => {
                setAddress(a);
                void runSearch(a);
              }}
            >
              {a.split(",")[0]}
            </button>
          ))}
        </div>

        <label className="hero-strata">
          <input
            type="checkbox"
            checked={includeBodyCorp}
            onChange={(e) => setIncludeBodyCorp(e.target.checked)}
          />
          Include body corporate / strata products
        </label>
      </section>

      <section id="features" className="features-row">
        {FEATURES.map((f) => (
          <div key={f.title} className="feature-card">
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      <section id="categories" className="categories-section">
        <div className="section-head">
          <h2>Explore categories</h2>
          <span className="text-link section-head-link">View all categories</span>
        </div>
        <div className="category-grid">
          {CATEGORIES.map((cat) => (
            <article key={cat.title} className="category-card">
              <div className="category-icon">{cat.icon}</div>
              <h3>{cat.title}</h3>
              <p>{cat.desc}</p>
              <div className="category-tags">
                {cat.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="promo-card">
        <div className="promo-content">
          <span className="pill-label pill-label-sm">Bulk data access</span>
          <h2>Enterprise API &amp; bulk ordering</h2>
          <p>
            Integrate ConveyX into your matter workflow. High-volume firms get dedicated support,
            webhooks, and consolidated invoicing.
          </p>
          <Link to="/login" className="btn btn-secondary">
            Request documentation
          </Link>
        </div>
        <div className="promo-visual" aria-hidden>
          <div className="promo-code">
            <span className="promo-code-line">POST /v1/orders</span>
            <span className="promo-code-line promo-code-dim">{`{ "entity_id": "…" }`}</span>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <p>© ConveyX · Streamlined conveyancing order workflow</p>
      </footer>
    </>
  );
}
