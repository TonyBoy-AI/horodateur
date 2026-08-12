# Factures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la page Factures permettant de créer des factures depuis les entrées de temps non facturées, de lister les factures existantes et de marquer leur statut (impayée/payée).

**Architecture:** Cinq nouvelles fonctions DB couvrent lecture, création et liaison des factures. La page React affiche la liste des factures et un panel slide-in pour créer une nouvelle facture (sélection client → entrées avec cases à cocher → total calculé → numéro → soumettre).

**Tech Stack:** React 18, Tauri 2 + plugin-sql (SQLite), Vitest + @testing-library/react

---

## Contexte codebase

- Worktree: `.worktrees/feat-factures`, branche `feat/factures`
- `src/db/database.js`: fonctions async SQLite, pattern `getDb()` → `d.select` / `d.execute`
- Table `factures`: `id, client_id, numero TEXT, date_emission TEXT, montant_total REAL, statut TEXT ('impayee'|'payee')`
- Table `entrees_temps`: `id, client_id, projet_id, debut, fin, duree_minutes, duree_arrondie_minutes, note, facture_id` — `facture_id` est NULL pour les entrées non facturées
- Table `clients`: `id, nom, taux_horaire, actif`; Table `projets`: `id, client_id, nom`
- Fonctions DB existantes: `getClients()`
- `src/pages/Factures.jsx`: stub vide à remplacer
- CSS vars: `--color-bg`, `--color-accent` (#7FD8A0), `--color-text`, `--color-text-muted`, `--color-sidebar` (#1b4332), `--font-title` (Fredoka), `--font-body` (Quicksand), `--radius` (12px), `--shadow`
- Pattern BEM, pattern inputs: `border: 1.5px solid #c8efd8`, `border-radius: 8px`, focus → `border-color: var(--color-accent)`
- Tests: `vitest run`, mock DB: `vi.mock("../src/db/database", () => ({ ... }))`
- Baseline: 32 tests passent (7 fichiers)

---

### Task 1: DB — 5 fonctions Factures

**Files:**
- Modify: `src/db/database.js` (ajouter 5 fonctions à la fin)
- Test: `tests/database.factures.test.js`

- [ ] **Étape 1: Écrire les tests qui échouent**

Créer `tests/database.factures.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = { select: vi.fn(), execute: vi.fn() };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import {
  getFactures,
  getEntreesSansFacture,
  createFacture,
  linkEntreesToFacture,
  updateFactureStatut,
} from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("getFactures", () => {
  it("retourne les factures avec le nom du client", async () => {
    const mockRows = [{ id: 1, numero: "F-2026-001", client_nom: "Studio Lumière", statut: "impayee" }];
    mockDb.select.mockResolvedValue(mockRows);
    const rows = await getFactures();
    expect(rows).toEqual(mockRows);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("LEFT JOIN clients"),
      []
    );
  });
});

describe("getEntreesSansFacture", () => {
  it("retourne les entrées non facturées d'un client", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesSansFacture(1);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("facture_id IS NULL"),
      [1]
    );
  });
});

describe("createFacture", () => {
  it("insère une facture et retourne son id", async () => {
    mockDb.execute.mockResolvedValue({ lastInsertId: 7 });
    const id = await createFacture({
      client_id: 1,
      numero: "F-2026-001",
      date_emission: "2026-08-11",
      montant_total: 120,
    });
    expect(id).toBe(7);
    expect(mockDb.execute).toHaveBeenCalledWith(
      "INSERT INTO factures (client_id, numero, date_emission, montant_total) VALUES (?, ?, ?, ?)",
      [1, "F-2026-001", "2026-08-11", 120]
    );
  });
});

describe("linkEntreesToFacture", () => {
  it("met à jour facture_id pour chaque entrée fournie", async () => {
    mockDb.execute.mockResolvedValue({});
    await linkEntreesToFacture(5, [1, 2, 3]);
    expect(mockDb.execute).toHaveBeenCalledTimes(3);
    expect(mockDb.execute).toHaveBeenCalledWith(
      "UPDATE entrees_temps SET facture_id=? WHERE id=?",
      [5, 1]
    );
  });
});

describe("updateFactureStatut", () => {
  it("met à jour le statut d'une facture", async () => {
    mockDb.execute.mockResolvedValue({});
    await updateFactureStatut(3, "payee");
    expect(mockDb.execute).toHaveBeenCalledWith(
      "UPDATE factures SET statut=? WHERE id=?",
      ["payee", 3]
    );
  });
});
```

- [ ] **Étape 2: Vérifier que les tests échouent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-factures && npm test -- tests/database.factures.test.js
```

Attendu: FAIL — `getFactures is not a function`

- [ ] **Étape 3: Ajouter les 5 fonctions à la fin de `src/db/database.js`**

```js
export async function getFactures() {
  const d = await getDb();
  return d.select(
    `SELECT f.id, f.numero, f.date_emission, f.montant_total, f.statut,
            c.nom AS client_nom
     FROM factures f
     LEFT JOIN clients c ON c.id = f.client_id
     ORDER BY f.date_emission DESC`,
    []
  );
}

export async function getEntreesSansFacture(client_id) {
  const d = await getDb();
  return d.select(
    `SELECT e.id, e.debut, e.fin, e.duree_minutes, e.duree_arrondie_minutes, e.note,
            p.nom AS projet_nom
     FROM entrees_temps e
     LEFT JOIN projets p ON p.id = e.projet_id
     WHERE e.client_id = ? AND e.fin IS NOT NULL AND e.facture_id IS NULL
     ORDER BY e.debut ASC`,
    [client_id]
  );
}

export async function createFacture({ client_id, numero, date_emission, montant_total }) {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO factures (client_id, numero, date_emission, montant_total) VALUES (?, ?, ?, ?)",
    [client_id, numero, date_emission, montant_total]
  );
  return result.lastInsertId;
}

export async function linkEntreesToFacture(facture_id, entree_ids) {
  const d = await getDb();
  for (const id of entree_ids) {
    await d.execute("UPDATE entrees_temps SET facture_id=? WHERE id=?", [facture_id, id]);
  }
}

export async function updateFactureStatut(id, statut) {
  const d = await getDb();
  await d.execute("UPDATE factures SET statut=? WHERE id=?", [statut, id]);
}
```

- [ ] **Étape 4: Vérifier que les 5 tests passent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-factures && npm test -- tests/database.factures.test.js
```

Attendu: PASS (5 tests)

- [ ] **Étape 5: Commit**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-factures && git add src/db/database.js tests/database.factures.test.js && git commit -m "feat(db): add getFactures, getEntreesSansFacture, createFacture, linkEntreesToFacture, updateFactureStatut"
```

---

### Task 2: UI — Factures.jsx + Factures.css + tests

**Files:**
- Modify: `src/pages/Factures.jsx` (remplacer stub)
- Create: `src/pages/Factures.css`
- Create: `tests/Factures.test.jsx`

- [ ] **Étape 1: Écrire les tests qui échouent**

Créer `tests/Factures.test.jsx`:

```jsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getClients: vi.fn(),
  getFactures: vi.fn(),
  getEntreesSansFacture: vi.fn(),
  createFacture: vi.fn(),
  linkEntreesToFacture: vi.fn(),
  updateFactureStatut: vi.fn(),
}));

import Factures from "../src/pages/Factures";
import {
  getClients,
  getFactures,
  getEntreesSansFacture,
  createFacture,
  linkEntreesToFacture,
  updateFactureStatut,
} from "../src/db/database";

beforeEach(() => {
  vi.clearAllMocks();
  getClients.mockResolvedValue([{ id: 1, nom: "Studio Lumière", taux_horaire: 80, actif: 1 }]);
  getFactures.mockResolvedValue([]);
  getEntreesSansFacture.mockResolvedValue([]);
  createFacture.mockResolvedValue(1);
  linkEntreesToFacture.mockResolvedValue(undefined);
  updateFactureStatut.mockResolvedValue(undefined);
});

describe("Factures", () => {
  it("affiche le titre et le bouton Nouvelle facture", async () => {
    render(<Factures />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("+ Nouvelle facture")).toBeInTheDocument();
  });

  it("affiche la liste des factures avec statut et montant", async () => {
    getFactures.mockResolvedValue([{
      id: 1, numero: "F-2026-001", client_nom: "Studio Lumière",
      date_emission: "2026-08-11", montant_total: 120, statut: "impayee",
    }]);
    render(<Factures />);
    await waitFor(() => expect(screen.getByText("F-2026-001")).toBeInTheDocument());
    expect(screen.getByText("Impayée")).toBeInTheDocument();
    expect(screen.getByText("120.00 $")).toBeInTheDocument();
  });

  it("marque une facture comme payée", async () => {
    getFactures.mockResolvedValue([{
      id: 1, numero: "F-2026-001", client_nom: "Studio Lumière",
      date_emission: "2026-08-11", montant_total: 120, statut: "impayee",
    }]);
    render(<Factures />);
    await waitFor(() => screen.getByText("Marquer payée"));
    await userEvent.click(screen.getByText("Marquer payée"));
    expect(updateFactureStatut).toHaveBeenCalledWith(1, "payee");
  });

  it("ouvre le panel de création au clic sur Nouvelle facture", async () => {
    render(<Factures />);
    await userEvent.click(screen.getByText("+ Nouvelle facture"));
    expect(screen.getByText("Nouvelle facture")).toBeInTheDocument();
    expect(screen.getByLabelText(/client/i)).toBeInTheDocument();
  });

  it("charge les entrées quand un client est sélectionné dans le panel", async () => {
    getEntreesSansFacture.mockResolvedValue([{
      id: 1, debut: "2026-08-11T09:00:00", fin: "2026-08-11T10:30:00",
      duree_minutes: 90, duree_arrondie_minutes: 90, note: null, projet_nom: null,
    }]);
    render(<Factures />);
    await userEvent.click(screen.getByText("+ Nouvelle facture"));
    await userEvent.selectOptions(screen.getByLabelText(/client/i), "1");
    await waitFor(() => expect(getEntreesSansFacture).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByText("1h30")).toBeInTheDocument());
  });
});
```

- [ ] **Étape 2: Vérifier que les tests échouent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-factures && npm test -- tests/Factures.test.jsx
```

Attendu: FAIL (stub vide)

- [ ] **Étape 3: Remplacer `src/pages/Factures.jsx`**

```jsx
import { useState, useEffect } from "react";
import {
  getClients,
  getFactures,
  getEntreesSansFacture,
  createFacture,
  linkEntreesToFacture,
  updateFactureStatut,
} from "../db/database";
import "./Factures.css";

function formatDate(isoStr) {
  return isoStr ? isoStr.slice(0, 10) : "—";
}

function formatDuration(minutes) {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
}

function autoNumero(count) {
  return `F-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
}

export default function Factures() {
  const [factures, setFactures] = useState([]);
  const [clients, setClients] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const [clientId, setClientId] = useState("");
  const [entrees, setEntrees] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [numero, setNumero] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFactures();
    getClients().then(setClients).catch(console.error);
  }, []);

  function loadFactures() {
    getFactures().then(setFactures).catch(console.error);
  }

  useEffect(() => {
    if (!clientId) { setEntrees([]); setSelectedIds(new Set()); return; }
    getEntreesSansFacture(Number(clientId))
      .then((rows) => {
        setEntrees(rows);
        setSelectedIds(new Set(rows.map((e) => e.id)));
      })
      .catch(console.error);
  }, [clientId]);

  function openPanel() {
    setClientId("");
    setEntrees([]);
    setSelectedIds(new Set());
    setNumero(autoNumero(factures.length));
    setPanelOpen(true);
  }

  function toggleEntry(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedEntrees = entrees.filter((e) => selectedIds.has(e.id));
  const clientObj = clients.find((c) => c.id === Number(clientId));
  const taux = clientObj?.taux_horaire ?? 0;
  const totalMinutes = selectedEntrees.reduce(
    (sum, e) => sum + (e.duree_arrondie_minutes ?? e.duree_minutes ?? 0), 0
  );
  const montantTotal = (totalMinutes / 60) * taux;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!clientId || selectedIds.size === 0 || !numero) return;
    setSubmitting(true);
    try {
      const date_emission = new Date().toISOString().slice(0, 10);
      const id = await createFacture({ client_id: Number(clientId), numero, date_emission, montant_total: montantTotal });
      await linkEntreesToFacture(id, [...selectedIds]);
      setPanelOpen(false);
      loadFactures();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatut(facture) {
    const next = facture.statut === "payee" ? "impayee" : "payee";
    await updateFactureStatut(facture.id, next).catch(console.error);
    loadFactures();
  }

  return (
    <div className="factures-page">
      <div className="factures-page__header">
        <h1 className="factures-page__title">🧾 Factures</h1>
        <button className="factures-page__btn-new" onClick={openPanel}>+ Nouvelle facture</button>
      </div>

      {factures.length === 0 ? (
        <p className="factures-page__empty">Aucune facture pour le moment.</p>
      ) : (
        <ul className="factures-page__list">
          {factures.map((f) => (
            <li key={f.id} className="factures-page__item">
              <div className="factures-page__item-info">
                <span className="factures-page__item-numero">{f.numero}</span>
                <span className="factures-page__item-client">{f.client_nom}</span>
                <span className="factures-page__item-date">{formatDate(f.date_emission)}</span>
              </div>
              <div className="factures-page__item-right">
                <span className="factures-page__item-montant">{f.montant_total.toFixed(2)} $</span>
                <span className={`factures-page__badge factures-page__badge--${f.statut}`}>
                  {f.statut === "payee" ? "Payée" : "Impayée"}
                </span>
                <button className="factures-page__btn-statut" onClick={() => toggleStatut(f)}>
                  {f.statut === "payee" ? "Marquer impayée" : "Marquer payée"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {panelOpen && (
        <div className="factures-panel__overlay" onClick={() => setPanelOpen(false)}>
          <div className="factures-panel" onClick={(e) => e.stopPropagation()}>
            <div className="factures-panel__header">
              <h2 className="factures-panel__title">Nouvelle facture</h2>
              <button className="factures-panel__close" onClick={() => setPanelOpen(false)} aria-label="Fermer">✕</button>
            </div>

            <form className="factures-panel__form" onSubmit={handleSubmit}>
              <div className="factures-panel__field">
                <label htmlFor="fp-client">Client *</label>
                <select id="fp-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {clients.filter((c) => c.actif).map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </div>

              {entrees.length > 0 && (
                <div className="factures-panel__entries">
                  <p className="factures-panel__entries-label">Entrées à facturer</p>
                  <ul className="factures-panel__entries-list">
                    {entrees.map((e) => (
                      <li key={e.id} className="factures-panel__entry">
                        <label className="factures-panel__entry-label">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(e.id)}
                            onChange={() => toggleEntry(e.id)}
                          />
                          <span>{formatDate(e.debut)}</span>
                          <span>{e.projet_nom ?? "—"}</span>
                          <span>{formatDuration(e.duree_arrondie_minutes ?? e.duree_minutes)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <p className="factures-panel__total">
                    Total: <strong>{formatDuration(totalMinutes)}</strong>
                    {taux > 0 && ` — ${montantTotal.toFixed(2)} $`}
                  </p>
                </div>
              )}

              {clientId && entrees.length === 0 && (
                <p className="factures-panel__no-entries">Aucune entrée non facturée pour ce client.</p>
              )}

              <div className="factures-panel__field">
                <label htmlFor="fp-numero">Numéro de facture *</label>
                <input
                  id="fp-numero"
                  type="text"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="F-2026-001"
                />
              </div>

              <button
                type="submit"
                className="factures-panel__btn-submit"
                disabled={!clientId || selectedIds.size === 0 || !numero || submitting}
              >
                {submitting ? "Création…" : "Créer la facture"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Étape 4: Créer `src/pages/Factures.css`**

```css
.factures-page {
  max-width: 640px;
  margin: 0 auto;
  padding-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.factures-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.factures-page__title {
  font-family: var(--font-title);
  font-size: 22px;
  color: var(--color-text);
  font-weight: 700;
}

.factures-page__btn-new {
  background: var(--color-accent);
  color: var(--color-sidebar);
  border: none;
  border-radius: 10px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-body);
  cursor: pointer;
  transition: opacity 0.15s;
}

.factures-page__btn-new:hover {
  opacity: 0.85;
}

.factures-page__empty {
  font-size: 14px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 32px 0;
}

.factures-page__list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.factures-page__item {
  background: white;
  border-radius: var(--radius);
  padding: 14px 18px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.factures-page__item-info {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.factures-page__item-numero {
  font-weight: 700;
  font-family: var(--font-title);
  color: var(--color-text);
  font-size: 14px;
  min-width: 90px;
}

.factures-page__item-client {
  color: var(--color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.factures-page__item-date {
  color: var(--color-text-muted);
  font-size: 12px;
  min-width: 80px;
}

.factures-page__item-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.factures-page__item-montant {
  font-weight: 700;
  font-family: var(--font-title);
  color: var(--color-text);
  font-size: 14px;
  min-width: 70px;
  text-align: right;
}

.factures-page__badge {
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.factures-page__badge--impayee {
  background: #fde8e2;
  color: #e76f51;
}

.factures-page__badge--payee {
  background: #d8f3dc;
  color: #2d6a4f;
}

.factures-page__btn-statut {
  border: 1.5px solid #c8efd8;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-body);
  color: var(--color-text-muted);
  background: white;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  white-space: nowrap;
}

.factures-page__btn-statut:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

/* Panel */

.factures-panel__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.factures-panel {
  background: white;
  width: 380px;
  height: 100%;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.factures-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid #e8f8ee;
  position: sticky;
  top: 0;
  background: white;
}

.factures-panel__title {
  font-family: var(--font-title);
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
}

.factures-panel__close {
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--color-text-muted);
  line-height: 1;
  padding: 4px;
  border-radius: 6px;
  transition: color 0.15s;
}

.factures-panel__close:hover {
  color: var(--color-text);
}

.factures-panel__form {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.factures-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.factures-panel__field label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.factures-panel__field select,
.factures-panel__field input {
  border: 1.5px solid #c8efd8;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--color-text);
  background: white;
  outline: none;
  font-family: var(--font-body);
  transition: border-color 0.15s;
}

.factures-panel__field select:focus,
.factures-panel__field input:focus {
  border-color: var(--color-accent);
}

.factures-panel__entries-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.factures-panel__entries-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.factures-panel__entry-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
  color: var(--color-text);
}

.factures-panel__entry-label input[type="checkbox"] {
  accent-color: var(--color-accent);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.factures-panel__total {
  font-size: 13px;
  color: var(--color-text-muted);
  padding-top: 8px;
  border-top: 1px solid #e8f8ee;
}

.factures-panel__total strong {
  color: var(--color-text);
}

.factures-panel__no-entries {
  font-size: 13px;
  color: var(--color-text-muted);
  font-style: italic;
}

.factures-panel__btn-submit {
  background: var(--color-accent);
  color: var(--color-sidebar);
  border: none;
  border-radius: 12px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-body);
  transition: opacity 0.15s;
  margin-top: auto;
}

.factures-panel__btn-submit:hover:not(:disabled) {
  opacity: 0.85;
}

.factures-panel__btn-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Étape 5: Vérifier que tous les tests passent (42 au total)**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-factures && npm test
```

Attendu: `Test Files  9 passed (9)`, `Tests  42 passed (42)`

- [ ] **Étape 6: Commit**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-factures && git add src/pages/Factures.jsx src/pages/Factures.css tests/Factures.test.jsx && git commit -m "feat(Factures): add invoices page with creation panel and status toggle"
```
