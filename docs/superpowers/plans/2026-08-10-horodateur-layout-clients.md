# Horodateur — Layout général + Admin Clients — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer la structure React complète (routes, layout sidebar, CSS global) et l'écran Admin Clients avec CRUD complet (cartes + panneau latéral + gestion des projets par client).

**Architecture:** AppLayout wraps toutes les routes via `<Outlet />`. La sidebar est fixe. Les données clients/projets sont lues depuis SQLite via `src/db/database.js` (helpers async). La page `Clients.jsx` détient l'état local ; les composants enfants (ClientCard, ClientPanel, ProjetsList) sont purement présentationnels ou reçoivent des callbacks. Le panneau latéral glisse depuis la droite avec une animation CSS.

**Tech Stack:** React 18, react-router-dom v6, Vite, Vitest, @testing-library/react, tauri-plugin-sql (SQLite via `@tauri-apps/plugin-sql`)

---

## File Map

```
src/
  main.jsx                       — BrowserRouter + toutes les routes
  AppLayout.jsx                  — sidebar + <Outlet />
  AppLayout.css
  Sidebar.jsx                    — liens NavLink avec highlight actif
  Sidebar.css
  index.css                      — variables CSS globales + reset
  db/
    database.js                  — singleton DB + helpers SQL async
  pages/
    Clients.jsx                  — état (liste, panneau), orchestration DB
    Clients.css
    Chrono.jsx                   — stub
    Saisie.jsx                   — stub
    Rapports.jsx                 — stub
    Factures.jsx                 — stub
    Parametres.jsx               — stub
  components/
    ClientCard.jsx               — carte présentationnelle (props only)
    ClientCard.css
    ClientPanel.jsx              — formulaire client + toggle actif + swatches
    ClientPanel.css
    ProjetsList.jsx              — liste projets inline-éditable
    ProjetsList.css
tests/
  ClientCard.test.jsx
```

---

## Task 1: Vitest + CSS global

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `src/index.css`
- Create: `tests/ClientCard.test.jsx` (fichier vide pour l'instant, complété en Task 4)

- [ ] **Step 1 : Installer les dépendances de test**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: résolution sans erreur, `package.json` mis à jour.

- [ ] **Step 2 : Ajouter la config Vitest dans `vite.config.js`**

Remplace le contenu de `vite.config.js` par :

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_PLATFORM == "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
  },
});
```

- [ ] **Step 3 : Créer `tests/setup.js`**

```js
import "@testing-library/jest-dom";
```

- [ ] **Step 4 : Ajouter le script `test` dans `package.json`**

Dans `package.json`, ajouter dans `"scripts"` :

```json
"test": "vitest run"
```

- [ ] **Step 5 : Créer `src/index.css`**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --color-bg: #E8F8EE;
  --color-sidebar: #1b4332;
  --color-sidebar-active: #2d6a4f;
  --color-accent: #7FD8A0;
  --color-surface: #d8f3dc;
  --color-text: #1b4332;
  --color-text-muted: #6b9e7e;
  --font-title: 'Fredoka', sans-serif;
  --font-body: 'Quicksand', sans-serif;
  --radius: 12px;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

body {
  font-family: var(--font-body);
  background: var(--color-bg);
  color: var(--color-text);
  height: 100vh;
  overflow: hidden;
}

#root {
  height: 100vh;
}

button {
  font-family: var(--font-body);
}

input, textarea, select {
  font-family: var(--font-body);
}
```

- [ ] **Step 6 : Vérifier que Vitest tourne (sans tests pour l'instant)**

```bash
npm test
```

Expected output : `No test files found` ou `0 tests passed` — pas d'erreur de config.

- [ ] **Step 7 : Commit**

```bash
git add vite.config.js package.json package-lock.json tests/setup.js src/index.css
git commit -m "chore: setup Vitest + CSS variables globales"
```

---

## Task 2: Database layer (`src/db/database.js`)

**Files:**
- Create: `src/db/database.js`

Note : ce fichier utilise `@tauri-apps/plugin-sql` qui nécessite le runtime Tauri — pas testable en jsdom. Les tests sont manuels (Task 7).

- [ ] **Step 1 : Créer `src/db/database.js`**

```js
import Database from "@tauri-apps/plugin-sql";

let db = null;

async function getDb() {
  if (!db) db = await Database.load("sqlite:horodateur.db");
  return db;
}

export async function getClients() {
  const d = await getDb();
  return d.select("SELECT * FROM clients ORDER BY actif DESC, nom ASC");
}

export async function getProjetsByClient(clientId) {
  const d = await getDb();
  return d.select(
    "SELECT * FROM projets WHERE client_id = ? ORDER BY nom ASC",
    [clientId]
  );
}

export async function createClient({ nom, taux_horaire, courriel, adresse, couleur, actif }) {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO clients (nom, taux_horaire, courriel, adresse, couleur, actif) VALUES (?, ?, ?, ?, ?, ?)",
    [nom, taux_horaire, courriel || null, adresse || null, couleur || "#7FD8A0", actif ? 1 : 0]
  );
  return result.lastInsertId;
}

export async function updateClient(id, { nom, taux_horaire, courriel, adresse, couleur, actif }) {
  const d = await getDb();
  await d.execute(
    "UPDATE clients SET nom=?, taux_horaire=?, courriel=?, adresse=?, couleur=?, actif=? WHERE id=?",
    [nom, taux_horaire, courriel || null, adresse || null, couleur, actif ? 1 : 0, id]
  );
}

export async function deleteClient(id) {
  const d = await getDb();
  await d.execute("DELETE FROM clients WHERE id = ?", [id]);
}

export async function createProjet({ client_id, nom, taux_horaire }) {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO projets (client_id, nom, taux_horaire) VALUES (?, ?, ?)",
    [client_id, nom, taux_horaire ?? null]
  );
  return result.lastInsertId;
}

export async function updateProjet(id, { nom, taux_horaire }) {
  const d = await getDb();
  await d.execute(
    "UPDATE projets SET nom=?, taux_horaire=? WHERE id=?",
    [nom, taux_horaire ?? null, id]
  );
}

export async function deleteProjet(id) {
  const d = await getDb();
  await d.execute("DELETE FROM projets WHERE id = ?", [id]);
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/db/database.js
git commit -m "feat: database helpers (clients, projets CRUD)"
```

---

## Task 3: Routing + AppLayout + Sidebar + pages stub

**Files:**
- Create: `src/main.jsx`
- Create: `src/AppLayout.jsx`
- Create: `src/AppLayout.css`
- Create: `src/Sidebar.jsx`
- Create: `src/Sidebar.css`
- Create: `src/pages/Chrono.jsx`
- Create: `src/pages/Saisie.jsx`
- Create: `src/pages/Rapports.jsx`
- Create: `src/pages/Factures.jsx`
- Create: `src/pages/Parametres.jsx`

- [ ] **Step 1 : Créer `src/main.jsx`**

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./AppLayout";
import Clients from "./pages/Clients";
import Chrono from "./pages/Chrono";
import Saisie from "./pages/Saisie";
import Rapports from "./pages/Rapports";
import Factures from "./pages/Factures";
import Parametres from "./pages/Parametres";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/chrono" replace />} />
        <Route path="chrono" element={<Chrono />} />
        <Route path="saisie" element={<Saisie />} />
        <Route path="clients" element={<Clients />} />
        <Route path="rapports" element={<Rapports />} />
        <Route path="factures" element={<Factures />} />
        <Route path="parametres" element={<Parametres />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
```

- [ ] **Step 2 : Créer `src/AppLayout.jsx`**

```jsx
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import "./AppLayout.css";

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3 : Créer `src/AppLayout.css`**

```css
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.app-main {
  flex: 1;
  background: var(--color-bg);
  overflow-y: auto;
  padding: 24px;
}
```

- [ ] **Step 4 : Créer `src/Sidebar.jsx`**

```jsx
import { NavLink } from "react-router-dom";
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
  return (
    <nav className="sidebar">
      <div className="sidebar__logo">🌿 Horodateur</div>
      <ul className="sidebar__links">
        {LINKS.map(({ to, icon, label }) => (
          <li key={to}>
            <NavLink to={to} className={linkClass}>
              <span className="sidebar__icon">{icon}</span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <NavLink to="/parametres" className={linkClass} style={{ marginTop: "auto" }}>
        <span className="sidebar__icon">⚙️</span>
        Paramètres
      </NavLink>
    </nav>
  );
}
```

- [ ] **Step 5 : Créer `src/Sidebar.css`**

```css
.sidebar {
  width: 140px;
  flex-shrink: 0;
  background: var(--color-sidebar);
  display: flex;
  flex-direction: column;
  padding: 16px 0;
}

.sidebar__logo {
  font-family: var(--font-title);
  font-size: 15px;
  color: var(--color-accent);
  padding: 0 16px 20px;
  font-weight: 600;
  line-height: 1.2;
}

.sidebar__links {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar__link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  color: #d8f3dc;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  border-radius: 0 10px 10px 0;
  margin-right: 8px;
  transition: background 0.15s;
}

.sidebar__link:hover {
  background: rgba(255, 255, 255, 0.08);
}

.sidebar__link--active {
  background: var(--color-sidebar-active);
  color: white;
  font-weight: 700;
}

.sidebar__icon {
  font-size: 16px;
  line-height: 1;
}
```

- [ ] **Step 6 : Créer les pages stub**

Créer chacun de ces fichiers avec le contenu correspondant :

`src/pages/Chrono.jsx` :
```jsx
export default function Chrono() {
  return (
    <p style={{ fontFamily: "var(--font-title)", fontSize: 22, color: "var(--color-text)" }}>
      ⏱️ Chronomètre — à venir
    </p>
  );
}
```

`src/pages/Saisie.jsx` :
```jsx
export default function Saisie() {
  return (
    <p style={{ fontFamily: "var(--font-title)", fontSize: 22, color: "var(--color-text)" }}>
      ✏️ Saisie manuelle — à venir
    </p>
  );
}
```

`src/pages/Rapports.jsx` :
```jsx
export default function Rapports() {
  return (
    <p style={{ fontFamily: "var(--font-title)", fontSize: 22, color: "var(--color-text)" }}>
      📊 Rapports — à venir
    </p>
  );
}
```

`src/pages/Factures.jsx` :
```jsx
export default function Factures() {
  return (
    <p style={{ fontFamily: "var(--font-title)", fontSize: 22, color: "var(--color-text)" }}>
      🧾 Facturation — à venir
    </p>
  );
}
```

`src/pages/Parametres.jsx` :
```jsx
export default function Parametres() {
  return (
    <p style={{ fontFamily: "var(--font-title)", fontSize: 22, color: "var(--color-text)" }}>
      ⚙️ Paramètres — à venir
    </p>
  );
}
```

- [ ] **Step 7 : Vérification manuelle — lancer l'app**

```bash
npm run tauri dev
```

Expected :
- La fenêtre s'ouvre, la sidebar verte s'affiche à gauche
- "⏱️ Chrono" est actif par défaut (redirect depuis `/`)
- Cliquer sur chaque lien change le texte du contenu principal
- Pas d'erreur dans la console

- [ ] **Step 8 : Commit**

```bash
git add src/main.jsx src/AppLayout.jsx src/AppLayout.css src/Sidebar.jsx src/Sidebar.css src/pages/
git commit -m "feat: routing + layout sidebar + pages stub"
```

---

## Task 4: Composant ClientCard + test unitaire

**Files:**
- Create: `src/components/ClientCard.jsx`
- Create: `src/components/ClientCard.css`
- Create: `tests/ClientCard.test.jsx`

- [ ] **Step 1 : Écrire le test en premier (`tests/ClientCard.test.jsx`)**

```jsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ClientCard from "../src/components/ClientCard";

const baseClient = {
  id: 1,
  nom: "Studio Lumière",
  taux_horaire: 85,
  couleur: "#7FD8A0",
  actif: 1,
};

describe("ClientCard", () => {
  it("affiche le nom et le taux horaire", () => {
    render(<ClientCard client={baseClient} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("Studio Lumière")).toBeInTheDocument();
    expect(screen.getByText("85 $/h")).toBeInTheDocument();
  });

  it("affiche le badge Actif quand actif=1", () => {
    render(<ClientCard client={baseClient} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("Actif")).toBeInTheDocument();
  });

  it("affiche le badge Inactif quand actif=0", () => {
    const inactif = { ...baseClient, actif: 0 };
    render(<ClientCard client={inactif} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("Inactif")).toBeInTheDocument();
  });

  it("ajoute la classe --inactive quand actif=0", () => {
    const inactif = { ...baseClient, actif: 0 };
    const { container } = render(<ClientCard client={inactif} isSelected={false} onClick={() => {}} />);
    expect(container.firstChild).toHaveClass("client-card--inactive");
  });

  it("ajoute la classe --selected quand isSelected=true", () => {
    const { container } = render(<ClientCard client={baseClient} isSelected={true} onClick={() => {}} />);
    expect(container.firstChild).toHaveClass("client-card--selected");
  });

  it("appelle onClick au clic", () => {
    const onClick = vi.fn();
    render(<ClientCard client={baseClient} isSelected={false} onClick={onClick} />);
    screen.getByText("Studio Lumière").closest(".client-card").click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2 : Lancer les tests — vérifier l'échec**

```bash
npm test
```

Expected : FAIL — `Cannot find module '../src/components/ClientCard'`

- [ ] **Step 3 : Créer `src/components/ClientCard.jsx`**

```jsx
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
    <div className={classes} onClick={onClick}>
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
```

- [ ] **Step 4 : Créer `src/components/ClientCard.css`**

```css
.client-card {
  background: white;
  border-radius: var(--radius);
  padding: 12px 14px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.client-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.client-card--selected {
  border-color: var(--color-accent);
}

.client-card--inactive {
  opacity: 0.55;
}

.client-card__avatar {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.client-card__info {
  flex: 1;
  min-width: 0;
}

.client-card__name {
  font-family: var(--font-title);
  font-size: 14px;
  color: var(--color-text);
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.client-card__rate {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
}

.client-card__badge {
  font-size: 10px;
  font-weight: 700;
  background: #e0f5ea;
  color: #2d6a4f;
  border-radius: 99px;
  padding: 2px 8px;
  flex-shrink: 0;
}

.client-card__badge--inactive {
  background: #f5e0e0;
  color: #9b2c2c;
}
```

- [ ] **Step 5 : Lancer les tests — vérifier la réussite**

```bash
npm test
```

Expected : `6 tests passed`

- [ ] **Step 6 : Commit**

```bash
git add src/components/ClientCard.jsx src/components/ClientCard.css tests/ClientCard.test.jsx
git commit -m "feat: composant ClientCard + tests unitaires"
```

---

## Task 5: Composant ProjetsList

**Files:**
- Create: `src/components/ProjetsList.jsx`
- Create: `src/components/ProjetsList.css`

Note : ProjetsList appelle `createProjet`, `updateProjet`, `deleteProjet` (qui dépendent de Tauri) — pas testable en jsdom. Vérification manuelle en Task 7.

- [ ] **Step 1 : Créer `src/components/ProjetsList.jsx`**

```jsx
import { useState } from "react";
import { createProjet, updateProjet, deleteProjet } from "../db/database";
import "./ProjetsList.css";

export default function ProjetsList({ clientId, projets, onRefresh }) {
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ nom: "", taux_horaire: "" });
  const [newProjet, setNewProjet] = useState(null);

  function startEdit(p) {
    setEditingId(p.id);
    setEditValues({ nom: p.nom, taux_horaire: p.taux_horaire ?? "" });
  }

  async function saveEdit(id) {
    await updateProjet(id, {
      nom: editValues.nom.trim(),
      taux_horaire: editValues.taux_horaire !== "" ? Number(editValues.taux_horaire) : null,
    });
    setEditingId(null);
    onRefresh();
  }

  async function handleDelete(id) {
    if (!window.confirm("Supprimer ce projet ?")) return;
    await deleteProjet(id);
    onRefresh();
  }

  async function handleAdd() {
    if (!newProjet?.nom?.trim()) return;
    await createProjet({
      client_id: clientId,
      nom: newProjet.nom.trim(),
      taux_horaire: newProjet.taux_horaire !== "" ? Number(newProjet.taux_horaire) : null,
    });
    setNewProjet(null);
    onRefresh();
  }

  return (
    <div className="projets-list">
      <div className="projets-list__header">
        <span>📁 Projets</span>
        <button
          className="projets-list__add-btn"
          onClick={() => setNewProjet({ nom: "", taux_horaire: "" })}
        >
          + Ajouter
        </button>
      </div>

      {projets.map((p) =>
        editingId === p.id ? (
          <div key={p.id} className="projets-list__row projets-list__row--editing">
            <input
              className="projets-list__input"
              value={editValues.nom}
              onChange={(e) => setEditValues({ ...editValues, nom: e.target.value })}
              placeholder="Nom du projet"
            />
            <input
              className="projets-list__input projets-list__input--rate"
              type="number"
              min="0"
              step="0.5"
              value={editValues.taux_horaire}
              onChange={(e) => setEditValues({ ...editValues, taux_horaire: e.target.value })}
              placeholder="Taux"
            />
            <button className="projets-list__btn projets-list__btn--confirm" onClick={() => saveEdit(p.id)}>✓</button>
            <button className="projets-list__btn" onClick={() => setEditingId(null)}>✕</button>
          </div>
        ) : (
          <div key={p.id} className="projets-list__row">
            <span className="projets-list__name">{p.nom}</span>
            <span className="projets-list__rate">
              {p.taux_horaire != null ? `${p.taux_horaire} $/h` : <em>hérite du client</em>}
            </span>
            <button className="projets-list__btn" onClick={() => startEdit(p)}>✏️</button>
            <button className="projets-list__btn" onClick={() => handleDelete(p.id)}>🗑️</button>
          </div>
        )
      )}

      {newProjet && (
        <div className="projets-list__row projets-list__row--editing">
          <input
            className="projets-list__input"
            value={newProjet.nom}
            onChange={(e) => setNewProjet({ ...newProjet, nom: e.target.value })}
            placeholder="Nom du projet"
            autoFocus
          />
          <input
            className="projets-list__input projets-list__input--rate"
            type="number"
            min="0"
            step="0.5"
            value={newProjet.taux_horaire}
            onChange={(e) => setNewProjet({ ...newProjet, taux_horaire: e.target.value })}
            placeholder="Taux"
          />
          <button className="projets-list__btn projets-list__btn--confirm" onClick={handleAdd}>✓</button>
          <button className="projets-list__btn" onClick={() => setNewProjet(null)}>✕</button>
        </div>
      )}

      {projets.length === 0 && !newProjet && (
        <p className="projets-list__empty">Aucun projet — clique "+ Ajouter" 🌱</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Créer `src/components/ProjetsList.css`**

```css
.projets-list {
  border-top: 1px solid var(--color-surface);
  padding-top: 12px;
  margin-top: 4px;
}

.projets-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text);
}

.projets-list__add-btn {
  background: var(--color-surface);
  color: var(--color-sidebar);
  border: none;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.projets-list__add-btn:hover {
  opacity: 0.75;
}

.projets-list__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: #f7fdf9;
  border-radius: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}

.projets-list__row--editing {
  background: #e8f8ee;
}

.projets-list__name {
  flex: 1;
  color: var(--color-text);
  font-weight: 600;
}

.projets-list__rate {
  color: var(--color-text-muted);
  font-size: 11px;
}

.projets-list__rate em {
  font-style: italic;
  font-size: 10px;
}

.projets-list__btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 2px;
  opacity: 0.65;
  transition: opacity 0.1s;
}

.projets-list__btn:hover {
  opacity: 1;
}

.projets-list__btn--confirm {
  color: #2d6a4f;
  font-size: 14px;
  font-weight: 700;
}

.projets-list__input {
  flex: 1;
  border: 1.5px solid #c8efd8;
  border-radius: 6px;
  padding: 3px 7px;
  font-size: 11px;
  color: var(--color-text);
  outline: none;
}

.projets-list__input:focus {
  border-color: var(--color-accent);
}

.projets-list__input--rate {
  flex: 0 0 68px;
}

.projets-list__empty {
  color: var(--color-text-muted);
  font-size: 11px;
  font-style: italic;
  padding: 4px 8px;
}
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/ProjetsList.jsx src/components/ProjetsList.css
git commit -m "feat: composant ProjetsList (inline edit/add/delete)"
```

---

## Task 6: Composant ClientPanel

**Files:**
- Create: `src/components/ClientPanel.jsx`
- Create: `src/components/ClientPanel.css`

- [ ] **Step 1 : Créer `src/components/ClientPanel.jsx`**

```jsx
import { useState, useEffect } from "react";
import { createClient, updateClient, deleteClient, getProjetsByClient } from "../db/database";
import ProjetsList from "./ProjetsList";
import "./ClientPanel.css";

const SWATCHES = [
  "#7FD8A0", "#a8dadc", "#f4a261", "#e76f51",
  "#ffd166", "#06d6a0", "#118ab2", "#c77dff",
  "#f72585", "#b5838d",
];

const EMPTY_FORM = {
  nom: "",
  taux_horaire: "",
  courriel: "",
  adresse: "",
  couleur: "#7FD8A0",
  actif: true,
};

export default function ClientPanel({ client, onClose, onSaved, onDeleted }) {
  const isNew = !client;
  const [form, setForm] = useState(EMPTY_FORM);
  const [projets, setProjets] = useState([]);

  useEffect(() => {
    if (client) {
      setForm({
        nom: client.nom,
        taux_horaire: client.taux_horaire,
        courriel: client.courriel ?? "",
        adresse: client.adresse ?? "",
        couleur: client.couleur ?? "#7FD8A0",
        actif: Boolean(client.actif),
      });
      loadProjets();
    } else {
      setForm(EMPTY_FORM);
      setProjets([]);
    }
  }, [client?.id]);

  async function loadProjets() {
    if (!client) return;
    const list = await getProjetsByClient(client.id);
    setProjets(list);
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.nom.trim() || form.taux_horaire === "") return;
    const data = { ...form, taux_horaire: Number(form.taux_horaire) };
    if (isNew) {
      const id = await createClient(data);
      onSaved(id);
    } else {
      await updateClient(client.id, data);
      onSaved(client.id);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Supprimer ${client.nom} ? Toutes ses entrées de temps seront perdues.`
      )
    )
      return;
    await deleteClient(client.id);
    onDeleted();
  }

  return (
    <aside className="client-panel">
      <div className="client-panel__header">
        <h2 className="client-panel__title">
          {isNew ? "✨ Nouveau client" : `✏️ ${form.nom || "Client"}`}
        </h2>
        <button className="client-panel__close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>

      <div className="client-panel__body">
        <div className="client-panel__field">
          <label>Nom *</label>
          <input
            value={form.nom}
            onChange={(e) => set("nom", e.target.value)}
            placeholder="Nom du client"
          />
        </div>

        <div className="client-panel__field">
          <label>Taux horaire ($/h) *</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.taux_horaire}
            onChange={(e) => set("taux_horaire", e.target.value)}
            placeholder="ex. 75"
          />
        </div>

        <div className="client-panel__field">
          <label>Courriel</label>
          <input
            type="email"
            value={form.courriel}
            onChange={(e) => set("courriel", e.target.value)}
            placeholder="info@client.ca"
          />
        </div>

        <div className="client-panel__field">
          <label>Adresse</label>
          <textarea
            rows={2}
            value={form.adresse}
            onChange={(e) => set("adresse", e.target.value)}
            placeholder="123 rue Exemple, Montréal"
          />
        </div>

        <div className="client-panel__field">
          <label>Couleur</label>
          <div className="client-panel__swatches">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={`client-panel__swatch${form.couleur === c ? " client-panel__swatch--active" : ""}`}
                style={{ background: c }}
                onClick={() => set("couleur", c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className="client-panel__field client-panel__field--row">
          <label>Actif</label>
          <button
            type="button"
            className={`client-panel__toggle${form.actif ? " client-panel__toggle--on" : ""}`}
            onClick={() => set("actif", !form.actif)}
          >
            {form.actif ? "✓ Oui" : "✗ Non"}
          </button>
        </div>

        {!isNew && (
          <ProjetsList clientId={client.id} projets={projets} onRefresh={loadProjets} />
        )}
      </div>

      <div className="client-panel__footer">
        <button className="client-panel__save" onClick={handleSave}>
          💾 Sauvegarder
        </button>
        {!isNew && (
          <button className="client-panel__delete" onClick={handleDelete}>
            🗑️ Supprimer ce client
          </button>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2 : Créer `src/components/ClientPanel.css`**

```css
.client-panel {
  width: 230px;
  flex-shrink: 0;
  background: white;
  border-radius: var(--radius);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: panel-in 0.2s ease-out;
}

@keyframes panel-in {
  from { transform: translateX(16px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

.client-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--color-surface);
  flex-shrink: 0;
}

.client-panel__title {
  font-family: var(--font-title);
  font-size: 15px;
  color: var(--color-text);
  font-weight: 600;
}

.client-panel__close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-muted);
  padding: 2px 6px;
  border-radius: 6px;
  transition: background 0.1s;
}

.client-panel__close:hover {
  background: var(--color-surface);
}

.client-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.client-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.client-panel__field label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.client-panel__field input,
.client-panel__field textarea {
  border: 1.5px solid #c8efd8;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--color-text);
  outline: none;
  transition: border-color 0.15s;
  resize: none;
  width: 100%;
}

.client-panel__field input:focus,
.client-panel__field textarea:focus {
  border-color: var(--color-accent);
}

.client-panel__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.client-panel__swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2.5px solid transparent;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s;
  padding: 0;
}

.client-panel__swatch:hover {
  transform: scale(1.2);
}

.client-panel__swatch--active {
  border-color: var(--color-sidebar);
  transform: scale(1.2);
}

.client-panel__field--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.client-panel__toggle {
  background: #f5e0e0;
  color: #9b2c2c;
  border: none;
  border-radius: 99px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.client-panel__toggle--on {
  background: #e0f5ea;
  color: #2d6a4f;
}

.client-panel__footer {
  padding: 12px 16px;
  border-top: 1px solid var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.client-panel__save {
  background: var(--color-accent);
  color: var(--color-sidebar);
  border: none;
  border-radius: 10px;
  padding: 9px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  width: 100%;
  transition: opacity 0.15s;
}

.client-panel__save:hover {
  opacity: 0.85;
}

.client-panel__delete {
  background: none;
  border: none;
  color: #e57373;
  font-size: 12px;
  cursor: pointer;
  text-align: center;
  padding: 4px;
  transition: text-decoration 0.1s;
}

.client-panel__delete:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/ClientPanel.jsx src/components/ClientPanel.css
git commit -m "feat: composant ClientPanel (formulaire + projets)"
```

---

## Task 7: Page Clients — assemblage final

**Files:**
- Create: `src/pages/Clients.jsx`
- Create: `src/pages/Clients.css`

- [ ] **Step 1 : Créer `src/pages/Clients.jsx`**

```jsx
import { useState, useEffect } from "react";
import { getClients } from "../db/database";
import ClientCard from "../components/ClientCard";
import ClientPanel from "../components/ClientPanel";
import "./Clients.css";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    const list = await getClients();
    setClients(list);
  }

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;
  const panelOpen = isNew || selectedId !== null;

  function openNew() {
    setIsNew(true);
    setSelectedId(null);
  }

  function closePanel() {
    setIsNew(false);
    setSelectedId(null);
  }

  async function handleSaved(id) {
    await loadClients();
    setIsNew(false);
    setSelectedId(id);
  }

  async function handleDeleted() {
    closePanel();
    await loadClients();
  }

  return (
    <div className="clients-page">
      <div className="clients-page__header">
        <h1 className="clients-page__title">👥 Mes clients</h1>
        <button className="clients-page__new-btn" onClick={openNew}>
          + Nouveau client
        </button>
      </div>

      <div className="clients-page__body">
        <div className="clients-page__grid">
          {clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              isSelected={c.id === selectedId}
              onClick={() => {
                setIsNew(false);
                setSelectedId(c.id);
              }}
            />
          ))}
          {clients.length === 0 && (
            <p className="clients-page__empty">
              Aucun client pour l'instant — crée-en un ! 🌱
            </p>
          )}
        </div>

        {panelOpen && (
          <ClientPanel
            client={isNew ? null : selectedClient}
            onClose={closePanel}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Créer `src/pages/Clients.css`**

```css
.clients-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.clients-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.clients-page__title {
  font-family: var(--font-title);
  font-size: 24px;
  color: var(--color-text);
}

.clients-page__new-btn {
  background: var(--color-accent);
  color: var(--color-sidebar);
  border: none;
  border-radius: 10px;
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.clients-page__new-btn:hover {
  opacity: 0.85;
}

.clients-page__body {
  display: flex;
  gap: 20px;
  flex: 1;
  overflow: hidden;
}

.clients-page__grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  align-content: start;
  overflow-y: auto;
  padding-right: 4px;
}

.clients-page__empty {
  color: var(--color-text-muted);
  font-style: italic;
  grid-column: 1 / -1;
}
```

- [ ] **Step 3 : Vérification manuelle complète**

Lance `npm run tauri dev` et teste chaque scénario :

**Scénario 1 — Liste vide :**
- Naviguer vers "Clients"
- Vérifier l'affichage du message "Aucun client pour l'instant — crée-en un ! 🌱"

**Scénario 2 — Créer un client :**
- Cliquer "+ Nouveau client"
- Vérifier que le panneau s'ouvre avec animation et formulaire vide
- Remplir : nom "Studio Lumière", taux "85", choisir une couleur verte
- Cliquer "💾 Sauvegarder"
- Vérifier que la carte apparaît dans la grille, le panneau reste ouvert sur ce client

**Scénario 3 — Modifier un client :**
- Cliquer sur la carte "Studio Lumière"
- Modifier le taux à "90"
- Sauvegarder → la carte se met à jour avec "90 $/h"

**Scénario 4 — Ajouter un projet :**
- Dans le panneau de "Studio Lumière", cliquer "+ Ajouter" sous "📁 Projets"
- Entrer nom "Site web", taux "95"
- Cliquer ✓
- Vérifier que le projet apparaît dans la liste

**Scénario 5 — Modifier un projet :**
- Cliquer ✏️ sur "Site web"
- Changer le taux à "100", cliquer ✓
- Vérifier la mise à jour

**Scénario 6 — Projet sans taux :**
- Ajouter un projet "Logo" sans taux
- Vérifier l'affichage "hérite du client" en italique

**Scénario 7 — Client inactif :**
- Créer un deuxième client, toggler "Actif" sur Non
- Vérifier badge "Inactif" et opacité réduite sur la carte

**Scénario 8 — Supprimer un projet :**
- Cliquer 🗑️ sur un projet → confirmer → projet disparaît

**Scénario 9 — Supprimer un client :**
- Cliquer "🗑️ Supprimer ce client" dans le footer du panneau
- Confirmer → carte disparaît, panneau se ferme

**Scénario 10 — Navigation :**
- Cliquer sur "Chrono", "Rapports", etc. → pages stub s'affichent
- Revenir sur "Clients" → liste toujours là

- [ ] **Step 4 : Commit final**

```bash
git add src/pages/Clients.jsx src/pages/Clients.css
git commit -m "feat: page Admin Clients complète (CRUD + projets + panneau latéral)"
```

---

## Self-Review

**Couverture spec :**
- ✅ Routes `/chrono`, `/saisie`, `/clients`, `/rapports`, `/factures`, `/parametres` + redirect `/` → Task 3
- ✅ Sidebar 140px fixe, liens NavLink, Paramètres en bas → Task 3
- ✅ CSS variables globales palette verte, Fredoka/Quicksand → Task 1
- ✅ `database.js` singleton + tous les helpers CRUD → Task 2
- ✅ ClientCard : couleur, nom, taux, badge actif/inactif, opacité si inactif → Task 4
- ✅ ClientPanel : tous les champs (nom, taux, courriel, adresse, couleur swatches, toggle actif) → Task 6
- ✅ ProjetsList : liste, inline edit, add, delete, taux optionnel → Task 5
- ✅ Clients.jsx : état local, CRUD orchestré, panneau slide-in → Task 7
- ✅ Tests unitaires ClientCard → Task 4

**Cohérence des signatures :**
- `createClient(data)` → retourne `lastInsertId` (utilisé dans `ClientPanel.handleSave`)
- `updateClient(id, data)` → appelé avec `client.id` dans `ClientPanel`
- `getProjetsByClient(clientId)` → appelé avec `client.id` dans `ClientPanel.loadProjets`
- `onRefresh` prop de ProjetsList → `loadProjets` dans ClientPanel ✅
- `onSaved(id)` callback → `handleSaved(id)` dans Clients.jsx ✅
