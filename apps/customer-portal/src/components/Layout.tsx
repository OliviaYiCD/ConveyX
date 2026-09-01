import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../lib/session";

const FLOW_STEPS = [
  { path: "/", label: "Search", match: (p: string) => p === "/" },
  { path: "/results", label: "Products", match: (p: string) => p === "/results" },
  { path: "/checkout", label: "Checkout", match: (p: string) => p === "/checkout" },
  {
    path: "/confirmation",
    label: "Confirmed",
    match: (p: string) => p.startsWith("/confirmation"),
  },
];

function stepIndex(pathname: string): number {
  if (pathname.startsWith("/confirmation")) return 3;
  const i = FLOW_STEPS.findIndex((s) => s.match(pathname));
  return i >= 0 ? i : 0;
}

function isFlowPage(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/results" ||
    pathname === "/checkout" ||
    pathname.startsWith("/confirmation")
  );
}

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getSession();
  const isHome = location.pathname === "/";
  const isCheckout = location.pathname === "/checkout";
  const isAuth = location.pathname === "/login";
  const inFlow = isFlowPage(location.pathname) && !isHome;
  const onOrders = location.pathname.startsWith("/orders");
  const current = stepIndex(location.pathname);

  function handleSignOut() {
    clearSession();
    navigate("/");
  }

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden />

      <header className={`site-header ${isHome ? "site-header-marketing" : ""}`}>
        <div className="site-header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </span>
            <span className="brand-text">ConveyX</span>
          </Link>

          {isHome && (
            <nav className="marketing-nav" aria-label="Main">
              <a href="#categories" className="marketing-nav-link">
                Product
              </a>
              <a href="#features" className="marketing-nav-link">
                Solutions
              </a>
              <span className="marketing-nav-link marketing-nav-muted">Pricing</span>
              <span className="marketing-nav-link marketing-nav-muted">About</span>
            </nav>
          )}

          <div className="site-nav">
            {session.mode === "account" ? (
              <>
                <span className="nav-user">{session.name ?? session.email}</span>
                <Link to="/orders" className={`nav-link ${onOrders ? "nav-link-active" : ""}`}>
                  My orders
                </Link>
                <button type="button" className="nav-link nav-btn" onClick={handleSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">
                  Login
                </Link>
                <Link to="/" className="btn btn-primary btn-sm">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={`main ${isHome ? "main-wide" : ""} ${isCheckout ? "main-checkout" : ""} ${isAuth ? "main-auth" : ""}`}>
        {inFlow && (
          <nav className="stepper" aria-label="Order progress">
            {FLOW_STEPS.slice(1).map((step, i) => {
              const idx = i + 1;
              const done = idx < current;
              const active = idx === current;
              return (
                <div
                  key={step.path}
                  className={`stepper-item ${done ? "stepper-done" : ""} ${active ? "stepper-active" : ""}`}
                >
                  <span className="stepper-dot" aria-hidden>
                    {done ? "✓" : idx}
                  </span>
                  <span className="stepper-label">{step.label}</span>
                  {i < FLOW_STEPS.length - 2 && <span className="stepper-line" aria-hidden />}
                </div>
              );
            })}
          </nav>
        )}

        <div className="page-content">
          <Outlet />
        </div>
      </main>

      {!isHome && (
        <footer className="site-footer">
          <p>ConveyX · Streamlined conveyancing order workflow</p>
        </footer>
      )}
    </div>
  );
}
