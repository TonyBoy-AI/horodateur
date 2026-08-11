# Facture PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Générer et télécharger un PDF de facture rempli à partir du template de Noémy Bizier, en ajoutant les champs téléphone et personne_reference aux clients.

**Architecture:** Migration SQLite pour les nouveaux champs client → fonctions DB → UI ClientPanel → utilitaire generatePdf.js (pdf-lib overlay sur template) → intégration dans Factures.jsx (download au submit + bouton re-download).

**Tech Stack:** React 18, Tauri 2 + plugin-sql (SQLite), pdf-lib, Vitest + @testing-library/react

---

## Contexte codebase

- Worktree: `.worktrees/feat-facture-pdf`, branche `feat/facture-pdf`
- `src/db/database.js` : fonctions async, pattern `getDb()` → `d.select` / `d.execute`
- `src/components/ClientPanel.jsx` : formulaire client, EMPTY_FORM, useEffect, handleSave
- `src/pages/Factures.jsx` : liste factures + panel création (handleSubmit, toggleStatut)
- Table `clients` : `id, nom, taux_horaire, courriel, adresse, couleur, actif, cree_le` — manque `telephone` et `personne_reference`
- Table `entrees_temps` : `id, client_id, debut, fin, duree_minutes, duree_arrondie_minutes, note, facture_id`
- `getFactures()` retourne `f.id, f.numero, f.date_emission, f.montant_total, f.statut, c.nom AS client_nom` — manque `f.client_id`
- Tests: `vitest run` dans le worktree, baseline 42 tests (9 fichiers)
- Template PDF: `Comptabilité - Noémy Bizier - Template  - Facture.pdf` à la racine du projet

---

## Fichiers

| Action | Fichier |
|--------|---------|
| CREATE | `src-tauri/migrations/003_client_contact.sql` |
| MODIFY | `src/db/database.js` |
| MODIFY | `src/components/ClientPanel.jsx` |
| CREATE | `tests/database.clientContact.test.js` |
| CREATE | `tests/ClientPanel.test.jsx` (ou modifier si existant) |
| COPY | `public/template-facture.pdf` |
| CREATE | `src/utils/generatePdf.js` |
| CREATE | `tests/generatePdf.test.js` |
| MODIFY | `src/pages/Factures.jsx` |
| MODIFY | `src/pages/Factures.css` |
| MODIFY | `tests/Factures.test.jsx` |

---

### Task 1: BD — Migration + DB functions

**Files:**
- Create: `src-tauri/migrations/003_client_contact.sql`
- Modify: `src/db/database.js`
- Test: `tests/database.clientContact.test.js`

- [ ] **Étape 1: Écrire les tests qui échouent**

Créer `tests/database.clientContact.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = { select: vi.fn(), execute: vi.fn() };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import { createClient, updateClient, getEntreesParFacture, getFactures } from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("createClient avec nouveaux champs", () => {
  it("persiste telephone et personne_reference", async () => {
    mockDb.execute.mockResolvedValue({ lastInsertId: 1 });
    await createClient({
      nom: "Studio Test", taux_horaire: 80, courriel: "test@test.com",
      adresse: "123 rue Test", telephone: "581-000-0000",
      personne_reference: "Jean Dupont", couleur: "#7FD8A0", actif: true,
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      "INSERT INTO clients (nom, taux_horaire, courriel, adresse, telephone, personne_reference, couleur, actif) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["Studio Test", 80, "test@test.com", "123 rue Test", "581-000-0000", "Jean Dupont", "#7FD8A0", 1]
    );
  });
});

describe("updateClient avec nouveaux champs", () => {
  it("met à jour telephone et personne_reference", async () => {
    mockDb.execute.mockResolvedValue({});
    await updateClient(1, {
      nom: "Studio Test", taux_horaire: 80, courriel: "test@test.com",
      adresse: "123 rue Test", telephone: "581-111-1111",
      personne_reference: "Marie Tremblay", couleur: "#7FD8A0", actif: true,
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      "UPDATE clients SET nom=?, taux_horaire=?, courriel=?, adresse=?, telephone=?, personne_reference=?, couleur=?, actif=? WHERE id=?",
      ["Studio Test", 80, "test@test.com", "123 rue Test", "581-111-1111", "Marie Tremblay", "#7FD8A0", 1, 1]
    );
  });
});

describe("getEntreesParFacture", () => {
  it("sélectionne les entrées avec le bon facture_id", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesParFacture(3);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("facture_id = ?"),
      [3]
    );
  });
});

describe("getFactures inclut client_id", () => {
  it("sélectionne f.client_id", async () => {
    mockDb.select.mockResolvedValue([]);
    await getFactures();
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("f.client_id")
    );
  });
});
```

- [ ] **Étape 2: Vérifier que les tests échouent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm test -- tests/database.clientContact.test.js
```

Attendu: FAIL — `getEntreesParFacture is not a function`

- [ ] **Étape 3: Créer `src-tauri/migrations/003_client_contact.sql`**

```sql
ALTER TABLE clients ADD COLUMN telephone TEXT;
ALTER TABLE clients ADD COLUMN personne_reference TEXT;
```

- [ ] **Étape 4: Modifier `src/db/database.js`**

Remplacer `createClient` (ligne 23) :

```js
export async function createClient({ nom, taux_horaire, courriel, adresse, telephone, personne_reference, couleur, actif }) {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO clients (nom, taux_horaire, courriel, adresse, telephone, personne_reference, couleur, actif) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [nom, taux_horaire, courriel || null, adresse || null, telephone || null, personne_reference || null, couleur || "#7FD8A0", actif ? 1 : 0]
  );
  return result.lastInsertId;
}
```

Remplacer `updateClient` (ligne 32) :

```js
export async function updateClient(id, { nom, taux_horaire, courriel, adresse, telephone, personne_reference, couleur, actif }) {
  const d = await getDb();
  await d.execute(
    "UPDATE clients SET nom=?, taux_horaire=?, courriel=?, adresse=?, telephone=?, personne_reference=?, couleur=?, actif=? WHERE id=?",
    [nom, taux_horaire, courriel || null, adresse || null, telephone || null, personne_reference || null, couleur || "#7FD8A0", actif ? 1 : 0, id]
  );
}
```

Modifier `getFactures` (ligne 162) — ajouter `f.client_id` au SELECT :

```js
export async function getFactures() {
  const d = await getDb();
  return d.select(
    `SELECT f.id, f.client_id, f.numero, f.date_emission, f.montant_total, f.statut,
            c.nom AS client_nom
     FROM factures f
     LEFT JOIN clients c ON c.id = f.client_id
     ORDER BY f.date_emission DESC`
  );
}
```

Ajouter à la fin de `src/db/database.js` :

```js
export async function getEntreesParFacture(facture_id) {
  const d = await getDb();
  return d.select(
    `SELECT id, debut, fin, duree_minutes, duree_arrondie_minutes, note
     FROM entrees_temps
     WHERE facture_id = ? AND fin IS NOT NULL
     ORDER BY debut ASC`,
    [facture_id]
  );
}
```

- [ ] **Étape 5: Vérifier que les 4 tests passent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm test -- tests/database.clientContact.test.js
```

Attendu: PASS (4 tests)

- [ ] **Étape 6: Vérifier que la suite complète passe**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm test
```

Attendu: 46 tests (10 fichiers) — les tests de `getFactures` existants passent toujours.

- [ ] **Étape 7: Commit**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && git add src-tauri/migrations/003_client_contact.sql src/db/database.js tests/database.clientContact.test.js && git commit -m "feat(db): add telephone, personne_reference to clients; add getEntreesParFacture"
```

---

### Task 2: ClientPanel — Téléphone + Personne référence

**Files:**
- Modify: `src/components/ClientPanel.jsx`
- Test: `tests/ClientPanel.test.jsx`

- [ ] **Étape 1: Écrire les tests qui échouent**

Vérifier d'abord si `tests/ClientPanel.test.jsx` existe. Si oui, ajouter les tests ci-dessous à la fin. Si non, créer le fichier :

```jsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  getProjetsByClient: vi.fn(),
}));

import ClientPanel from "../src/components/ClientPanel";
import { createClient, getProjetsByClient } from "../src/db/database";

beforeEach(() => {
  vi.clearAllMocks();
  getProjetsByClient.mockResolvedValue([]);
  createClient.mockResolvedValue(1);
});

describe("ClientPanel — nouveaux champs contact", () => {
  it("affiche le champ téléphone", () => {
    render(<ClientPanel client={null} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} />);
    expect(screen.getByLabelText(/téléphone/i)).toBeInTheDocument();
  });

  it("affiche le champ personne de référence", () => {
    render(<ClientPanel client={null} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} />);
    expect(screen.getByLabelText(/référence/i)).toBeInTheDocument();
  });

  it("pré-remplit telephone depuis le client existant", () => {
    const client = {
      id: 1, nom: "Studio", taux_horaire: 80, courriel: "", adresse: "",
      telephone: "581-999-1234", personne_reference: "Alice", couleur: "#7FD8A0", actif: 1,
    };
    render(<ClientPanel client={client} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} />);
    expect(screen.getByDisplayValue("581-999-1234")).toBeInTheDocument();
  });

  it("inclut telephone et personne_reference lors de la création", async () => {
    render(<ClientPanel client={null} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} />);
    await userEvent.type(screen.getByLabelText(/nom \*/i), "Test Corp");
    await userEvent.type(screen.getByLabelText(/taux horaire/i), "75");
    await userEvent.type(screen.getByLabelText(/téléphone/i), "418-000-0000");
    await userEvent.type(screen.getByLabelText(/référence/i), "Bob Martin");
    await userEvent.click(screen.getByText(/sauvegarder/i));
    await waitFor(() =>
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({ telephone: "418-000-0000", personne_reference: "Bob Martin" })
      )
    );
  });
});
```

- [ ] **Étape 2: Vérifier que les tests échouent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm test -- tests/ClientPanel.test.jsx
```

Attendu: FAIL — champs absents du formulaire

- [ ] **Étape 3: Modifier `src/components/ClientPanel.jsx`**

Remplacer `EMPTY_FORM` :

```js
const EMPTY_FORM = {
  nom: "",
  taux_horaire: "",
  courriel: "",
  adresse: "",
  telephone: "",
  personne_reference: "",
  couleur: "#7FD8A0",
  actif: true,
};
```

Dans le `useEffect` qui peuple depuis `client` (ligne 27), ajouter les 2 champs :

```js
setForm({
  nom: client.nom,
  taux_horaire: client.taux_horaire,
  courriel: client.courriel ?? "",
  adresse: client.adresse ?? "",
  telephone: client.telephone ?? "",
  personne_reference: client.personne_reference ?? "",
  couleur: client.couleur ?? "#7FD8A0",
  actif: Boolean(client.actif),
});
```

Dans le JSX, après le bloc `cp-courriel` (ligne 129) et avant `cp-adresse`, ajouter :

```jsx
<div className="client-panel__field">
  <label htmlFor="cp-telephone">Téléphone</label>
  <input
    id="cp-telephone"
    type="tel"
    value={form.telephone}
    onChange={(e) => set("telephone", e.target.value)}
    placeholder="581-000-0000"
  />
</div>

<div className="client-panel__field">
  <label htmlFor="cp-reference">Personne de référence (payeur)</label>
  <input
    id="cp-reference"
    type="text"
    value={form.personne_reference}
    onChange={(e) => set("personne_reference", e.target.value)}
    placeholder="Prénom Nom"
  />
</div>
```

Note: `handleSave` utilise `{ ...form, taux_horaire: Number(form.taux_horaire) }` — les 2 nouveaux champs sont automatiquement inclus via le spread.

- [ ] **Étape 4: Vérifier que les 4 tests passent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm test -- tests/ClientPanel.test.jsx
```

Attendu: PASS (4 tests, ou plus si le fichier existait déjà)

- [ ] **Étape 5: Commit**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && git add src/components/ClientPanel.jsx tests/ClientPanel.test.jsx && git commit -m "feat(Clients): add telephone and personne_reference fields"
```

---

### Task 3: generatePdf.js — Logique pure (groupement par semaine)

**Files:**
- Create: `src/utils/generatePdf.js` (fonctions pures seulement)
- Test: `tests/generatePdf.test.js`

- [ ] **Étape 1: Écrire les tests qui échouent**

Créer `tests/generatePdf.test.js` :

```js
import { describe, it, expect } from "vitest";
import { groupByWeek, formatWeekLabel } from "../src/utils/generatePdf";

const localStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("groupByWeek", () => {
  it("groupe des entrées de la même semaine ISO", () => {
    const entrees = [
      { id: 1, debut: "2026-08-10T09:00:00", duree_arrondie_minutes: 60, note: null },
      { id: 2, debut: "2026-08-12T14:00:00", duree_arrondie_minutes: 90, note: "Test" },
    ];
    const groups = groupByWeek(entrees);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(2);
  });

  it("sépare les entrées de semaines différentes", () => {
    const entrees = [
      { id: 1, debut: "2026-08-10T09:00:00", duree_arrondie_minutes: 60, note: null },
      { id: 2, debut: "2026-08-17T09:00:00", duree_arrondie_minutes: 90, note: null },
    ];
    expect(groupByWeek(entrees)).toHaveLength(2);
  });

  it("trie les semaines chronologiquement (plus ancien en premier)", () => {
    const entrees = [
      { id: 2, debut: "2026-08-17T09:00:00", duree_arrondie_minutes: 90, note: null },
      { id: 1, debut: "2026-08-10T09:00:00", duree_arrondie_minutes: 60, note: null },
    ];
    const groups = groupByWeek(entrees);
    expect(localStr(groups[0].monday)).toBe("2026-08-10");
    expect(localStr(groups[1].monday)).toBe("2026-08-17");
  });

  it("place le dimanche dans la semaine du lundi précédent", () => {
    // 2026-08-16 est un dimanche → lundi 2026-08-10
    const entrees = [
      { id: 1, debut: "2026-08-16T23:00:00", duree_arrondie_minutes: 30, note: null },
    ];
    const groups = groupByWeek(entrees);
    expect(localStr(groups[0].monday)).toBe("2026-08-10");
  });
});

describe("formatWeekLabel", () => {
  it("génère le label correct pour une semaine en août", () => {
    // 2026-08-10 est un lundi, dimanche = 2026-08-16
    const monday = new Date(2026, 7, 10);
    expect(formatWeekLabel(monday)).toBe("semaine du 10 août au 16 août");
  });

  it("génère le label correct quand la semaine chevauche deux mois", () => {
    // 2026-08-31 est un lundi, dimanche = 2026-09-06
    const monday = new Date(2026, 7, 31);
    expect(formatWeekLabel(monday)).toBe("semaine du 31 août au 6 sept.");
  });
});
```

- [ ] **Étape 2: Vérifier que les tests échouent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm test -- tests/generatePdf.test.js
```

Attendu: FAIL — `groupByWeek is not a function`

- [ ] **Étape 3: Créer `src/utils/generatePdf.js` avec les fonctions pures**

```js
const MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function getMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=dim, 1=lun, ..., 6=sam
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function groupByWeek(entrees) {
  const map = new Map();
  for (const e of entrees) {
    const monday = getMonday(e.debut);
    const key = localKey(monday);
    if (!map.has(key)) map.set(key, { monday, entries: [] });
    map.get(key).entries.push(e);
  }
  return [...map.values()].sort((a, b) => a.monday - b.monday);
}

export function formatWeekLabel(monday) {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d) => `${d.getDate()} ${MOIS_FR[d.getMonth()]}`;
  return `semaine du ${fmt(monday)} au ${fmt(sunday)}`;
}

export async function generatePdf(facture, client, entrees) {
  // Implemented in Task 4
  throw new Error("Not yet implemented");
}

export function downloadPdf(pdfBytes, filename) {
  // Implemented in Task 4
  throw new Error("Not yet implemented");
}
```

- [ ] **Étape 4: Vérifier que les 5 tests passent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm test -- tests/generatePdf.test.js
```

Attendu: PASS (5 tests — les 2 `generatePdf`/`downloadPdf` ne sont pas testés ici)

- [ ] **Étape 5: Commit**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && git add src/utils/generatePdf.js tests/generatePdf.test.js && git commit -m "feat(pdf): add groupByWeek and formatWeekLabel pure functions"
```

---

### Task 4: generatePdf.js — Overlay PDF avec pdf-lib

**Files:**
- Modify: `src/utils/generatePdf.js` (compléter `generatePdf` et `downloadPdf`)
- Add: `public/template-facture.pdf`

Cette tâche ne suit pas le cycle TDD car `generatePdf` requiert un fetch du template — les tests manuels visuels remplacent les tests unitaires.

- [ ] **Étape 1: Installer pdf-lib**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm install pdf-lib
```

Attendu: `pdf-lib` ajouté dans `node_modules/`

- [ ] **Étape 2: Copier le template dans `public/`**

```bash
cp "/c/Users/antho/horodateur/Comptabilité - Noémy Bizier - Template  - Facture.pdf" /c/Users/antho/horodateur/.worktrees/feat-facture-pdf/public/template-facture.pdf
```

- [ ] **Étape 3: Remplacer le contenu de `src/utils/generatePdf.js`**

```js
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function getMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function groupByWeek(entrees) {
  const map = new Map();
  for (const e of entrees) {
    const monday = getMonday(e.debut);
    const key = localKey(monday);
    if (!map.has(key)) map.set(key, { monday, entries: [] });
    map.get(key).entries.push(e);
  }
  return [...map.values()].sort((a, b) => a.monday - b.monday);
}

export function formatWeekLabel(monday) {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d) => `${d.getDate()} ${MOIS_FR[d.getMonth()]}`;
  return `semaine du ${fmt(monday)} au ${fmt(sunday)}`;
}

// Coordonnées en points (72pt = 1 pouce), origine bas-gauche.
// Ces valeurs sont des estimations initiales — voir Étape 4 pour calibrer.
const COORDS = {
  numero:        { x: 390, y: 703 },
  date:          { x: 498, y: 703 },
  nomEntreprise: { x: 42,  y: 636 },
  courriel:      { x: 42,  y: 619 },
  telephone:     { x: 42,  y: 602 },
  adresse:       { x: 42,  y: 585 },
  persRef:       { x: 374, y: 636 },
  tableFirstY:   474,
  tableRowH:     17.5,
  colDesc:       42,
  colNote:       185,
  colQty:        358,
  colPrix:       420,
  colMontant:    500,
  soustotal:     { x: 500, y: 118 },
  total:         { x: 500, y: 96  },
};

export async function generatePdf(facture, client, entrees) {
  const allWeeks = groupByWeek(entrees);
  const truncated = allWeeks.length > 8;
  const totalWeeks = allWeeks.length;
  const weeks = allWeeks.slice(0, 8);

  const resp = await fetch("/template-facture.pdf");
  if (!resp.ok) throw new Error("Template PDF introuvable");
  const arrayBuffer = await resp.arrayBuffer();

  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];
  const fontSize = 9;
  const black = rgb(0, 0, 0);

  const draw = (text, x, y) => {
    if (!text) return;
    page.drawText(String(text), { x, y, size: fontSize, font, color: black });
  };

  draw(facture.numero, COORDS.numero.x, COORDS.numero.y);
  draw(facture.date_emission, COORDS.date.x, COORDS.date.y);
  draw(client.nom, COORDS.nomEntreprise.x, COORDS.nomEntreprise.y);
  draw(client.courriel, COORDS.courriel.x, COORDS.courriel.y);
  draw(client.telephone, COORDS.telephone.x, COORDS.telephone.y);
  draw(client.adresse, COORDS.adresse.x, COORDS.adresse.y);
  draw(client.personne_reference, COORDS.persRef.x, COORDS.persRef.y);

  const taux = client.taux_horaire ?? 0;
  let sousTotal = 0;

  weeks.forEach((group, i) => {
    const y = COORDS.tableFirstY - i * COORDS.tableRowH;
    const notes = group.entries.map((e) => e.note).filter(Boolean).join(" / ");
    const totalMinutes = group.entries.reduce(
      (s, e) => s + (e.duree_arrondie_minutes ?? e.duree_minutes ?? 0), 0
    );
    const heures = (totalMinutes / 60).toFixed(2);
    const montant = ((totalMinutes / 60) * taux).toFixed(2);
    sousTotal += parseFloat(montant);

    draw(formatWeekLabel(group.monday), COORDS.colDesc, y);
    draw(notes, COORDS.colNote, y);
    draw(heures, COORDS.colQty, y);
    draw(String(taux), COORDS.colPrix, y);
    draw(montant, COORDS.colMontant, y);
  });

  draw(sousTotal.toFixed(2), COORDS.soustotal.x, COORDS.soustotal.y);
  draw(sousTotal.toFixed(2), COORDS.total.x, COORDS.total.y);

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, truncated, totalWeeks };
}

export function downloadPdf(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Étape 4: Calibrer les coordonnées**

Les coordonnées dans `COORDS` sont des estimations. Il faut les vérifier visuellement.

**Méthode :** Dans `src/pages/Factures.jsx`, ajouter temporairement un bouton "Test PDF" (après le bouton "+ Nouvelle facture") qui appelle `generatePdf` avec des données fictives et télécharge le résultat.

```jsx
// Bouton temporaire de calibration — à supprimer après calibration
<button onClick={async () => {
  const { generatePdf, downloadPdf } = await import("../utils/generatePdf");
  const { pdfBytes } = await generatePdf(
    { numero: "F-TEST-001", date_emission: "2026-08-11" },
    { nom: "ACME Corp", courriel: "test@acme.ca", telephone: "418-555-0000",
      adresse: "1 rue Test, Québec", personne_reference: "Jean Tremblay", taux_horaire: 80 },
    [
      { id: 1, debut: "2026-08-10T09:00:00", duree_arrondie_minutes: 90, note: "Réunion" },
      { id: 2, debut: "2026-08-11T14:00:00", duree_arrondie_minutes: 60, note: null },
    ]
  );
  downloadPdf(pdfBytes, "calibration.pdf");
}}>Calibration PDF</button>
```

Lancer l'app (`npm run tauri dev` dans un terminal séparé depuis la racine du projet), cliquer "Calibration PDF", ouvrir le PDF généré et comparer avec le template original. Ajuster les valeurs dans `COORDS` jusqu'à ce que les textes soient bien positionnés. Supprimer le bouton de calibration après.

- [ ] **Étape 5: Vérifier que les tests existants passent toujours**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm test -- tests/generatePdf.test.js
```

Attendu: PASS (5 tests — `groupByWeek` et `formatWeekLabel` sont inchangés)

- [ ] **Étape 6: Commit**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && git add src/utils/generatePdf.js public/template-facture.pdf package.json package-lock.json && git commit -m "feat(pdf): implement generatePdf PDF overlay with pdf-lib"
```

---

### Task 5: Factures.jsx — Download + Bouton re-download

**Files:**
- Modify: `src/pages/Factures.jsx`
- Modify: `src/pages/Factures.css`
- Modify: `tests/Factures.test.jsx`

- [ ] **Étape 1: Écrire les 2 nouveaux tests qui échouent**

Dans `tests/Factures.test.jsx`, ajouter en haut du fichier dans le bloc `vi.mock("../src/db/database", ...)` les nouvelles fonctions :

```js
vi.mock("../src/db/database", () => ({
  getClients: vi.fn(),
  getFactures: vi.fn(),
  getEntreesSansFacture: vi.fn(),
  createFacture: vi.fn(),
  linkEntreesToFacture: vi.fn(),
  updateFactureStatut: vi.fn(),
  getEntreesParFacture: vi.fn(), // NOUVEAU
}));
```

Ajouter en haut (après les imports existants) :

```js
vi.mock("../src/utils/generatePdf", () => ({
  generatePdf: vi.fn().mockResolvedValue({ pdfBytes: new Uint8Array(), truncated: false, totalWeeks: 1 }),
  downloadPdf: vi.fn(),
  groupByWeek: vi.fn().mockReturnValue([]),
}));
```

Ajouter dans `beforeEach` :

```js
import { getEntreesParFacture } from "../src/db/database";
import { generatePdf, downloadPdf } from "../src/utils/generatePdf";
// ...
getEntreesParFacture.mockResolvedValue([]);
```

Ajouter 2 nouveaux tests dans `describe("Factures", ...)` :

```js
it("affiche le bouton PDF sur chaque facture dans la liste", async () => {
  getFactures.mockResolvedValue([{
    id: 1, client_id: 1, numero: "F-2026-001", client_nom: "Studio Lumière",
    date_emission: "2026-08-11", montant_total: 120, statut: "impayee",
  }]);
  render(<Factures />);
  await waitFor(() => expect(screen.getByText("📄 PDF")).toBeInTheDocument());
});

it("appelle generatePdf et downloadPdf à la création d'une facture", async () => {
  getEntreesSansFacture.mockResolvedValue([{
    id: 1, debut: "2026-08-10T09:00:00", fin: "2026-08-10T11:00:00",
    duree_minutes: 120, duree_arrondie_minutes: 120, note: null, projet_nom: null,
  }]);
  render(<Factures />);
  await userEvent.click(screen.getByText("+ Nouvelle facture"));
  await userEvent.selectOptions(screen.getByLabelText(/client/i), "1");
  await waitFor(() => expect(getEntreesSansFacture).toHaveBeenCalledWith(1));
  await userEvent.click(screen.getByText("Créer la facture"));
  await waitFor(() => expect(generatePdf).toHaveBeenCalled());
  expect(downloadPdf).toHaveBeenCalled();
});
```

- [ ] **Étape 2: Vérifier que les 2 nouveaux tests échouent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm test -- tests/Factures.test.jsx
```

Attendu: 5 tests passent, 2 échouent (bouton PDF absent, generatePdf non appelé)

- [ ] **Étape 3: Modifier `src/pages/Factures.jsx`**

Ajouter les imports en haut :

```js
import { generatePdf, downloadPdf, groupByWeek } from "../utils/generatePdf";
import { getClients, getFactures, getEntreesSansFacture, createFacture, linkEntreesToFacture, updateFactureStatut, getEntreesParFacture } from "../db/database";
```

Ajouter l'état `pdfWarning` après les états existants :

```js
const [pdfWarning, setPdfWarning] = useState(null);
```

Ajouter la computed value `willTruncate` après `montantTotal` :

```js
const willTruncate = groupByWeek(selectedEntrees).length > 8;
```

Remplacer `handleSubmit` entièrement :

```js
async function handleSubmit(e) {
  e.preventDefault();
  if (!clientId || selectedIds.size === 0 || !numero) return;
  setError(null);
  setSubmitting(true);
  try {
    const date_emission = new Date().toISOString().slice(0, 10);
    const id = await createFacture({ client_id: Number(clientId), numero, date_emission, montant_total: montantTotal });
    await linkEntreesToFacture(id, [...selectedIds]);
    const { pdfBytes, truncated, totalWeeks } = await generatePdf(
      { id, numero, date_emission },
      clientObj,
      selectedEntrees
    );
    downloadPdf(pdfBytes, `${numero}.pdf`);
    setPanelOpen(false);
    if (truncated) setPdfWarning(`Attention : seulement 8 semaines sur ${totalWeeks} ont été incluses dans le PDF.`);
    loadFactures();
  } catch (err) {
    console.error(err);
    setError("Une erreur est survenue. Veuillez réessayer.");
  } finally {
    setSubmitting(false);
  }
}
```

Ajouter `handleDownloadPdf` après `handleSubmit` :

```js
async function handleDownloadPdf(facture) {
  try {
    const client = clients.find((c) => c.id === facture.client_id);
    if (!client) throw new Error("Client introuvable");
    const entries = await getEntreesParFacture(facture.id);
    const { pdfBytes } = await generatePdf(facture, client, entries);
    downloadPdf(pdfBytes, `${facture.numero}.pdf`);
  } catch (err) {
    console.error(err);
  }
}
```

Dans le JSX, avant `{factures.length === 0 ? ...}`, ajouter le bandeau warning :

```jsx
{pdfWarning && (
  <p className="factures-page__pdf-warning">{pdfWarning}</p>
)}
```

Dans le JSX, dans chaque `<li>`, ajouter le bouton PDF dans `.factures-page__item-right` (après le bouton statut) :

```jsx
<button className="factures-page__btn-pdf" onClick={() => handleDownloadPdf(f)}>
  📄 PDF
</button>
```

Dans le panel de création, ajouter l'avertissement avant le bouton submit (après `factures-panel__no-entries`) :

```jsx
{willTruncate && (
  <p className="factures-panel__warning">
    {`${groupByWeek(selectedEntrees).length} semaines détectées — seulement les 8 premières seront dans le PDF.`}
  </p>
)}
```

- [ ] **Étape 4: Ajouter les styles CSS dans `src/pages/Factures.css`**

À la fin du fichier :

```css
.factures-page__pdf-warning {
  font-size: 13px;
  color: #e76f51;
  background: #fde8e2;
  border-radius: 8px;
  padding: 10px 14px;
}

.factures-page__btn-pdf {
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

.factures-page__btn-pdf:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.factures-panel__warning {
  font-size: 12px;
  color: #b45309;
  background: #fef3c7;
  border-radius: 8px;
  padding: 8px 12px;
}
```

- [ ] **Étape 5: Vérifier que tous les 7 tests Factures passent**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm test -- tests/Factures.test.jsx
```

Attendu: PASS (7 tests)

- [ ] **Étape 6: Vérifier la suite complète**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && npm test
```

Attendu: ~57 tests (12 fichiers)

- [ ] **Étape 7: Commit**

```bash
cd /c/Users/antho/horodateur/.worktrees/feat-facture-pdf && git add src/pages/Factures.jsx src/pages/Factures.css tests/Factures.test.jsx && git commit -m "feat(Factures): generate and download PDF invoice on creation; add re-download button"
```
