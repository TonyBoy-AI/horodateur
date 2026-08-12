import "./ClientCard.css";

export default function ClientCard({ client, isSelected, onClick }) {
  const classes = [
    "client-card",
    isSelected ? "client-card--selected" : "",
    !client.actif ? "client-card--inactive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{ borderColor: isSelected ? client.couleur : "transparent" }}
      onClick={onClick}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
    >
      <div
        className="client-card__avatar"
        style={{ background: client.couleur + "33", color: client.couleur }}
      >
        🏢
      </div>
      <div className="client-card__info">
        <h3 className="client-card__name">{client.nom}</h3>
        <p className="client-card__rate">{client.taux_horaire} $/h</p>
      </div>
      <span className={`client-card__badge${!client.actif ? " client-card__badge--inactive" : ""}`}>
        {client.actif ? "Actif" : "Inactif"}
      </span>
    </div>
  );
}
