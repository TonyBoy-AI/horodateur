import { useState, useEffect } from "react";
import { getClients, getEntreesParPeriode } from "../db/database";
import EntreePanel from "../components/EntreePanel";
import "./Rapports.css";

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return {
    debut: monday.toISOString().slice(0, 10),
    fin: nextMonday.toISOString().slice(0, 10),
  };
}

function getMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    debut: first.toISOString().slice(0, 10),
    fin: next.toISOString().slice(0, 10),
  };
}

function formatDuration(minutes) {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? m : ""}` : `${m}m`;
}

function formatDate(isoStr) {
  return isoStr ? isoStr.slice(0, 10) : "—";
}

function computeResume(entrees) {
  const totalMinutes = entrees.reduce(
    (sum, e) => sum + (e.duree_arrondie_minutes ?? e.duree_minutes ?? 0),
    0
  );
  const byClientMap = {};
  for (const e of entrees) {
    if (!byClientMap[e.client_id]) {
      byClientMap[e.client_id] = { nom: e.client_nom, taux: e.client_taux ?? 0, minutes: 0 };
    }
    byClientMap[e.client_id].minutes += e.duree_arrondie_minutes ?? e.duree_minutes ?? 0;
  }
  return { totalMinutes, byClient: Object.values(byClientMap) };
}

export default function Rapports() {
  const [clients, setClients] = useState([]);
  const [clientFilter, setClientFilter] = useState("");
  const [periode, setPeriode] = useState("mois");
  const [dateDebut, setDateDebut] = useState(() => getMonthRange().debut);
  const [dateFin, setDateFin] = useState(() => getMonthRange().fin);
  const [entrees, setEntrees] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    getClients().then(setClients).catch(console.error);
  }, []);

  useEffect(() => {
    setSelectedId(null);
    let debut, fin;
    if (periode === "semaine") {
      ({ debut, fin } = getWeekRange());
    } else if (periode === "mois") {
      ({ debut, fin } = getMonthRange());
    } else {
      debut = dateDebut;
      fin = dateFin;
    }
    if (!debut || !fin) return;
    getEntreesParPeriode({
      debut: `${debut}T00:00:00`,
      fin: `${fin}T00:00:00`,
      client_id: clientFilter ? Number(clientFilter) : null,
    })
      .then(setEntrees)
      .catch(console.error);
  }, [periode, dateDebut, dateFin, clientFilter]);

  function loadEntrees() {
    let debut, fin;
    if (periode === "semaine") {
      ({ debut, fin } = getWeekRange());
    } else if (periode === "mois") {
      ({ debut, fin } = getMonthRange());
    } else {
      debut = dateDebut;
      fin = dateFin;
    }
    if (!debut || !fin) return;
    getEntreesParPeriode({
      debut: `${debut}T00:00:00`,
      fin: `${fin}T00:00:00`,
      client_id: clientFilter ? Number(clientFilter) : null,
    })
      .then(setEntrees)
      .catch(console.error);
  }

  const { totalMinutes, byClient } = computeResume(entrees);
  const selectedEntree = entrees.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="rapports-page">
      <h1 className="rapports-page__title">📊 Rapports</h1>

      <div className="rapports-page__filters">
        <div className="rapports-page__periode">
          {[
            { key: "semaine", label: "Cette semaine" },
            { key: "mois", label: "Ce mois" },
            { key: "custom", label: "Personnalisé" },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`rapports-page__periode-btn${periode === key ? " rapports-page__periode-btn--active" : ""}`}
              onClick={() => setPeriode(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {periode === "custom" && (
          <div className="rapports-page__custom-dates">
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              aria-label="Date début"
            />
            <span className="rapports-page__arrow">→</span>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              aria-label="Date fin"
            />
          </div>
        )}

        <select
          className="rapports-page__client-filter"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          aria-label="Filtrer par client"
        >
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>» {c.nom}</option>
          ))}
        </select>
      </div>

      <div className="rapports-page__resume">
        <div className="rapports-page__total">
          <span className="rapports-page__total-label">Total</span>
          <span className="rapports-page__total-value">{formatDuration(totalMinutes)}</span>
        </div>

        {byClient.length > 0 && (
          <ul className="rapports-page__by-client">
            {byClient.map((c) => (
              <li key={c.nom} className="rapports-page__client-row">
                <span className="rapports-page__client-name">{c.nom}</span>
                <span className="rapports-page__client-hours">{formatDuration(c.minutes)}</span>
                <span className="rapports-page__client-montant">
                  {c.taux > 0 ? `${((c.minutes / 60) * c.taux).toFixed(2)} $` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {entrees.length > 0 ? (
        <section className="rapports-page__entries">
          <h2 className="rapports-page__entries-title">Détail des entrées</h2>
          <div className="rapports-page__body">
            <ul className="rapports-page__list">
              {entrees.map((e) => (
                <li
                  key={e.id}
                  className={`rapports-page__item${selectedId === e.id ? " rapports-page__item--selected" : ""}`}
                  onClick={() => setSelectedId((prev) => (prev === e.id ? null : e.id))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => ev.key === "Enter" && setSelectedId((prev) => (prev === e.id ? null : e.id))}
                >
                  <span className="rapports-page__item-date">{formatDate(e.debut)}</span>
                  <span className="rapports-page__item-client">
                    {clients.length > 1 ? `${e.client_nom}${e.projet_nom ? ` · ${e.projet_nom}` : ""}` : (e.projet_nom || "—")}
                  </span>
                  <span className="rapports-page__item-duree">
                    {formatDuration(e.duree_arrondie_minutes ?? e.duree_minutes)}
                  </span>
                  {e.note && <span className="rapports-page__item-note">{e.note}</span>}
                </li>
              ))}
            </ul>

            {selectedEntree && (
              <EntreePanel
                key={selectedEntree.id}
                entree={selectedEntree}
                clients={clients}
                onSaved={() => { setSelectedId(null); loadEntrees(); }}
                onDeleted={() => { setSelectedId(null); loadEntrees(); }}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        </section>
      ) : (
        <p className="rapports-page__empty">Aucune entrée pour cette période.</p>
      )}
    </div>
  );
}
