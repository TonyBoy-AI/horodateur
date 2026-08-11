import { useState, useEffect, useRef } from "react";
import { getClients, getProjetsByClient } from "../db/database";
import { useChrono } from "../ChronoContext";
import "./Chrono.css";

function formatElapsed(debut) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(debut)) / 1000));
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function Chrono() {
  const { entree, demarrer, arreter, setNote } = useChrono();

  const [clients, setClients] = useState([]);
  const [projets, setProjets] = useState([]);
  const [clientId, setClientId] = useState("");
  const [projetId, setProjetId] = useState("");
  const [noteLocal, setNoteLocal] = useState("");
  const [elapsed, setElapsed] = useState("00:00:00");
  const intervalRef = useRef(null);

  // Charger clients au mount
  useEffect(() => {
    getClients().then(setClients).catch(console.error);
  }, []);

  // Charger projets quand le client change
  useEffect(() => {
    const id = entree ? entree.clientId : Number(clientId);
    if (!id) { setProjets([]); setProjetId(""); return; }
    getProjetsByClient(id).then(setProjets).catch(console.error);
  }, [clientId, entree?.clientId]);

  // Synchroniser UI quand entree est restaurée (ex: redémarrage app)
  useEffect(() => {
    if (entree) {
      setClientId(String(entree.clientId));
      setProjetId(entree.projetId ? String(entree.projetId) : "");
      setNoteLocal(entree.note ?? "");
    }
  }, [entree?.id]);

  // Timer tick
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!entree) { setElapsed("00:00:00"); return; }
    const tick = () => setElapsed(formatElapsed(entree.debut));
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [entree?.debut]);

  async function handleDemarrer() {
    await demarrer(
      Number(clientId),
      projetId ? Number(projetId) : null
    );
  }

  const running = !!entree;

  return (
    <div className="chrono-page">
      <h1 className="chrono-page__title">⏱️ Chronomètre</h1>

      <div className="chrono-page__selects">
        <div className="chrono-page__field">
          <label htmlFor="ch-client">Client *</label>
          <select
            id="ch-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={running}
          >
            <option value="">— Choisir un client —</option>
            {clients.filter((c) => c.actif).map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>

        <div className="chrono-page__field">
          <label htmlFor="ch-projet">Projet</label>
          <select
            id="ch-projet"
            value={projetId}
            onChange={(e) => setProjetId(e.target.value)}
            disabled={running}
          >
            <option value="">— Aucun projet —</option>
            {projets.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="chrono-page__timer">{elapsed}</div>

      <div className="chrono-page__field chrono-page__field--note">
        <label htmlFor="ch-note">Note</label>
        <textarea
          id="ch-note"
          rows={3}
          value={noteLocal}
          onChange={(e) => setNoteLocal(e.target.value)}
          onBlur={() => running && setNote(noteLocal)}
          placeholder="Description du travail effectué…"
        />
      </div>

      {running ? (
        <button className="chrono-page__btn chrono-page__btn--stop" onClick={arreter}>
          ⏹ Arrêter
        </button>
      ) : (
        <button
          className="chrono-page__btn chrono-page__btn--start"
          onClick={handleDemarrer}
          disabled={!clientId}
        >
          ▶ Démarrer
        </button>
      )}
    </div>
  );
}
