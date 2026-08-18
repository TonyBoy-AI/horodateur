import { useState, useEffect, useRef } from "react";
import { getClients, getProjetsByClient } from "../db/database";
import { useChrono } from "../ChronoContext";
import "./Chrono.css";

function formatElapsed(debut, totalPausedMs, pausedAt) {
  const endTime = pausedAt ? pausedAt : Date.now();
  const secs = Math.max(0, Math.floor((endTime - new Date(debut).getTime() - totalPausedMs) / 1000));
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function Chrono() {
  const { entree, demarrer, arreter, setNote, paused, pauserReprendre, pauseInfo } = useChrono();

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
    } else {
      setClientId("");
      setProjetId("");
      setNoteLocal("");
    }
  }, [entree?.id]);

  // Timer tick — s'arrête quand en pause
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!entree) { setElapsed("00:00:00"); return; }
    const tick = () => setElapsed(formatElapsed(entree.debut, pauseInfo.totalPausedMs, pauseInfo.pausedAt));
    tick();
    if (paused) return;
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [entree?.debut, paused, pauseInfo.totalPausedMs]);

  async function handleDemarrer() {
    await demarrer(Number(clientId), projetId ? Number(projetId) : null);
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
            value={running ? String(entree.clientId) : clientId}
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
            value={running ? String(entree.projetId ?? "") : projetId}
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

      <div className={`chrono-page__timer${paused ? " chrono-page__timer--paused" : ""}`}>
        {elapsed}
      </div>
      {paused && <span className="chrono-page__pause-badge">EN PAUSE</span>}

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
        <div className="chrono-page__actions">
          <button
            className={`chrono-page__btn ${paused ? "chrono-page__btn--resume" : "chrono-page__btn--pause"}`}
            onClick={pauserReprendre}
          >
            {paused ? "▶ Reprendre" : "⏸ Pause"}
          </button>
          <button className="chrono-page__btn chrono-page__btn--stop" onClick={arreter}>
            ⏹ Arrêter
          </button>
        </div>
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
