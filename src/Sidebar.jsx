import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const LINKS = [
  { to: "/chrono", icon: "⏱️", label: "Chrono" },
  { to: "/saisie", icon: "✏️", label: "Saisie" },
  { to: "/clients", icon: "👥", label: "Clients" },
  { to: "/rapports", icon: "📊", label: "Rapports" },
  { to: "/factures", icon: "🧾", label: "Factures" },
];

function linkClass({ isActive }) {
  return "sidebar__link" + (isActive ? " sidebar__link--active" : "");
}

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar__logo">🌿 Horodateur</div>
      <ul className="sidebar__links">
        {LINKS.map(({ to, icon, label }) => (
          <li key={to}>
            <NavLink to={to} className={linkClass}>
              <span className="sidebar__icon">{icon}</span>
              {label}
            </NavLink>
          </li>
        ))}
        <li style={{ marginTop: "auto" }}>
          <NavLink to="/parametres" className={linkClass}>
            <span className="sidebar__icon">⚙️</span>
            Paramètres
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
