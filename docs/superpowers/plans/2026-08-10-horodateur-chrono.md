# Chrono Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter la page Chronomètre — timer démarrable/arrêtable, lié à un client, qui persiste à la navigation et au redémarrage de l'app.

**Architecture:** Un `ChronoContext` placé dans `AppLayout` contient l'état du timer en cours (`entree`). Au démarrage de l'app, il vérifie en DB si une entrée `fin IS NULL` existe et la restaure. Chaque clic Démarrer/Arrêter écrit immédiatement en DB.

**Tech Stack:** React 18, React Context, Tauri 2, tauri-plugin-sql, SQLite, Vite, CSS BEM

---

## Fichiers

| Fichier | Action |
|---|---|
| `src/db/database.js` | Modifier — 5 nouvelles fonctions |
| `src/ChronoContext.jsx` | Créer — Provider + hook `useChrono` |
| `src/AppLayout.jsx` | Modifier — wrap avec `<ChronoProvider>` |
| `src/Sidebar.jsx` | Modifier — lire `useChrono`, afficher indicateur |
| `src/Sidebar.css` | Modifier — animation `.sidebar__pulse` |
| `src/pages/Chrono.jsx` | Remplacer stub — page complète |
| `src/pages/Chrono.css` | Créer |

---

## Task 1 — Fonctions DB

**Files:**
- Modify: `src/db/database.js`

- [ ] **Step 1 : Ajouter les 5 fonctions en bas de `src/db/database.js`**

```js
export async function getEntreeOuverte() {
  const d = await getDb();
  const rows = await d.select(
    "SELECT * FROM entrees_temps WHERE fin IS NULL LIMIT 1"
  );
  return rows[0] ?? null;
}

export async function demarrerEntree({ client_id, projet_id, debut }) {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO entrees_temps (client_id, projet_id, debut) VALUES (?, ?, ?)",
    [client_id, projet_id ?? null, debut]
  );
  return result.lastInsertId;
}

export async function arreterEntree(id, { fin, duree_minutes, duree_arrondie_minutes, note }) {
  const d = await getDb();
  await d.execute(
    "UPDATE entrees_temps SET fin=?, duree_minutes=?, duree_arrondie_minutes=?, note=? WHERE id=?",
    [fin, duree_minutes, duree_arrondie_minutes, note || null, id]
  );
}

export async function updateEntreeNote(id, note) {
  const d = await getDb();
  await d.execute(
    "UPDATE entrees_temps SET note=? WHERE id=?",
    [note || null, id]
  );
}

export async function getParametre(cle) {
  const d = await getDb();
  const rows = await d.select(
    "SELECT valeur FROM parametres WHERE cle = ?",
    [cle]
  );
  return rows[0]?.valeur ?? null;
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/db/database.js
git commit -m "feat(db): add chrono DB functions (entrees_temps + parametres)"
```

---

## Task 2 — ChronoContext

**Files:**
- Create: `src/ChronoContext.jsx`

- [ ] **Step 1 : Créer `src/ChronoContext.jsx`**

```jsx
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
```

- [ ] **Step 2 : Commit**

```bash
git add src/ChronoContext.jsx
git commit -m "feat: ChronoContext — timer global persistant + restauration au démarrage"
```

---

## Task 3 — AppLayout + Sidebar

**Files:**
- Modify: `src/AppLayout.jsx`
- Modify: `src/Sidebar.jsx`
- Modify: `src/Sidebar.css`

- [ ] **Step 1 : Modifier `src/AppLayout.jsx`**

Remplacer le contenu entier par :

```jsx
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { ChronoProvider } from "./ChronoContext";
import "./AppLayout.css";

export default function AppLayout() {
  return (
    <ChronoProvider>
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </ChronoProvider>
  );
}
```

- [ ] **Step 2 : Modifier `src/Sidebar.jsx`**

Remplacer le contenu entier par :

```jsx
import { NavLink } from "react-router-dom";
import { useChrono } from "./ChronoContext";
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
  const { entree } = useChrono();

  return (
    <nav className="sidebar">
      <div className="sidebar__logo">🌿 Horodateur</div>
      <ul className="sidebar__links">
        {LINKS.map(({ to, icon, label }) => (
          <li key={to}>
            <NavLink to={to} className={linkClass}>
              <span className="sidebar__icon">{icon}</span>
              {label}
              {to === "/chrono" && entree && (
                <span className="sidebar__pulse" aria-label="Chrono en cours" />
              )}
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
```

- [ ] **Step 3 : Ajouter dans `src/Sidebar.css`** (à la fin du fichier)

```css
.sidebar__pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7FD8A0;
  margin-left: auto;
  flex-shrink: 0;
  animation: sidebar-pulse 1.5s ease-in-out infinite;
}

@keyframes sidebar-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.25; }
}
```

- [ ] **Step 4 : Commit**

```bash
git add src/AppLayout.jsx src/Sidebar.jsx src/Sidebar.css
git commit -m "feat: wrap AppLayout avec ChronoProvider, indicateur pulsing dans sidebar"
```

---

## Task 4 — Page Chrono

**Files:**
- Create: `src/pages/Chrono.jsx`
- Create: `src/pages/Chrono.css`

- [ ] **Step 1 : Créer `src/pages/Chrono.jsx`**

```jsx
import { useState, useEffect, useRef } from "react";
import { getClients, getProjetsByClient } from "../db/database";
import { useChrono } from "../ChronoContext";
import "./Chrono.css";

function formatElapsed(debut) {
  const secs = Math.floor((Date.now() - new Date(debut)) / 1000);
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
```

- [ ] **Step 2 : Créer `src/pages/Chrono.css`**

```css
.chrono-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding-top: 24px;
  max-width: 480px;
  margin: 0 auto;
}

.chrono-page__title {
  font-family: var(--font-title);
  font-size: 22px;
  color: var(--color-text);
  font-weight: 700;
  align-self: flex-start;
}

.chrono-page__selects {
  display: flex;
  gap: 12px;
  width: 100%;
}

.chrono-page__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.chrono-page__field--note {
  width: 100%;
}

.chrono-page__field label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chrono-page__field select,
.chrono-page__field textarea {
  border: 1.5px solid #c8efd8;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--color-text);
  background: white;
  outline: none;
  font-family: var(--font-body);
  transition: border-color 0.15s;
}

.chrono-page__field select:focus,
.chrono-page__field textarea:focus {
  border-color: var(--color-accent);
}

.chrono-page__field select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.chrono-page__field textarea {
  resize: none;
  width: 100%;
  box-sizing: border-box;
}

.chrono-page__timer {
  font-family: var(--font-title);
  font-size: 64px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 4px;
  line-height: 1;
}

.chrono-page__btn {
  border: none;
  border-radius: 12px;
  padding: 14px 48px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-body);
  transition: opacity 0.15s, transform 0.1s;
}

.chrono-page__btn:hover:not(:disabled) {
  opacity: 0.85;
}

.chrono-page__btn:active:not(:disabled) {
  transform: scale(0.97);
}

.chrono-page__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chrono-page__btn--start {
  background: var(--color-accent);
  color: var(--color-sidebar);
}

.chrono-page__btn--stop {
  background: #e76f51;
  color: white;
}
```

- [ ] **Step 3 : Vérifier que les tests existants passent encore**

```bash
npm test
```

Attendu : 6 tests passent (ClientCard), 0 échecs.

- [ ] **Step 4 : Commit**

```bash
git add src/pages/Chrono.jsx src/pages/Chrono.css
git commit -m "feat(Chrono): page chronomètre complète — timer, client/projet, note, start/stop"
```

---

## Task 5 — Vérification manuelle

Lancer l'app (`npm run tauri dev`) et valider ces 8 scénarios :

- [ ] 1. Aller sur Chrono → bouton "Démarrer" grisé sans client sélectionné
- [ ] 2. Sélectionner un client → bouton s'active
- [ ] 3. Démarrer → timer tourne, dropdowns grisés, point vert dans la sidebar à côté de "Chrono"
- [ ] 4. Naviguer vers Clients → revenir à Chrono → timer toujours en cours, bonne valeur
- [ ] 5. Écrire une note → cliquer ailleurs → naviguer → revenir → note toujours là
- [ ] 6. Fermer l'app → rouvrir → timer reprend depuis le bon début, note toujours présente
- [ ] 7. Arrêter → timer reset à `00:00:00`, dropdowns réactivés, point vert disparu
- [ ] 8. Vérifier en SQLite que l'entrée a `fin`, `duree_minutes`, `duree_arrondie_minutes` (multiple de 15)
