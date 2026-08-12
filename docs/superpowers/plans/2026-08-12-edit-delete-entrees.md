# Modifier / Supprimer des entrées de temps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'utilisateur de modifier et supprimer des entrées de temps depuis les pages Saisie et Rapports via un panel latéral.

**Architecture:** Nouveau composant `EntreePanel` (réutilisé dans Saisie et Rapports) qui s'ouvre à droite de la liste quand on clique une entrée. Deux nouvelles fonctions DB : `updateEntree` et `deleteEntree`. Les requêtes `getEntreesRecentes` et `getEntreesParPeriode` sont enrichies pour retourner `client_id`, `projet_id` et `facture_id`. Les entrées facturées peuvent être modifiées mais pas supprimées.

**Tech Stack:** React 18, SQLite via @tauri-apps/plugin-sql, Vitest + @testing-library/react, BEM CSS

---

## Contexte codebase

- `src/db/database.js` — fonctions DB existantes, pattern : `getDb()` retourne une instance SQLite partagée
- `src/pages/Saisie.jsx` (167 lignes) — formulaire + liste d'entrées récentes via `getEntreesRecentes(10)`
- `src/pages/Rapports.jsx` (186 lignes) — liste filtrée par période via `getEntreesParPeriode`
- `src/components/ClientPanel.jsx` — modèle du pattern panel latéral (à imiter)
- CSS vars : `--color-bg`, `--color-accent` (#7FD8A0), `--color-surface`, `--color-text`, `--color-text-muted`, `--radius` (12px), `--shadow`, `--font-title` (Fredoka), `--font-body` (Quicksand)
- Pattern BEM : un `.css` par composant, classes `.nom-composant__element--modifier`
- Tests : `vi.mock("@tauri-apps/plugin-sql", ...)`, `vi.mock("../src/db/database", ...)`
- Commande test : `npm test`

---

## Fichiers

| Fichier | Action |
|---|---|
| `src/db/database.js` | Ajouter `updateEntree`, `deleteEntree` ; modifier `getEntreesRecentes` et `getEntreesParPeriode` |
| `src/components/EntreePanel.jsx` | Créer — panel d'édition réutilisable |
| `src/components/EntreePanel.css` | Créer — styles BEM |
| `src/pages/Saisie.jsx` | Modifier — ajouter état sélection + render EntreePanel |
| `src/pages/Saisie.css` | Modifier — layout flex row |
| `src/pages/Rapports.jsx` | Modifier — ajouter état sélection + render EntreePanel |
| `src/pages/Rapports.css` | Modifier — layout flex row |
| `tests/database.entrees.test.js` | Créer — tests updateEntree, deleteEntree |
| `tests/EntreePanel.test.jsx` | Créer — tests composant |

---

### Task 1 : DB — `updateEntree`, `deleteEntree`, enrichissement des requêtes

**Files:**
- Modify: `src/db/database.js`
- Create: `tests/database.entrees.test.js`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Créer `tests/database.entrees.test.js` :

```js
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = { select: vi.fn(), execute: vi.fn() };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import { updateEntree, deleteEntree, getEntreesRecentes, getEntreesParPeriode } from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("updateEntree", () => {
  it("exécute UPDATE avec tous les champs", async () => {
    mockDb.execute.mockResolvedValue({});
    await updateEntree(5, {
      client_id: 1,
      projet_id: 2,
      debut: "2026-08-01T09:00:00",
      fin: "2026-08-01T11:00:00",
      duree_minutes: 120,
      duree_arrondie_minutes: 120,
      note: "Travail",
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      "UPDATE entrees_temps SET client_id=?, projet_id=?, debut=?, fin=?, duree_minutes=?, duree_arrondie_minutes=?, note=? WHERE id=?",
      [1, 2, "2026-08-01T09:00:00", "2026-08-01T11:00:00", 120, 120, "Travail", 5]
    );
  });

  it("accepte projet_id null", async () => {
    mockDb.execute.mockResolvedValue({});
    await updateEntree(5, {
      client_id: 1,
      projet_id: null,
      debut: "2026-08-01T09:00:00",
      fin: "2026-08-01T11:00:00",
      duree_minutes: 120,
      duree_arrondie_minutes: 120,
      note: null,
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.any(String),
      [1, null, "2026-08-01T09:00:00", "2026-08-01T11:00:00", 120, 120, null, 5]
    );
  });
});

describe("deleteEntree", () => {
  it("supprime l'entrée si elle n'est pas facturée", async () => {
    mockDb.select.mockResolvedValue([{ facture_id: null }]);
    mockDb.execute.mockResolvedValue({});
    await deleteEntree(3);
    expect(mockDb.execute).toHaveBeenCalledWith(
      "DELETE FROM entrees_temps WHERE id = ?",
      [3]
    );
  });

  it("lance une erreur si l'entrée est liée à une facture", async () => {
    mockDb.select.mockResolvedValue([{ facture_id: 7 }]);
    await expect(deleteEntree(3)).rejects.toThrow("liée à une facture");
    expect(mockDb.execute).not.toHaveBeenCalled();
  });
});

describe("getEntreesRecentes", () => {
  it("inclut client_id, projet_id et facture_id dans le SELECT", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesRecentes(10);
    const query = mockDb.select.mock.calls[0][0];
    expect(query).toContain("e.client_id");
    expect(query).toContain("e.projet_id");
    expect(query).toContain("e.facture_id");
  });
});

describe("getEntreesParPeriode", () => {
  it("inclut projet_id et facture_id dans le SELECT", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesParPeriode({ debut: "2026-08-01T00:00:00", fin: "2026-09-01T00:00:00" });
    const query = mockDb.select.mock.calls[0][0];
    expect(query).toContain("e.projet_id");
    expect(query).toContain("e.facture_id");
  });
});
```

- [ ] **Étape 2 : Vérifier que les tests échouent**

```bash
npm test -- tests/database.entrees.test.js
```

Résultat attendu : FAIL — `updateEntree is not a function`

- [ ] **Étape 3 : Ajouter les fonctions dans `database.js`**

Ajouter à la fin de `src/db/database.js` :

```js
export async function updateEntree(id, { client_id, projet_id, debut, fin, duree_minutes, duree_arrondie_minutes, note }) {
  const d = await getDb();
  await d.execute(
    "UPDATE entrees_temps SET client_id=?, projet_id=?, debut=?, fin=?, duree_minutes=?, duree_arrondie_minutes=?, note=? WHERE id=?",
    [client_id, projet_id ?? null, debut, fin, duree_minutes, duree_arrondie_minutes ?? null, note || null, id]
  );
}

export async function deleteEntree(id) {
  const d = await getDb();
  const rows = await d.select("SELECT facture_id FROM entrees_temps WHERE id = ?", [id]);
  if (rows[0]?.facture_id) throw new Error("Cette entrée est liée à une facture.");
  await d.execute("DELETE FROM entrees_temps WHERE id = ?", [id]);
}
```

- [ ] **Étape 4 : Enrichir `getEntreesRecentes`**

Remplacer dans `src/db/database.js` la fonction `getEntreesRecentes` :

```js
export async function getEntreesRecentes(limit = 10) {
  const d = await getDb();
  return d.select(
    `SELECT e.id, e.client_id, e.projet_id, e.facture_id,
            e.debut, e.fin, e.duree_minutes, e.duree_arrondie_minutes, e.note,
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

- [ ] **Étape 5 : Enrichir `getEntreesParPeriode`**

Remplacer dans `src/db/database.js` la fonction `getEntreesParPeriode` :

```js
export async function getEntreesParPeriode({ debut, fin, client_id = null }) {
  const d = await getDb();
  const params = [debut, fin];
  const clientClause = client_id ? "AND e.client_id = ?" : "";
  if (client_id) params.push(client_id);
  return d.select(
    `SELECT e.id, e.client_id, e.projet_id, e.facture_id,
            e.debut, e.fin, e.duree_minutes, e.duree_arrondie_minutes, e.note,
            c.nom AS client_nom, c.taux_horaire AS client_taux,
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

- [ ] **Étape 6 : Vérifier que les tests passent**

```bash
npm test -- tests/database.entrees.test.js
```

Résultat attendu : PASS (6 tests)

- [ ] **Étape 7 : Vérifier que les tests existants passent toujours**

```bash
npm test
```

Résultat attendu : tous les tests passent

- [ ] **Étape 8 : Commit**

```bash
git add src/db/database.js tests/database.entrees.test.js
git commit -m "feat(db): add updateEntree, deleteEntree, enrich entrees queries"
```

---

### Task 2 : Composant `EntreePanel`

**Files:**
- Create: `src/components/EntreePanel.jsx`
- Create: `src/components/EntreePanel.css`
- Create: `tests/EntreePanel.test.jsx`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Créer `tests/EntreePanel.test.jsx` :

```jsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getProjetsByClient: vi.fn(),
  updateEntree: vi.fn(),
  deleteEntree: vi.fn(),
  getParametre: vi.fn(),
}));

import EntreePanel from "../src/components/EntreePanel";
import { getProjetsByClient, updateEntree, deleteEntree, getParametre } from "../src/db/database";

const clients = [
  { id: 1, nom: "Studio Lumière", actif: 1 },
  { id: 2, nom: "AgenceX", actif: 1 },
];

const entree = {
  id: 10,
  client_id: 1,
  projet_id: null,
  debut: "2026-08-01T09:00:00",
  fin: "2026-08-01T11:00:00",
  duree_minutes: 120,
  duree_arrondie_minutes: 120,
  note: "Réunion",
  facture_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getProjetsByClient.mockResolvedValue([{ id: 5, nom: "Site web" }]);
  updateEntree.mockResolvedValue(undefined);
  deleteEntree.mockResolvedValue(undefined);
  getParametre.mockResolvedValue("15");
});

describe("EntreePanel", () => {
  it("affiche les champs préremplis avec les valeurs de l'entrée", async () => {
    render(<EntreePanel entree={entree} clients={clients} onSaved={vi.fn()} onDeleted={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("09:00")).toBeInTheDocument());
    expect(screen.getByDisplayValue("11:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-08-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Réunion")).toBeInTheDocument();
  });

  it("appelle updateEntree et onSaved lors de la sauvegarde", async () => {
    const onSaved = vi.fn();
    render(<EntreePanel entree={entree} clients={clients} onSaved={onSaved} onDeleted={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => screen.getByDisplayValue("09:00"));
    fireEvent.click(screen.getByRole("button", { name: /sauvegarder/i }));
    await waitFor(() => expect(updateEntree).toHaveBeenCalledWith(10, expect.objectContaining({
      client_id: 1,
      debut: "2026-08-01T09:00:00",
      fin: "2026-08-01T11:00:00",
    })));
    expect(onSaved).toHaveBeenCalled();
  });

  it("appelle deleteEntree et onDeleted après confirmation", async () => {
    const onDeleted = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<EntreePanel entree={entree} clients={clients} onSaved={vi.fn()} onDeleted={onDeleted} onClose={vi.fn()} />);
    await waitFor(() => screen.getByDisplayValue("09:00"));
    fireEvent.click(screen.getByRole("button", { name: /supprimer/i }));
    await waitFor(() => expect(deleteEntree).toHaveBeenCalledWith(10));
    expect(onDeleted).toHaveBeenCalled();
  });

  it("désactive le bouton supprimer si l'entrée est facturée", async () => {
    const entreeFacturee = { ...entree, facture_id: 3 };
    render(<EntreePanel entree={entreeFacturee} clients={clients} onSaved={vi.fn()} onDeleted={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => screen.getByDisplayValue("09:00"));
    expect(screen.getByRole("button", { name: /supprimer/i })).toBeDisabled();
  });

  it("appelle onClose quand on clique Fermer", async () => {
    const onClose = vi.fn();
    render(<EntreePanel entree={entree} clients={clients} onSaved={vi.fn()} onDeleted={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /✕/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Étape 2 : Vérifier que les tests échouent**

```bash
npm test -- tests/EntreePanel.test.jsx
```

Résultat attendu : FAIL — `Cannot find module '../src/components/EntreePanel'`

- [ ] **Étape 3 : Créer `EntreePanel.jsx`**

Créer `src/components/EntreePanel.jsx` :

```jsx
import { useState, useEffect } from "react";
import { getProjetsByClient, updateEntree, deleteEntree, getParametre } from "../db/database";
import "./EntreePanel.css";

function isoToDate(isoStr) {
  return isoStr ? isoStr.slice(0, 10) : "";
}

function isoToTime(isoStr) {
  return isoStr ? isoStr.slice(11, 16) : "";
}

export default function EntreePanel({ entree, clients, onSaved, onDeleted, onClose }) {
  const [clientId, setClientId] = useState(String(entree.client_id));
  const [projetId, setProjetId] = useState(entree.projet_id ? String(entree.projet_id) : "");
  const [date, setDate] = useState(isoToDate(entree.debut));
  const [heureDebut, setHeureDebut] = useState(isoToTime(entree.debut));
  const [heureFin, setHeureFin] = useState(isoToTime(entree.fin));
  const [note, setNote] = useState(entree.note ?? "");
  const [projets, setProjets] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) { setProjets([]); setProjetId(""); return; }
    getProjetsByClient(Number(clientId)).then(setProjets).catch(console.error);
  }, [clientId]);

  async function handleSave() {
    if (!clientId || !date || !heureDebut || !heureFin) {
      setError("Client, date et heures sont requis.");
      return;
    }
    const debut = `${date}T${heureDebut}:00`;
    const fin = `${date}T${heureFin}:00`;
    if (new Date(fin) <= new Date(debut)) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    const duree_minutes = Math.round((new Date(fin) - new Date(debut)) / 60000);
    const arrondi = Number(await getParametre("arrondi_minutes")) || 15;
    const duree_arrondie_minutes = Math.ceil(Math.max(duree_minutes, 1) / arrondi) * arrondi;
    setError("");
    setSaving(true);
    try {
      await updateEntree(entree.id, {
        client_id: Number(clientId),
        projet_id: projetId ? Number(projetId) : null,
        debut,
        fin,
        duree_minutes,
        duree_arrondie_minutes,
        note: note || null,
      });
      onSaved();
    } catch (e) {
      console.error(e);
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Supprimer cette entrée ?")) return;
    try {
      await deleteEntree(entree.id);
      onDeleted();
    } catch (e) {
      setError(e.message || "Erreur lors de la suppression.");
    }
  }

  const isFacturee = Boolean(entree.facture_id);

  return (
    <aside className="entree-panel">
      <div className="entree-panel__header">
        <h2 className="entree-panel__title">Modifier l'entrée</h2>
        <button className="entree-panel__close" onClick={onClose} aria-label="✕">✕</button>
      </div>

      <div className="entree-panel__body">
        <div className="entree-panel__field">
          <label htmlFor="ep-client">Client *</label>
          <select id="ep-client" value={clientId} onChange={(e) => { setClientId(e.target.value); setProjetId(""); }}>
            <option value="">— Choisir —</option>
            {clients.filter((c) => c.actif).map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>

        <div className="entree-panel__field">
          <label htmlFor="ep-projet">Projet</label>
          <select id="ep-projet" value={projetId} onChange={(e) => setProjetId(e.target.value)} disabled={!clientId}>
            <option value="">— Aucun —</option>
            {projets.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>

        <div className="entree-panel__field">
          <label htmlFor="ep-date">Date *</label>
          <input id="ep-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="entree-panel__row">
          <div className="entree-panel__field">
            <label htmlFor="ep-debut">Début *</label>
            <input id="ep-debut" type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
          </div>
          <div className="entree-panel__field">
            <label htmlFor="ep-fin">Fin *</label>
            <input id="ep-fin" type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
          </div>
        </div>

        <div className="entree-panel__field">
          <label htmlFor="ep-note">Note</label>
          <textarea id="ep-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Description…" />
        </div>

        {error && <p className="entree-panel__error">{error}</p>}

        {isFacturee && (
          <p className="entree-panel__warning">Cette entrée est liée à une facture.</p>
        )}

        <div className="entree-panel__actions">
          <button className="entree-panel__btn-save" onClick={handleSave} disabled={saving}>
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>
          <button
            className="entree-panel__btn-delete"
            onClick={handleDelete}
            disabled={isFacturee}
            title={isFacturee ? "Entrée liée à une facture — suppression impossible" : "Supprimer"}
          >
            Supprimer
          </button>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Étape 4 : Créer `EntreePanel.css`**

Créer `src/components/EntreePanel.css` :

```css
.entree-panel {
  width: 280px;
  flex-shrink: 0;
  background: white;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  align-self: flex-start;
  animation: ep-in 0.15s ease;
}

@keyframes ep-in {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}

.entree-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid #eee;
}

.entree-panel__title {
  font-family: var(--font-title);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

.entree-panel__close {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--color-text-muted);
  line-height: 1;
  padding: 2px 6px;
}

.entree-panel__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
}

.entree-panel__row {
  display: flex;
  gap: 8px;
}

.entree-panel__row .entree-panel__field {
  flex: 1;
}

.entree-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.entree-panel__field label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.entree-panel__field input,
.entree-panel__field select,
.entree-panel__field textarea {
  border: 1.5px solid #c8efd8;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--color-text);
  background: white;
  outline: none;
  font-family: var(--font-body);
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.entree-panel__field input:focus,
.entree-panel__field select:focus,
.entree-panel__field textarea:focus {
  border-color: var(--color-accent);
}

.entree-panel__field textarea {
  resize: vertical;
}

.entree-panel__error {
  font-size: 12px;
  color: #c0392b;
  margin: 0;
}

.entree-panel__warning {
  font-size: 11px;
  color: #e67e22;
  margin: 0;
  font-style: italic;
}

.entree-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.entree-panel__btn-save {
  background: var(--color-accent);
  color: #1a3d2b;
  border: none;
  border-radius: 8px;
  padding: 9px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-body);
}

.entree-panel__btn-save:disabled {
  opacity: 0.6;
  cursor: default;
}

.entree-panel__btn-delete {
  background: none;
  border: 1.5px solid #e74c3c;
  border-radius: 8px;
  padding: 7px;
  font-size: 12px;
  font-weight: 600;
  color: #e74c3c;
  cursor: pointer;
  font-family: var(--font-body);
}

.entree-panel__btn-delete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: #ccc;
  color: #ccc;
}
```

- [ ] **Étape 5 : Vérifier que les tests passent**

```bash
npm test -- tests/EntreePanel.test.jsx
```

Résultat attendu : PASS (5 tests)

- [ ] **Étape 6 : Commit**

```bash
git add src/components/EntreePanel.jsx src/components/EntreePanel.css tests/EntreePanel.test.jsx
git commit -m "feat(EntreePanel): add edit/delete panel for time entries"
```

---

### Task 3 : Intégration dans Saisie

**Files:**
- Modify: `src/pages/Saisie.jsx`
- Modify: `src/pages/Saisie.css`

- [ ] **Étape 1 : Modifier `Saisie.jsx`**

Remplacer le contenu complet de `src/pages/Saisie.jsx` :

```jsx
import { useState, useEffect } from "react";
import {
  getClients, getProjetsByClient, createEntreeComplete,
  getEntreesRecentes, getParametre,
} from "../db/database";
import EntreePanel from "../components/EntreePanel";
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
  const [selectedId, setSelectedId] = useState(null);

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

  function handleEntreeClick(id) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  const selectedEntree = entrees.find((e) => e.id === selectedId) ?? null;

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
          <div className="saisie-page__body">
            <ul className="saisie-page__list">
              {entrees.map((e) => (
                <li
                  key={e.id}
                  className={`saisie-page__item${selectedId === e.id ? " saisie-page__item--selected" : ""}`}
                  onClick={() => handleEntreeClick(e.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => ev.key === "Enter" && handleEntreeClick(e.id)}
                >
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

            {selectedEntree && (
              <EntreePanel
                key={selectedEntree.id}
                entree={selectedEntree}
                clients={clients}
                onSaved={() => { setSelectedId(null); loadEntrees(); }}
                onDeleted={() => { setSelectedId(null); loadEntrees(); }}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Étape 2 : Ajouter le layout flex dans `Saisie.css`**

Ajouter à la fin de `src/pages/Saisie.css` :

```css
.saisie-page__body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.saisie-page__list {
  flex: 1;
  min-width: 0;
}

.saisie-page__item {
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: border-color 0.15s, background 0.15s;
}

.saisie-page__item:hover {
  background: #f5fdf8;
}

.saisie-page__item--selected {
  border-left-color: var(--color-accent);
  background: #f0faf5;
}
```

- [ ] **Étape 3 : Vérifier dans l'app**

Lancer `npm run tauri dev`, aller sur la page Saisie, cliquer une entrée → le panel s'ouvre à droite. Modifier et sauvegarder → la liste se rafraîchit. Supprimer → l'entrée disparaît. Cliquer la même entrée → le panel se ferme.

- [ ] **Étape 4 : Commit**

```bash
git add src/pages/Saisie.jsx src/pages/Saisie.css
git commit -m "feat(Saisie): add entry edit/delete via side panel"
```

---

### Task 4 : Intégration dans Rapports

**Files:**
- Modify: `src/pages/Rapports.jsx`
- Modify: `src/pages/Rapports.css`

- [ ] **Étape 1 : Modifier `Rapports.jsx`**

Remplacer le contenu complet de `src/pages/Rapports.jsx` :

```jsx
import { useState, useEffect } from "react";
import { getClients, getEntreesParPeriode } from "../db/database";
import EntreePanel from "../components/EntreePanel";
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
  return h > 0 ? `${h}h${m > 0 ? m : ""}` : `${m}m`;
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
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    getClients().then(setClients).catch(console.error);
  }, []);

  useEffect(() => {
    setSelectedId(null);
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

  function loadEntrees() {
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
  }

  const { totalMinutes, byClient } = computeResume(entrees);
  const selectedEntree = entrees.find((e) => e.id === selectedId) ?? null;

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
            <option key={c.id} value={c.id}>» {c.nom}</option>
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
          <div className="rapports-page__body">
            <ul className="rapports-page__list">
              {entrees.map((e) => (
                <li
                  key={e.id}
                  className={`rapports-page__item${selectedId === e.id ? " rapports-page__item--selected" : ""}`}
                  onClick={() => setSelectedId((prev) => (prev === e.id ? null : e.id))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => ev.key === "Enter" && setSelectedId((prev) => (prev === e.id ? null : e.id))}
                >
                  <span className="rapports-page__item-date">{formatDate(e.debut)}</span>
                  <span className="rapports-page__item-client">
                    {clients.length > 1 ? `${e.client_nom}${e.projet_nom ? ` · ${e.projet_nom}` : ""}` : (e.projet_nom || "—")}
                  </span>
                  <span className="rapports-page__item-duree">
                    {formatDuration(e.duree_arrondie_minutes ?? e.duree_minutes)}
                  </span>
                  {e.note && <span className="rapports-page__item-note">{e.note}</span>}
                </li>
              ))}
            </ul>

            {selectedEntree && (
              <EntreePanel
                key={selectedEntree.id}
                entree={selectedEntree}
                clients={clients}
                onSaved={() => { setSelectedId(null); loadEntrees(); }}
                onDeleted={() => { setSelectedId(null); loadEntrees(); }}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        </section>
      ) : (
        <p className="rapports-page__empty">Aucune entrée pour cette période.</p>
      )}
    </div>
  );
}
```

- [ ] **Étape 2 : Ajouter le layout flex dans `Rapports.css`**

Ajouter à la fin de `src/pages/Rapports.css` :

```css
.rapports-page__body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.rapports-page__list {
  flex: 1;
  min-width: 0;
}

.rapports-page__item {
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: border-color 0.15s, background 0.15s;
}

.rapports-page__item:hover {
  background: #f5fdf8;
}

.rapports-page__item--selected {
  border-left-color: var(--color-accent);
  background: #f0faf5;
}
```

- [ ] **Étape 3 : Vérifier dans l'app**

Aller sur la page Rapports, cliquer une entrée → le panel s'ouvre. Modifier → la liste se rafraîchit. Supprimer → l'entrée disparaît de la liste et du résumé.

- [ ] **Étape 4 : Lancer tous les tests**

```bash
npm test
```

Résultat attendu : tous les tests passent.

- [ ] **Étape 5 : Commit**

```bash
git add src/pages/Rapports.jsx src/pages/Rapports.css
git commit -m "feat(Rapports): add entry edit/delete via side panel"
```
