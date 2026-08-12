# Saisie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la page Saisie permettant d'ajouter manuellement une entrée de temps (client, projet, date, heure début/fin, note) et d'afficher les 10 dernières entrées.

**Architecture:** Deux nouvelles fonctions DB (`createEntreeComplete`, `getEntreesRecentes`), puis la page `Saisie.jsx` qui affiche un formulaire avec validation inline, reset après soumission, et la liste des entrées récentes en dessous.

**Tech Stack:** React 18, Tauri 2 + plugin-sql (SQLite), Vitest + @testing-library/react

---

## Contexte codebase

- Worktree: `.worktrees/feat-saisie`, branche `feat/saisie`
- `src/db/database.js`: fonctions async SQLite, pattern `getDb()` → `d.select(sql, params)` / `d.execute(sql, params)`
- Table `entrees_temps`: `id, client_id, projet_id, debut (ISO 8601), fin (ISO 8601), duree_minutes, duree_arrondie_minutes, note, facture_id, cree_le`
- Table `clients`: `id, nom, actif, ...`; Table `projets`: `id, client_id, nom, ...`
- Table `parametres`: `cle, valeur` — `arrondi_minutes` donne l'arrondi en minutes (défaut "15")
- Fonctions DB existantes: `getClients()`, `getProjetsByClient(clientId)`, `getParametre(cle)`, `arreterEntree(id, {...})` (pour timer en cours seulement)
- `src/pages/Saisie.jsx`: stub vide à remplacer
- CSS vars: `--color-bg`, `--color-accent` (#7FD8A0), `--color-text`, `--color-text-muted`, `--font-title` (Fredoka), `--font-body` (Quicksand), `--radius` (12px), `--shadow`
- Pattern BEM, pattern inputs: `border: 1.5px solid #c8efd8`, `border-radius: 8px`, focus → `border-color: var(--color-accent)`
- Tests: `vitest run`, mock DB avec `vi.mock("../src/db/database", () => ({ ... }))`
- Baseline: 15 tests passent (3 fichiers)

---

### Task 1: DB — `createEntreeComplete` + `getEntreesRecentes`

**Files:**
- Modify: `src/db/database.js` (ajouter 2 fonctions à la fin)
- Test: `tests/database.saisie.test.js`

- [ ] **Étape 1: Écrire les tests qui échouent**

Créer `tests/database.saisie.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = { select: vi.fn(), execute: vi.fn() };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import { createEntreeComplete, getEntreesRecentes } from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("createEntreeComplete", () => {
  it("insère une entrée complète et retourne l'id", async () => {
    mockDb.execute.mockResolvedValue({ lastInsertId: 42 });
    const id = await createEntreeComplete({
      client_id: 1,
      projet_id: 2,
      debut: "2026-08-11T09:00:00",
      fin: "2026-08-11T10:30:00",
      duree_minutes: 90,
      duree_arrondie_minutes: 90,
      note: "Réunion client",
    });
    expect(id).toBe(42);
    expect(mockDb.execute).toHaveBeenCalledWith(
      "INSERT INTO entrees_temps (client_id, projet_id, debut, fin, duree_minutes, duree_arrondie_minutes, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [1, 2, "2026-08-11T09:00:00", "2026-08-11T10:30:00", 90, 90, "Réunion client"]
    );
  });

  it("utilise null pour projet_id absent et note vide", async () => {
    mockDb.execute.mockResolvedValue({ lastInsertId: 1 });
    await createEntreeComplete({
      client_id: 1,
      projet_id: null,
      debut: "2026-08-11T09:00:00",
      fin: "2026-08-11T10:30:00",
      duree_minutes: 90,
      duree_arrondie_minutes: 90,
      note: "",
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.any(String),
      [1, null, "2026-08-11T09:00:00", "2026-08-11T10:30:00", 90, 90, null]
    );
  });
});

describe("getEntreesRecentes", () => {
  it("retourne les entrées avec JOIN clients et projets", async () => {
    const mockRows = [{
      id: 1, debut: "2026-08-11T09:00:00", fin: "2026-08-11T10:30:00",
      duree_minutes: 90, duree_arrondie_minutes: 90, note: null,
      client_nom: "Studio Lumière", projet_nom: null,
    }];
    mockDb.select.mockResolvedValue(mockRows);
    const rows = await getEntreesRecentes(10);
    expect(rows).toEqual(mockRows);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("LEFT JOIN clients"),
      [10]
    );
  });

  it("utilise une limite de 10 par défaut", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesRecentes();
    expect(mockDb.select).toHaveBeenCalledWith(expect.any(String), [10]);
  });
});
```

- [ ] **Étape 2: Vérifier que les tests échouent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-saisie && npm test -- tests/database.saisie.test.js
```

Attendu: FAIL — `createEntreeComplete is not a function`

- [ ] **Étape 3: Ajouter les 2 fonctions à la fin de `src/db/database.js`**

```js
export async function createEntreeComplete({ client_id, projet_id, debut, fin, duree_minutes, duree_arrondie_minutes, note }) {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO entrees_temps (client_id, projet_id, debut, fin, duree_minutes, duree_arrondie_minutes, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [client_id, projet_id ?? null, debut, fin, duree_minutes, duree_arrondie_minutes ?? null, note || null]
  );
  return result.lastInsertId;
}

export async function getEntreesRecentes(limit = 10) {
  const d = await getDb();
  return d.select(
    `SELECT e.id, e.debut, e.fin, e.duree_minutes, e.duree_arrondie_minutes, e.note,
            c.nom AS client_nom, p.nom AS projet_nom
     FROM entrees_temps e
     LEFT JOIN clients c ON c.id = e.client_id
     LEFT JOIN projets p ON p.id = e.projet_id
     WHERE e.fin IS NOT NULL
     ORDER BY e.debut DESC
     LIMIT ?`,
    [limit]
  );
}
```

- [ ] **Étape 4: Vérifier que les 4 tests passent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-saisie && npm test -- tests/database.saisie.test.js
```

Attendu: PASS (4 tests)

- [ ] **Étape 5: Commit**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-saisie && git add src/db/database.js tests/database.saisie.test.js && git commit -m "feat(db): add createEntreeComplete + getEntreesRecentes"
```

---

### Task 2: UI — Saisie.jsx + Saisie.css + tests

**Files:**
- Modify: `src/pages/Saisie.jsx` (remplacer stub)
- Create: `src/pages/Saisie.css`
- Create: `tests/Saisie.test.jsx`

- [ ] **Étape 1: Écrire les tests qui échouent**

Créer `tests/Saisie.test.jsx`:

```jsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getClients: vi.fn(),
  getProjetsByClient: vi.fn(),
  createEntreeComplete: vi.fn(),
  getEntreesRecentes: vi.fn(),
  getParametre: vi.fn(),
}));

import Saisie from "../src/pages/Saisie";
import { getClients, getProjetsByClient, createEntreeComplete, getEntreesRecentes, getParametre } from "../src/db/database";

beforeEach(() => {
  vi.clearAllMocks();
  getClients.mockResolvedValue([{ id: 1, nom: "Studio Lumière", actif: 1 }]);
  getProjetsByClient.mockResolvedValue([]);
  createEntreeComplete.mockResolvedValue(1);
  getEntreesRecentes.mockResolvedValue([]);
  getParametre.mockResolvedValue("15");
});

describe("Saisie", () => {
  it("affiche le formulaire avec la date du jour par défaut", async () => {
    render(<Saisie />);
    const today = new Date().toISOString().slice(0, 10);
    await waitFor(() => expect(screen.getByLabelText(/date/i)).toHaveValue(today));
  });

  it("affiche une erreur si client non sélectionné", async () => {
    render(<Saisie />);
    await userEvent.click(screen.getByRole("button", { name: /ajouter/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/client/i);
  });

  it("affiche une erreur si les heures sont manquantes", async () => {
    render(<Saisie />);
    await waitFor(() => screen.getByText("Studio Lumière"));
    await userEvent.selectOptions(screen.getByLabelText(/client/i), "1");
    await userEvent.click(screen.getByRole("button", { name: /ajouter/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/heure/i);
  });

  it("affiche une erreur si fin <= début", async () => {
    render(<Saisie />);
    await waitFor(() => screen.getByText("Studio Lumière"));
    await userEvent.selectOptions(screen.getByLabelText(/client/i), "1");
    fireEvent.change(screen.getByLabelText(/début/i), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText(/fin/i), { target: { value: "09:00" } });
    await userEvent.click(screen.getByRole("button", { name: /ajouter/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/fin/i);
  });

  it("crée une entrée valide et affiche le message de succès", async () => {
    render(<Saisie />);
    await waitFor(() => screen.getByText("Studio Lumière"));
    await userEvent.selectOptions(screen.getByLabelText(/client/i), "1");
    fireEvent.change(screen.getByLabelText(/début/i), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText(/fin/i), { target: { value: "10:30" } });
    await userEvent.click(screen.getByRole("button", { name: /ajouter/i }));
    await waitFor(() =>
      expect(createEntreeComplete).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: 1, duree_minutes: 90 })
      )
    );
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
  });

  it("affiche la section des entrées récentes quand il y en a", async () => {
    getEntreesRecentes.mockResolvedValue([{
      id: 1, debut: "2026-08-11T09:00:00", fin: "2026-08-11T10:30:00",
      duree_minutes: 90, duree_arrondie_minutes: 90, note: null,
      client_nom: "Atelier Zinc", projet_nom: null,
    }]);
    render(<Saisie />);
    await waitFor(() => expect(screen.getByText("Atelier Zinc")).toBeInTheDocument());
    expect(screen.getByText(/entrées récentes/i)).toBeInTheDocument();
  });
});
```

- [ ] **Étape 2: Vérifier que les tests échouent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-saisie && npm test -- tests/Saisie.test.jsx
```

Attendu: FAIL (stub vide)

- [ ] **Étape 3: Remplacer `src/pages/Saisie.jsx`**

```jsx
import { useState, useEffect } from "react";
import { getClients, getProjetsByClient, createEntreeComplete, getEntreesRecentes, getParametre } from "../db/database";
import "./Saisie.css";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDuration(minutes) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
}

function formatTime(isoStr) {
  return isoStr ? isoStr.slice(11, 16) : "—";
}

function formatDate(isoStr) {
  return isoStr ? isoStr.slice(0, 10) : "—";
}

export default function Saisie() {
  const [clients, setClients] = useState([]);
  const [projets, setProjets] = useState([]);
  const [clientId, setClientId] = useState("");
  const [projetId, setProjetId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [heureDebut, setHeureDebut] = useState("");
  const [heureFin, setHeureFin] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [entrees, setEntrees] = useState([]);

  useEffect(() => {
    getClients().then(setClients).catch(console.error);
    loadEntrees();
  }, []);

  useEffect(() => {
    if (!clientId) { setProjets([]); setProjetId(""); return; }
    getProjetsByClient(Number(clientId)).then(setProjets).catch(console.error);
  }, [clientId]);

  function loadEntrees() {
    getEntreesRecentes(10).then(setEntrees).catch(console.error);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!clientId) { setError("Veuillez sélectionner un client."); return; }
    if (!heureDebut || !heureFin) { setError("Veuillez saisir les heures de début et de fin."); return; }

    const debut = `${date}T${heureDebut}:00`;
    const fin = `${date}T${heureFin}:00`;

    if (new Date(fin) <= new Date(debut)) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }

    const duree_minutes = Math.round((new Date(fin) - new Date(debut)) / 60000);
    const arrondi = Number(await getParametre("arrondi_minutes")) || 15;
    const duree_arrondie_minutes = Math.ceil(Math.max(duree_minutes, 1) / arrondi) * arrondi;

    await createEntreeComplete({
      client_id: Number(clientId),
      projet_id: projetId ? Number(projetId) : null,
      debut,
      fin,
      duree_minutes,
      duree_arrondie_minutes,
      note: note || null,
    });

    setClientId("");
    setProjetId("");
    setHeureDebut("");
    setHeureFin("");
    setNote("");
    setDate(todayStr());
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    loadEntrees();
  }

  return (
    <div className="saisie-page">
      <h1 className="saisie-page__title">✏️ Saisie manuelle</h1>

      <form className="saisie-page__form" onSubmit={handleSubmit} noValidate>
        <div className="saisie-page__row">
          <div className="saisie-page__field">
            <label htmlFor="s-client">Client *</label>
            <select id="s-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— Choisir —</option>
              {clients.filter((c) => c.actif).map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div className="saisie-page__field">
            <label htmlFor="s-projet">Projet</label>
            <select id="s-projet" value={projetId} onChange={(e) => setProjetId(e.target.value)} disabled={!clientId}>
              <option value="">— Aucun —</option>
              {projets.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="saisie-page__row">
          <div className="saisie-page__field">
            <label htmlFor="s-date">Date</label>
            <input id="s-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="saisie-page__field">
            <label htmlFor="s-debut">Début</label>
            <input id="s-debut" type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
          </div>

          <div className="saisie-page__field">
            <label htmlFor="s-fin">Fin</label>
            <input id="s-fin" type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
          </div>
        </div>

        <div className="saisie-page__field saisie-page__field--full">
          <label htmlFor="s-note">Note</label>
          <textarea id="s-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Description du travail…" />
        </div>

        {error && <p className="saisie-page__error" role="alert">{error}</p>}
        {success && <p className="saisie-page__success" role="status">✓ Entrée ajoutée</p>}

        <button type="submit" className="saisie-page__btn">Ajouter l'entrée</button>
      </form>

      {entrees.length > 0 && (
        <section className="saisie-page__recents">
          <h2 className="saisie-page__recents-title">Entrées récentes</h2>
          <ul className="saisie-page__list">
            {entrees.map((e) => (
              <li key={e.id} className="saisie-page__item">
                <span className="saisie-page__item-date">{formatDate(e.debut)}</span>
                <span className="saisie-page__item-times">{formatTime(e.debut)} – {formatTime(e.fin)}</span>
                <span className="saisie-page__item-client">
                  {e.client_nom}{e.projet_nom ? ` · ${e.projet_nom}` : ""}
                </span>
                <span className="saisie-page__item-duree">
                  {formatDuration(e.duree_arrondie_minutes ?? e.duree_minutes)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Étape 4: Créer `src/pages/Saisie.css`**

```css
.saisie-page {
  max-width: 560px;
  margin: 0 auto;
  padding-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.saisie-page__title {
  font-family: var(--font-title);
  font-size: 22px;
  color: var(--color-text);
  font-weight: 700;
}

.saisie-page__form {
  background: white;
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.saisie-page__row {
  display: flex;
  gap: 12px;
}

.saisie-page__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.saisie-page__field--full {
  flex: none;
  width: 100%;
}

.saisie-page__field label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.saisie-page__field input,
.saisie-page__field select,
.saisie-page__field textarea {
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

.saisie-page__field input:focus,
.saisie-page__field select:focus,
.saisie-page__field textarea:focus {
  border-color: var(--color-accent);
}

.saisie-page__field select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.saisie-page__field textarea {
  resize: none;
}

.saisie-page__error {
  font-size: 13px;
  color: #e76f51;
  font-weight: 600;
}

.saisie-page__success {
  font-size: 13px;
  color: var(--color-text-muted);
  font-weight: 600;
}

.saisie-page__btn {
  background: var(--color-accent);
  color: var(--color-sidebar);
  border: none;
  border-radius: 12px;
  padding: 12px 32px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-body);
  transition: opacity 0.15s;
  align-self: flex-start;
}

.saisie-page__btn:hover {
  opacity: 0.85;
}

.saisie-page__recents {
  background: white;
  border-radius: var(--radius);
  padding: 16px 20px;
  box-shadow: var(--shadow);
}

.saisie-page__recents-title {
  font-family: var(--font-title);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.saisie-page__list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.saisie-page__item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  padding: 8px 0;
  border-bottom: 1px solid #e8f8ee;
}

.saisie-page__item:last-child {
  border-bottom: none;
}

.saisie-page__item-date {
  color: var(--color-text-muted);
  font-size: 12px;
  min-width: 85px;
}

.saisie-page__item-times {
  color: var(--color-text-muted);
  font-size: 12px;
  min-width: 90px;
}

.saisie-page__item-client {
  flex: 1;
  color: var(--color-text);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saisie-page__item-duree {
  color: var(--color-accent);
  font-weight: 700;
  font-family: var(--font-title);
  font-size: 14px;
  min-width: 48px;
  text-align: right;
}
```

- [ ] **Étape 5: Vérifier que tous les tests passent (24 au total)**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-saisie && npm test
```

Attendu: `Test Files  5 passed (5)`, `Tests  24 passed (24)`

- [ ] **Étape 6: Commit**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-saisie && git add src/pages/Saisie.jsx src/pages/Saisie.css tests/Saisie.test.jsx && git commit -m "feat(Saisie): add manual time entry form with validation and recent entries list"
```
