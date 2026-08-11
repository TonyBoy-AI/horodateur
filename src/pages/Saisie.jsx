import { useState, useEffect } from "react";
import { getClients, getProjetsByClient, createEntreeComplete, getEntreesRecentes, getParametre } from "../db/database";
import "./Saisie.css";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDuration(minutes) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
}

function formatTime(isoStr) {
  return isoStr ? isoStr.slice(11, 16) : "—";
}

function formatDate(isoStr) {
  return isoStr ? isoStr.slice(0, 10) : "—";
}

export default function Saisie() {
  const [clients, setClients] = useState([]);
  const [projets, setProjets] = useState([]);
  const [clientId, setClientId] = useState("");
  const [projetId, setProjetId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [heureDebut, setHeureDebut] = useState("");
  const [heureFin, setHeureFin] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [entrees, setEntrees] = useState([]);

  useEffect(() => {
    getClients().then(setClients).catch(console.error);
    loadEntrees();
  }, []);

  useEffect(() => {
    if (!clientId) { setProjets([]); setProjetId(""); return; }
    getProjetsByClient(Number(clientId)).then(setProjets).catch(console.error);
  }, [clientId]);

  function loadEntrees() {
    getEntreesRecentes(10).then(setEntrees).catch(console.error);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!clientId) { setError("Veuillez sélectionner un client."); return; }
    if (!heureDebut || !heureFin) { setError("Veuillez saisir les heures de début et de fin."); return; }

    const debut = `${date}T${heureDebut}:00`;
    const fin = `${date}T${heureFin}:00`;

    if (new Date(fin) <= new Date(debut)) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }

    const duree_minutes = Math.round((new Date(fin) - new Date(debut)) / 60000);
    const arrondi = Number(await getParametre("arrondi_minutes")) || 15;
    const duree_arrondie_minutes = Math.ceil(Math.max(duree_minutes, 1) / arrondi) * arrondi;

    await createEntreeComplete({
      client_id: Number(clientId),
      projet_id: projetId ? Number(projetId) : null,
      debut,
      fin,
      duree_minutes,
      duree_arrondie_minutes,
      note: note || null,
    });

    setClientId("");
    setProjetId("");
    setHeureDebut("");
    setHeureFin("");
    setNote("");
    setDate(todayStr());
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    loadEntrees();
  }

  return (
    <div className="saisie-page">
      <h1 className="saisie-page__title">✏️ Saisie manuelle</h1>

      <form className="saisie-page__form" onSubmit={handleSubmit} noValidate>
        <div className="saisie-page__row">
          <div className="saisie-page__field">
            <label htmlFor="s-client">Client *</label>
            <select id="s-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— Choisir —</option>
              {clients.filter((c) => c.actif).map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div className="saisie-page__field">
            <label htmlFor="s-projet">Projet</label>
            <select id="s-projet" value={projetId} onChange={(e) => setProjetId(e.target.value)} disabled={!clientId}>
              <option value="">— Aucun —</option>
              {projets.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="saisie-page__row">
          <div className="saisie-page__field">
            <label htmlFor="s-date">Date</label>
            <input id="s-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="saisie-page__field">
            <label htmlFor="s-debut">Début</label>
            <input id="s-debut" type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
          </div>

          <div className="saisie-page__field">
            <label htmlFor="s-fin">Fin</label>
            <input id="s-fin" type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
          </div>
        </div>

        <div className="saisie-page__field saisie-page__field--full">
          <label htmlFor="s-note">Note</label>
          <textarea id="s-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Description du travail…" />
        </div>

        {error && <p className="saisie-page__error" role="alert">{error}</p>}
        {success && <p className="saisie-page__success" role="status">✓ Entrée ajoutée</p>}

        <button type="submit" className="saisie-page__btn">Ajouter l'entrée</button>
      </form>

      {entrees.length > 0 && (
        <section className="saisie-page__recents">
          <h2 className="saisie-page__recents-title">Entrées récentes</h2>
          <ul className="saisie-page__list">
            {entrees.map((e) => (
              <li key={e.id} className="saisie-page__item">
                <span className="saisie-page__item-date">{formatDate(e.debut)}</span>
                <span className="saisie-page__item-times">{formatTime(e.debut)} – {formatTime(e.fin)}</span>
                <span className="saisie-page__item-client">
                  {e.client_nom}{e.projet_nom ? ` · ${e.projet_nom}` : ""}
                </span>
                <span className="saisie-page__item-duree">
                  {formatDuration(e.duree_arrondie_minutes ?? e.duree_minutes)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
