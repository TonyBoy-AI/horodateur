import { useState, useEffect } from "react";
import { getProjetsByClient, updateEntree, deleteEntree, getParametre } from "../db/database";
import "./EntreePanel.css";

function isoToDate(isoStr) {
  return isoStr ? isoStr.slice(0, 10) : "";
}

function isoToTime(isoStr) {
  return isoStr ? isoStr.slice(11, 16) : "";
}

export default function EntreePanel({ entree, clients, onSaved, onDeleted, onClose }) {
  const [clientId, setClientId] = useState(String(entree.client_id));
  const [projetId, setProjetId] = useState(entree.projet_id ? String(entree.projet_id) : "");
  const [date, setDate] = useState(isoToDate(entree.debut));
  const [heureDebut, setHeureDebut] = useState(isoToTime(entree.debut));
  const [heureFin, setHeureFin] = useState(isoToTime(entree.fin));
  const [note, setNote] = useState(entree.note ?? "");
  const [projets, setProjets] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) { setProjets([]); setProjetId(""); return; }
    getProjetsByClient(Number(clientId)).then(setProjets).catch(console.error);
  }, [clientId]);

  async function handleSave() {
    if (!clientId || !date || !heureDebut || !heureFin) {
      setError("Client, date et heures sont requis.");
      return;
    }
    const debut = `${date}T${heureDebut}:00`;
    const fin = `${date}T${heureFin}:00`;
    if (new Date(fin) <= new Date(debut)) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    const duree_minutes = Math.round((new Date(fin) - new Date(debut)) / 60000);
    const arrondi = Number(await getParametre("arrondi_minutes")) || 15;
    const duree_arrondie_minutes = Math.ceil(Math.max(duree_minutes, 1) / arrondi) * arrondi;
    setError("");
    setSaving(true);
    try {
      await updateEntree(entree.id, {
        client_id: Number(clientId),
        projet_id: projetId ? Number(projetId) : null,
        debut,
        fin,
        duree_minutes,
        duree_arrondie_minutes,
        note: note || null,
      });
      onSaved();
    } catch (e) {
      console.error(e);
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Supprimer cette entrée ?")) return;
    try {
      await deleteEntree(entree.id);
      onDeleted();
    } catch (e) {
      setError(e.message || "Erreur lors de la suppression.");
    }
  }

  const isFacturee = Boolean(entree.facture_id);

  return (
    <aside className="entree-panel">
      <div className="entree-panel__header">
        <h2 className="entree-panel__title">Modifier l'entrée</h2>
        <button className="entree-panel__close" onClick={onClose} aria-label="✕">✕</button>
      </div>

      <div className="entree-panel__body">
        <div className="entree-panel__field">
          <label htmlFor="ep-client">Client *</label>
          <select id="ep-client" value={clientId} onChange={(e) => { setClientId(e.target.value); setProjetId(""); }}>
            <option value="">— Choisir —</option>
            {clients.filter((c) => c.actif).map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>

        <div className="entree-panel__field">
          <label htmlFor="ep-projet">Projet</label>
          <select id="ep-projet" value={projetId} onChange={(e) => setProjetId(e.target.value)} disabled={!clientId}>
            <option value="">— Aucun —</option>
            {projets.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>

        <div className="entree-panel__field">
          <label htmlFor="ep-date">Date *</label>
          <input id="ep-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="entree-panel__row">
          <div className="entree-panel__field">
            <label htmlFor="ep-debut">Début *</label>
            <input id="ep-debut" type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
          </div>
          <div className="entree-panel__field">
            <label htmlFor="ep-fin">Fin *</label>
            <input id="ep-fin" type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
          </div>
        </div>

        <div className="entree-panel__field">
          <label htmlFor="ep-note">Note</label>
          <textarea id="ep-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Description…" />
        </div>

        {error && <p className="entree-panel__error">{error}</p>}

        {isFacturee && (
          <p className="entree-panel__warning">Cette entrée est liée à une facture.</p>
        )}

        <div className="entree-panel__actions">
          <button className="entree-panel__btn-save" onClick={handleSave} disabled={saving}>
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>
          <button
            className="entree-panel__btn-delete"
            onClick={handleDelete}
            disabled={isFacturee}
            title={isFacturee ? "Entrée liée à une facture — suppression impossible" : "Supprimer"}
          >
            Supprimer
          </button>
        </div>
      </div>
    </aside>
  );
}
