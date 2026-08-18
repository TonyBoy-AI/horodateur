import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  getEntreeOuverte,
  demarrerEntree,
  arreterEntree,
  updateEntreeNote,
  getParametre,
} from "./db/database";

const ChronoContext = createContext(null);

export function ChronoProvider({ children }) {
  const [entree, setEntree] = useState(null);
  const [pauseInfo, setPauseInfoState] = useState({ pausedAt: null, totalPausedMs: 0 });
  const pauseInfoRef = useRef({ pausedAt: null, totalPausedMs: 0 });
  const isStoppingRef = useRef(false);

  function setPauseInfo(next) {
    const val = typeof next === "function" ? next(pauseInfoRef.current) : next;
    pauseInfoRef.current = val;
    setPauseInfoState(val);
  }

  // Restauration au démarrage de l'app
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
        }
      })
      .catch(console.error);
  }, []);

  // Réinitialiser la pause quand la session change
  useEffect(() => {
    setPauseInfo({ pausedAt: null, totalPausedMs: 0 });
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
    setPauseInfo((prev) => {
      if (prev.pausedAt) {
        return { pausedAt: null, totalPausedMs: prev.totalPausedMs + (Date.now() - prev.pausedAt) };
      } else {
        return { ...prev, pausedAt: Date.now() };
      }
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
