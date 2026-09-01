import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  getEntreeOuverte,
  demarrerEntree,
  arreterEntree,
  updateEntreeNote,
  updateEntreePause,
  getParametre,
} from "./db/database";

const ChronoContext = createContext(null);

export function ChronoProvider({ children }) {
  const [entree, setEntree] = useState(null);
  const [pauseInfo, setPauseInfoState] = useState({ pausedAt: null, totalPausedMs: 0 });
  const pauseInfoRef = useRef({ pausedAt: null, totalPausedMs: 0 });
  const entreeIdRef = useRef(null);
  const isStoppingRef = useRef(false);

  function setPauseInfo(next) {
    const val = typeof next === "function" ? next(pauseInfoRef.current) : next;
    pauseInfoRef.current = val;
    setPauseInfoState(val);
  }

  // Restauration au démarrage — lit aussi l'état de pause depuis la BD
  useEffect(() => {
    getEntreeOuverte()
      .then((e) => {
        if (e) {
          setEntree({
            id: e.id,
            debut: e.debut,
            clientId: e.client_id,
            projetId: e.projet_id ?? null,
            note: e.note ?? "",
          });
          entreeIdRef.current = e.id;
          const totalPausedMs = e.total_paused_ms ?? 0;
          const pausedAt = e.paused_at ? new Date(e.paused_at).getTime() : null;
          setPauseInfo({ pausedAt, totalPausedMs });
        }
      })
      .catch(console.error);
  }, []);

  // Réinitialiser la pause quand la session change
  useEffect(() => {
    entreeIdRef.current = entree?.id ?? null;
    if (!entree) setPauseInfo({ pausedAt: null, totalPausedMs: 0 });
  }, [entree?.id]);

  async function demarrer(clientId, projetId) {
    try {
      const debut = new Date().toISOString();
      const id = await demarrerEntree({
        client_id: clientId,
        projet_id: projetId ?? null,
        debut,
      });
      setEntree({ id, debut, clientId, projetId: projetId ?? null, note: "" });
    } catch (e) {
      console.error(e);
    }
  }

  async function arreter() {
    if (isStoppingRef.current || !entree) return;
    isStoppingRef.current = true;
    const current = entree;
    const pi = pauseInfoRef.current;
    try {
      const now = Date.now();
      const fin = new Date(now).toISOString();
      let totalPaused = pi.totalPausedMs;
      if (pi.pausedAt) totalPaused += now - pi.pausedAt;
      const rawMs = now - new Date(current.debut).getTime() - totalPaused;
      const duree = Math.round(rawMs / 60000);
      const arrondi = Number(await getParametre("arrondi_minutes")) || 15;
      const arrondie = Math.ceil(Math.max(duree, 1) / arrondi) * arrondi;
      await arreterEntree(current.id, {
        fin,
        duree_minutes: duree,
        duree_arrondie_minutes: arrondie,
        note: current.note,
      });
      setEntree(null);
    } catch (e) {
      console.error(e);
    } finally {
      isStoppingRef.current = false;
    }
  }

  async function setNote(texte) {
    if (!entree) return;
    const currentId = entree.id;
    setEntree((prev) => prev ? { ...prev, note: texte } : prev);
    await updateEntreeNote(currentId, texte).catch(console.error);
  }

  function pauserReprendre() {
    const id = entreeIdRef.current;
    setPauseInfo((prev) => {
      let next;
      if (prev.pausedAt) {
        next = { pausedAt: null, totalPausedMs: prev.totalPausedMs + (Date.now() - prev.pausedAt) };
      } else {
        next = { ...prev, pausedAt: Date.now() };
      }
      // Persister dans la BD
      if (id) {
        const pausedAtIso = next.pausedAt ? new Date(next.pausedAt).toISOString() : null;
        updateEntreePause(id, pausedAtIso, next.totalPausedMs).catch(console.error);
      }
      return next;
    });
  }

  const paused = !!pauseInfo.pausedAt;

  return (
    <ChronoContext.Provider value={{ entree, demarrer, arreter, setNote, paused, pauserReprendre, pauseInfo }}>
      {children}
    </ChronoContext.Provider>
  );
}

export function useChrono() {
  return useContext(ChronoContext);
}
