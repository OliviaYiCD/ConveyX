import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/products", label: "Products" },
  { to: "/import", label: "Bulk import" },
  { to: "/orders", label: "Orders" },
  { to: "/invoices", label: "Invoices" },
  { to: "/packages", label: "Packages" },
  { to: "/providers", label: "Providers" },
  { to: "/required-data", label: "Required data" },
  { to: "/councils", label: "Councils" },
];

export function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">CX</span>
          <div>
            <strong>ConveyX</strong>
            <small>Admin Portal</small>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
