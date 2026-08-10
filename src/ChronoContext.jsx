import { createContext, useContext, useState, useEffect } from "react";
import {
  getEntreeOuverte,
  demarrerEntree,
  arreterEntree,
  updateEntreeNote,
  getParametre,
} from "./db/database";

const ChronoContext = createContext(null);

export function ChronoProvider({ children }) {
  // entree: { id, debut, clientId, projetId, note } | null
  const [entree, setEntree] = useState(null);

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
    let current = null;
    setEntree((prev) => { current = prev; return prev; });
    if (!current) return;
    try {
      const fin = new Date().toISOString();
      const duree = Math.round((new Date(fin) - new Date(current.debut)) / 60000);
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
    }
  }

  async function setNote(texte) {
    let currentId = null;
    setEntree((prev) => {
      if (!prev) return prev;
      currentId = prev.id;
      return { ...prev, note: texte };
    });
    if (currentId) {
      await updateEntreeNote(currentId, texte).catch(console.error);
    }
  }

  return (
    <ChronoContext.Provider value={{ entree, demarrer, arreter, setNote }}>
      {children}
    </ChronoContext.Provider>
  );
}

export function useChrono() {
  return useContext(ChronoContext);
}
