# Rapports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la page Rapports affichant un résumé des heures (total + répartition par client avec montant $) et le détail des entrées, filtrés par période et client.

**Architecture:** Une nouvelle fonction DB `getEntreesParPeriode` fait un SELECT avec JOINs et filtres dynamiques. La page React gère les filtres (semaine / mois / personnalisé + client), calcule le résumé en JS depuis le tableau retourné, et affiche la liste détaillée.

**Tech Stack:** React 18, Tauri 2 + plugin-sql (SQLite), Vitest + @testing-library/react

---

## Contexte codebase

- Worktree: `.worktrees/feat-rapports`, branche `feat/rapports`
- `src/db/database.js`: fonctions async SQLite, pattern `getDb()` → `d.select(sql, params)`
- Table `entrees_temps`: `id, client_id, projet_id, debut (ISO 8601), fin (ISO 8601 ou NULL si en cours), duree_minutes, duree_arrondie_minutes, note`
- Table `clients`: `id, nom, taux_horaire, actif`; Table `projets`: `id, client_id, nom`
- Fonctions DB existantes: `getClients()`
- `src/pages/Rapports.jsx`: stub vide à remplacer
- CSS vars: `--color-bg`, `--color-accent` (#7FD8A0), `--color-text`, `--color-text-muted`, `--font-title` (Fredoka), `--font-body` (Quicksand), `--radius` (12px), `--shadow`
- Pattern BEM, pattern inputs: `border: 1.5px solid #c8efd8`, `border-radius: 8px`, focus → `border-color: var(--color-accent)`
- Tests: `vitest run`, mock DB: `vi.mock("../src/db/database", () => ({ ... }))`
- Baseline: 25 tests passent (5 fichiers)

---

### Task 1: DB — `getEntreesParPeriode`

**Files:**
- Modify: `src/db/database.js` (ajouter 1 fonction à la fin)
- Test: `tests/database.rapports.test.js`

- [ ] **Étape 1: Écrire les tests qui échouent**

Créer `tests/database.rapports.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = { select: vi.fn(), execute: vi.fn() };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import { getEntreesParPeriode } from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("getEntreesParPeriode", () => {
  it("retourne les entrées pour une période sans filtre client", async () => {
    const mockRows = [{
      id: 1, debut: "2026-08-11T09:00:00", fin: "2026-08-11T10:30:00",
      duree_minutes: 90, duree_arrondie_minutes: 90, note: null,
      client_id: 1, client_nom: "Studio Lumière", client_taux: 80, projet_nom: null,
    }];
    mockDb.select.mockResolvedValue(mockRows);
    const rows = await getEntreesParPeriode({
      debut: "2026-08-01T00:00:00",
      fin: "2026-09-01T00:00:00",
    });
    expect(rows).toEqual(mockRows);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("e.debut >= ?"),
      ["2026-08-01T00:00:00", "2026-09-01T00:00:00"]
    );
  });

  it("ajoute le filtre client_id quand fourni", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesParPeriode({
      debut: "2026-08-01T00:00:00",
      fin: "2026-09-01T00:00:00",
      client_id: 3,
    });
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("AND e.client_id"),
      ["2026-08-01T00:00:00", "2026-09-01T00:00:00", 3]
    );
  });
});
```

- [ ] **Étape 2: Vérifier que les tests échouent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-rapports && npm test -- tests/database.rapports.test.js
```

Attendu: FAIL — `getEntreesParPeriode is not a function`

- [ ] **Étape 3: Ajouter la fonction à la fin de `src/db/database.js`**

```js
export async function getEntreesParPeriode({ debut, fin, client_id = null }) {
  const d = await getDb();
  const params = [debut, fin];
  const clientClause = client_id ? "AND e.client_id = ?" : "";
  if (client_id) params.push(client_id);
  return d.select(
    `SELECT e.id, e.debut, e.fin, e.duree_minutes, e.duree_arrondie_minutes, e.note,
            c.id AS client_id, c.nom AS client_nom, c.taux_horaire AS client_taux,
            p.nom AS projet_nom
     FROM entrees_temps e
     LEFT JOIN clients c ON c.id = e.client_id
     LEFT JOIN projets p ON p.id = e.projet_id
     WHERE e.fin IS NOT NULL
       AND e.debut >= ?
       AND e.debut < ?
       ${clientClause}
     ORDER BY e.debut DESC`,
    params
  );
}
```

- [ ] **Étape 4: Vérifier que les 2 tests passent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-rapports && npm test -- tests/database.rapports.test.js
```

Attendu: PASS (2 tests)

- [ ] **Étape 5: Commit**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-rapports && git add src/db/database.js tests/database.rapports.test.js && git commit -m "feat(db): add getEntreesParPeriode"
```

---

### Task 2: UI — Rapports.jsx + Rapports.css + tests

**Files:**
- Modify: `src/pages/Rapports.jsx` (remplacer stub)
- Create: `src/pages/Rapports.css`
- Create: `tests/Rapports.test.jsx`

- [ ] **Étape 1: Écrire les tests qui échouent**

Créer `tests/Rapports.test.jsx`:

```jsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getClients: vi.fn(),
  getEntreesParPeriode: vi.fn(),
}));

import Rapports from "../src/pages/Rapports";
import { getClients, getEntreesParPeriode } from "../src/db/database";

beforeEach(() => {
  vi.clearAllMocks();
  getClients.mockResolvedValue([{ id: 1, nom: "Studio Lumière", actif: 1 }]);
  getEntreesParPeriode.mockResolvedValue([]);
});

describe("Rapports", () => {
  it("affiche le titre et les boutons de période", () => {
    render(<Rapports />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Cette semaine")).toBeInTheDocument();
    expect(screen.getByText("Ce mois")).toBeInTheDocument();
    expect(screen.getByText("Personnalisé")).toBeInTheDocument();
  });

  it("charge les entrées du mois courant au mount", async () => {
    render(<Rapports />);
    await waitFor(() => expect(getEntreesParPeriode).toHaveBeenCalled());
    const call = getEntreesParPeriode.mock.calls[0][0];
    expect(call.debut).toMatch(/^\d{4}-\d{2}-01T00:00:00$/);
  });

  it("affiche le total des heures et la répartition par client", async () => {
    getEntreesParPeriode.mockResolvedValue([{
      id: 1, debut: "2026-08-11T09:00:00", fin: "2026-08-11T10:30:00",
      duree_minutes: 90, duree_arrondie_minutes: 90, note: null,
      client_id: 1, client_nom: "Studio Lumière", client_taux: 80, projet_nom: null,
    }]);
    render(<Rapports />);
    await waitFor(() => expect(screen.getAllByText("1h30")[0]).toBeInTheDocument());
    expect(screen.getByText("Studio Lumière")).toBeInTheDocument();
    expect(screen.getByText("120.00 $")).toBeInTheDocument();
  });

  it("bascule vers 'semaine' et recharge les entrées", async () => {
    render(<Rapports />);
    await waitFor(() => expect(getEntreesParPeriode).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByText("Cette semaine"));
    await waitFor(() => expect(getEntreesParPeriode).toHaveBeenCalledTimes(2));
  });

  it("affiche 'Aucune entrée' quand la liste est vide", async () => {
    render(<Rapports />);
    await waitFor(() => expect(screen.getByText(/aucune entrée/i)).toBeInTheDocument());
  });
});
```

- [ ] **Étape 2: Vérifier que les tests échouent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-rapports && npm test -- tests/Rapports.test.jsx
```

Attendu: FAIL (stub vide)

- [ ] **Étape 3: Remplacer `src/pages/Rapports.jsx`**

```jsx
import { useState, useEffect } from "react";
import { getClients, getEntreesParPeriode } from "../db/database";
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
  return h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
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

  useEffect(() => {
    getClients().then(setClients).catch(console.error);
  }, []);

  useEffect(() => {
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

  const { totalMinutes, byClient } = computeResume(entrees);

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
            <option key={c.id} value={c.id}>{c.nom}</option>
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
          <ul className="rapports-page__list">
            {entrees.map((e) => (
              <li key={e.id} className="rapports-page__item">
                <span className="rapports-page__item-date">{formatDate(e.debut)}</span>
                <span className="rapports-page__item-client">
                  {e.client_nom}{e.projet_nom ? ` · ${e.projet_nom}` : ""}
                </span>
                <span className="rapports-page__item-duree">
                  {formatDuration(e.duree_arrondie_minutes ?? e.duree_minutes)}
                </span>
                {e.note && <span className="rapports-page__item-note">{e.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rapports-page__empty">Aucune entrée pour cette période.</p>
      )}
    </div>
  );
}
```

- [ ] **Étape 4: Créer `src/pages/Rapports.css`**

```css
.rapports-page {
  max-width: 640px;
  margin: 0 auto;
  padding-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rapports-page__title {
  font-family: var(--font-title);
  font-size: 22px;
  color: var(--color-text);
  font-weight: 700;
}

.rapports-page__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.rapports-page__periode {
  display: flex;
  gap: 4px;
}

.rapports-page__periode-btn {
  border: 1.5px solid #c8efd8;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-body);
  background: white;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.rapports-page__periode-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-sidebar);
}

.rapports-page__periode-btn:hover:not(.rapports-page__periode-btn--active) {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.rapports-page__custom-dates {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rapports-page__custom-dates input {
  border: 1.5px solid #c8efd8;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: var(--font-body);
  color: var(--color-text);
  background: white;
  outline: none;
  transition: border-color 0.15s;
}

.rapports-page__custom-dates input:focus {
  border-color: var(--color-accent);
}

.rapports-page__arrow {
  color: var(--color-text-muted);
  font-size: 16px;
}

.rapports-page__client-filter {
  border: 1.5px solid #c8efd8;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: var(--font-body);
  color: var(--color-text);
  background: white;
  outline: none;
  transition: border-color 0.15s;
  cursor: pointer;
}

.rapports-page__client-filter:focus {
  border-color: var(--color-accent);
}

.rapports-page__resume {
  background: white;
  border-radius: var(--radius);
  padding: 16px 20px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rapports-page__total {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.rapports-page__total-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rapports-page__total-value {
  font-family: var(--font-title);
  font-size: 36px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1;
}

.rapports-page__by-client {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1px solid #e8f8ee;
  padding-top: 12px;
}

.rapports-page__client-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid #f0faf4;
}

.rapports-page__client-row:last-child {
  border-bottom: none;
}

.rapports-page__client-name {
  flex: 1;
  color: var(--color-text);
  font-weight: 600;
}

.rapports-page__client-hours {
  color: var(--color-text-muted);
  min-width: 48px;
  text-align: right;
}

.rapports-page__client-montant {
  color: var(--color-accent);
  font-weight: 700;
  font-family: var(--font-title);
  min-width: 80px;
  text-align: right;
}

.rapports-page__entries {
  background: white;
  border-radius: var(--radius);
  padding: 16px 20px;
  box-shadow: var(--shadow);
}

.rapports-page__entries-title {
  font-family: var(--font-title);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.rapports-page__list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.rapports-page__item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  padding: 8px 0;
  border-bottom: 1px solid #e8f8ee;
}

.rapports-page__item:last-child {
  border-bottom: none;
}

.rapports-page__item-date {
  color: var(--color-text-muted);
  font-size: 12px;
  min-width: 85px;
}

.rapports-page__item-client {
  flex: 1;
  color: var(--color-text);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rapports-page__item-duree {
  color: var(--color-accent);
  font-weight: 700;
  font-family: var(--font-title);
  font-size: 14px;
  min-width: 48px;
  text-align: right;
}

.rapports-page__item-note {
  color: var(--color-text-muted);
  font-size: 12px;
  font-style: italic;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rapports-page__empty {
  font-size: 14px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 24px 0;
}
```

- [ ] **Étape 5: Vérifier que tous les tests passent (32 au total)**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-rapports && npm test
```

Attendu: `Test Files  7 passed (7)`, `Tests  32 passed (32)`

- [ ] **Étape 6: Commit**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-rapports && git add src/pages/Rapports.jsx src/pages/Rapports.css tests/Rapports.test.jsx && git commit -m "feat(Rapports): add reports page with period filters, client summary, and entry list"
```
