# Historique des factures par client — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher l'historique des factures d'un client dans un deuxième panel côte à côte avec le panel d'édition, accessible en cliquant sur une carte client.

**Architecture:** Nouvelle fonction DB `getFacturesParClient`, nouveau composant `ClientFacturesPanel`, et modifications de `Clients.jsx` / `Clients.css` pour afficher les deux panels simultanément en flex row.

**Tech Stack:** React 18, SQLite via @tauri-apps/plugin-sql, pdf-lib (réutilisé), BEM CSS, Vitest + @testing-library/react.

---

## File Structure

| Fichier | Action |
|---|---|
| `src/db/database.js` | Ajout de `getFacturesParClient(client_id)` |
| `src/components/ClientFacturesPanel.jsx` | Nouveau composant |
| `src/components/ClientFacturesPanel.css` | Nouveau fichier CSS BEM |
| `src/pages/Clients.jsx` | Ajout état `factures`, useEffect, rendu du panel |
| `src/pages/Clients.css` | Aucun changement nécessaire — le flex layout gère automatiquement |
| `tests/database.factures.test.js` | Ajout du test `getFacturesParClient` |
| `tests/ClientFacturesPanel.test.jsx` | Nouveau fichier de tests |
| `tests/Clients.test.jsx` | Nouveau fichier de tests pour l'intégration |

---

## Task 1 : Fonction DB `getFacturesParClient`

**Files:**
- Modify: `src/db/database.js` (ajouter à la fin du fichier, après `getEntreesParFacture`)
- Test: `tests/database.factures.test.js`

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `tests/database.factures.test.js`, ajouter à la fin du fichier (après les imports existants qui mockent `@tauri-apps/plugin-sql`) :

```js
import {
  getFactures,
  getEntreesSansFacture,
  createFacture,
  linkEntreesToFacture,
  updateFactureStatut,
  getFacturesParClient,   // ← ajout
} from "../src/db/database";

// ... garder tous les tests existants ...

describe("getFacturesParClient", () => {
  it("retourne les factures filtrées par client_id", async () => {
    const mockRows = [
      { id: 1, numero: "F-2026-001", date_emission: "2026-08-11", montant_total: 120, statut: "impayee" },
    ];
    mockDb.select.mockResolvedValue(mockRows);
    const rows = await getFacturesParClient(5);
    expect(rows).toEqual(mockRows);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("WHERE client_id = ?"),
      [5]
    );
  });

  it("retourne un tableau vide si pas de factures", async () => {
    mockDb.select.mockResolvedValue([]);
    const rows = await getFacturesParClient(99);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
npx vitest run tests/database.factures.test.js
```

Attendu : FAIL — `getFacturesParClient is not a function`

- [ ] **Step 3 : Implémenter `getFacturesParClient`**

Dans `src/db/database.js`, ajouter après la fonction `getEntreesParFacture` :

```js
export async function getFacturesParClient(client_id) {
  const d = await getDb();
  return d.select(
    `SELECT id, numero, date_emission, montant_total, statut
     FROM factures
     WHERE client_id = ?
     ORDER BY date_emission DESC`,
    [client_id]
  );
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npx vitest run tests/database.factures.test.js
```

Attendu : tous les tests PASS

- [ ] **Step 5 : Commit**

```bash
git add src/db/database.js tests/database.factures.test.js
git commit -m "feat(db): add getFacturesParClient"
```

---

## Task 2 : Composant `ClientFacturesPanel`

**Files:**
- Create: `src/components/ClientFacturesPanel.jsx`
- Create: `src/components/ClientFacturesPanel.css`
- Test: `tests/ClientFacturesPanel.test.jsx`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `tests/ClientFacturesPanel.test.jsx` :

```jsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getEntreesParFacture: vi.fn(),
}));

vi.mock("../src/utils/generatePdf", () => ({
  generatePdf: vi.fn().mockResolvedValue({ pdfBytes: new Uint8Array() }),
  downloadPdf: vi.fn(),
}));

import ClientFacturesPanel from "../src/components/ClientFacturesPanel";
import { getEntreesParFacture } from "../src/db/database";
import { generatePdf, downloadPdf } from "../src/utils/generatePdf";

const client = {
  id: 1, nom: "Studio Lumière", taux_horaire: 80,
  courriel: "a@b.ca", telephone: "", adresse: "", personne_reference: "",
};

const factures = [
  { id: 1, numero: "F-2026-001", date_emission: "2026-08-11", montant_total: 120, statut: "impayee" },
  { id: 2, numero: "F-2026-002", date_emission: "2026-07-15", montant_total: 80, statut: "payee" },
];

beforeEach(() => {
  vi.clearAllMocks();
  getEntreesParFacture.mockResolvedValue([]);
});

describe("ClientFacturesPanel", () => {
  it("affiche le titre Factures", () => {
    render(<ClientFacturesPanel client={client} factures={[]} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Factures");
  });

  it("affiche un message vide quand pas de factures", () => {
    render(<ClientFacturesPanel client={client} factures={[]} />);
    expect(screen.getByText("Aucune facture pour ce client.")).toBeInTheDocument();
  });

  it("affiche chaque facture avec numéro, montant et statut", () => {
    render(<ClientFacturesPanel client={client} factures={factures} />);
    expect(screen.getByText("F-2026-001")).toBeInTheDocument();
    expect(screen.getByText("120.00 $")).toBeInTheDocument();
    expect(screen.getByText("Impayée")).toBeInTheDocument();
    expect(screen.getByText("Payée")).toBeInTheDocument();
  });

  it("formate la date en JJ-M-AAAA", () => {
    render(<ClientFacturesPanel client={client} factures={[factures[0]]} />);
    expect(screen.getByText("11-8-2026")).toBeInTheDocument();
  });

  it("télécharge le PDF quand on clique sur 📄", async () => {
    render(<ClientFacturesPanel client={client} factures={[factures[0]]} />);
    await userEvent.click(screen.getByTitle("Télécharger le PDF"));
    await waitFor(() => expect(generatePdf).toHaveBeenCalledWith(
      factures[0], client, []
    ));
    expect(downloadPdf).toHaveBeenCalledWith(expect.any(Uint8Array), "F-2026-001.pdf");
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npx vitest run tests/ClientFacturesPanel.test.jsx
```

Attendu : FAIL — `Cannot find module '../src/components/ClientFacturesPanel'`

- [ ] **Step 3 : Créer `ClientFacturesPanel.jsx`**

Créer `src/components/ClientFacturesPanel.jsx` :

```jsx
import { getEntreesParFacture } from "../db/database";
import { generatePdf, downloadPdf } from "../utils/generatePdf";
import "./ClientFacturesPanel.css";

function formatDate(isoStr) {
  if (!isoStr) return "—";
  const [y, m, d] = isoStr.split("-");
  return `${parseInt(d)}-${parseInt(m)}-${y}`;
}

export default function ClientFacturesPanel({ client, factures }) {
  async function handleDownloadPdf(facture) {
    try {
      const entries = await getEntreesParFacture(facture.id);
      const { pdfBytes } = await generatePdf(facture, client, entries);
      downloadPdf(pdfBytes, `${facture.numero}.pdf`);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <aside className="client-factures-panel">
      <div className="client-factures-panel__header">
        <h2 className="client-factures-panel__title">Factures</h2>
      </div>
      <div className="client-factures-panel__body">
        {factures.length === 0 ? (
          <p className="client-factures-panel__empty">Aucune facture pour ce client.</p>
        ) : (
          <ul className="client-factures-panel__list">
            {factures.map((f) => (
              <li key={f.id} className="client-factures-panel__item">
                <div className="client-factures-panel__item-main">
                  <span className="client-factures-panel__numero">{f.numero}</span>
                  <span className="client-factures-panel__date">{formatDate(f.date_emission)}</span>
                </div>
                <div className="client-factures-panel__item-sub">
                  <span className="client-factures-panel__montant">{f.montant_total.toFixed(2)} $</span>
                  <span className={`client-factures-panel__badge client-factures-panel__badge--${f.statut}`}>
                    {f.statut === "payee" ? "Payée" : "Impayée"}
                  </span>
                  <button
                    className="client-factures-panel__btn-pdf"
                    onClick={() => handleDownloadPdf(f)}
                    title="Télécharger le PDF"
                  >
                    📄
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4 : Créer `ClientFacturesPanel.css`**

Créer `src/components/ClientFacturesPanel.css` :

```css
.client-factures-panel {
  width: 220px;
  flex-shrink: 0;
  background: white;
  border-radius: var(--radius);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: cfp-in 0.2s ease-out;
}

@keyframes cfp-in {
  from { transform: translateX(16px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

.client-factures-panel__header {
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--color-surface);
  flex-shrink: 0;
}

.client-factures-panel__title {
  font-family: var(--font-title);
  font-size: 15px;
  color: var(--color-text);
  font-weight: 600;
}

.client-factures-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.client-factures-panel__empty {
  color: var(--color-text-muted);
  font-size: 13px;
  margin-top: 16px;
  text-align: center;
}

.client-factures-panel__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.client-factures-panel__item {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.client-factures-panel__item-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.client-factures-panel__numero {
  font-weight: 700;
  font-size: 12px;
  color: var(--color-text);
}

.client-factures-panel__date {
  font-size: 11px;
  color: var(--color-text-muted);
}

.client-factures-panel__item-sub {
  display: flex;
  align-items: center;
  gap: 6px;
}

.client-factures-panel__montant {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text);
  flex: 1;
}

.client-factures-panel__badge {
  font-size: 10px;
  font-weight: 700;
  border-radius: 99px;
  padding: 2px 7px;
}

.client-factures-panel__badge--payee {
  background: #e0f5ea;
  color: #2d6a4f;
}

.client-factures-panel__badge--impayee {
  background: #f5e0e0;
  color: #9b2c2c;
}

.client-factures-panel__btn-pdf {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  border-radius: 4px;
  transition: background 0.1s;
}

.client-factures-panel__btn-pdf:hover {
  background: rgba(0, 0, 0, 0.06);
}
```

- [ ] **Step 5 : Vérifier que les tests passent**

```bash
npx vitest run tests/ClientFacturesPanel.test.jsx
```

Attendu : 5 tests PASS

- [ ] **Step 6 : Commit**

```bash
git add src/components/ClientFacturesPanel.jsx src/components/ClientFacturesPanel.css tests/ClientFacturesPanel.test.jsx
git commit -m "feat(Clients): add ClientFacturesPanel component"
```

---

## Task 3 : Intégration dans `Clients.jsx`

**Files:**
- Modify: `src/pages/Clients.jsx`
- Test: `tests/Clients.test.jsx`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `tests/Clients.test.jsx` :

```jsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getClients: vi.fn(),
  getFacturesParClient: vi.fn(),
}));

vi.mock("../src/components/ClientPanel", () => ({
  default: ({ client, onClose }) => (
    <div data-testid="client-panel">
      {client?.nom}
      <button onClick={onClose}>Fermer</button>
    </div>
  ),
}));

vi.mock("../src/components/ClientFacturesPanel", () => ({
  default: ({ factures }) => (
    <div data-testid="factures-panel">{factures.length} facture(s)</div>
  ),
}));

import Clients from "../src/pages/Clients";
import { getClients, getFacturesParClient } from "../src/db/database";

const mockClients = [
  { id: 1, nom: "Studio Lumière", taux_horaire: 80, actif: 1, couleur: "#7FD8A0" },
];

beforeEach(() => {
  vi.clearAllMocks();
  getClients.mockResolvedValue(mockClients);
  getFacturesParClient.mockResolvedValue([]);
});

describe("Clients", () => {
  it("n'affiche pas le panel d'historique au chargement", async () => {
    render(<Clients />);
    await waitFor(() => expect(screen.getByText("Studio Lumière")).toBeInTheDocument());
    expect(screen.queryByTestId("factures-panel")).not.toBeInTheDocument();
  });

  it("affiche le panel d'historique quand un client est sélectionné", async () => {
    render(<Clients />);
    await waitFor(() => expect(screen.getByText("Studio Lumière")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Studio Lumière"));
    await waitFor(() => expect(getFacturesParClient).toHaveBeenCalledWith(1));
    expect(screen.getByTestId("factures-panel")).toBeInTheDocument();
  });

  it("affiche les factures du client dans le panel", async () => {
    getFacturesParClient.mockResolvedValue([
      { id: 1, numero: "F-2026-001", montant_total: 120, statut: "impayee" },
    ]);
    render(<Clients />);
    await waitFor(() => expect(screen.getByText("Studio Lumière")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Studio Lumière"));
    await waitFor(() => expect(screen.getByText("1 facture(s)")).toBeInTheDocument());
  });

  it("cache le panel d'historique quand on ferme le panel client", async () => {
    render(<Clients />);
    await waitFor(() => expect(screen.getByText("Studio Lumière")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Studio Lumière"));
    await waitFor(() => expect(screen.getByTestId("factures-panel")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Fermer"));
    expect(screen.queryByTestId("factures-panel")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npx vitest run tests/Clients.test.jsx
```

Attendu : FAIL — `getFacturesParClient is not a function` ou panel non trouvé

- [ ] **Step 3 : Modifier `Clients.jsx`**

Remplacer le contenu complet de `src/pages/Clients.jsx` :

```jsx
import { useState, useEffect } from "react";
import { getClients, getFacturesParClient } from "../db/database";
import ClientCard from "../components/ClientCard";
import ClientPanel from "../components/ClientPanel";
import ClientFacturesPanel from "../components/ClientFacturesPanel";
import "./Clients.css";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [factures, setFactures] = useState([]);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (!selectedId) { setFactures([]); return; }
    getFacturesParClient(selectedId).then(setFactures).catch(console.error);
  }, [selectedId]);

  async function loadClients() {
    setLoadError(null);
    try {
      const list = await getClients();
      setClients(list);
    } catch (e) {
      console.error(e);
      setLoadError("Impossible de charger les clients.");
    }
  }

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;
  const panelClient = showNew ? null : selectedClient;
  const showPanel = showNew || selectedId !== null;

  function handleCardClick(id) {
    setShowNew(false);
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleClose() {
    setSelectedId(null);
    setShowNew(false);
  }

  async function handleSaved(id) {
    await loadClients();
    setShowNew(false);
    setSelectedId(id);
  }

  async function handleDeleted() {
    setSelectedId(null);
    setShowNew(false);
    await loadClients();
  }

  function handleNewClick() {
    setSelectedId(null);
    setShowNew(true);
  }

  return (
    <div className="clients-page">
      <div className="clients-page__toolbar">
        <h1 className="clients-page__title">👥 Clients</h1>
        <button className="clients-page__new-btn" onClick={handleNewClick}>
          + Nouveau client
        </button>
      </div>

      <div className="clients-page__body">
        <div className="clients-page__grid">
          {loadError && <p className="clients-page__error">{loadError}</p>}
          {!loadError && clients.length === 0 && (
            <p className="clients-page__empty">
              Aucun client pour l'instant — crée-en un ! 🌱
            </p>
          )}
          {clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              isSelected={c.id === selectedId}
              onClick={() => handleCardClick(c.id)}
            />
          ))}
        </div>

        {showPanel && (
          <ClientPanel
            client={panelClient}
            onClose={handleClose}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        )}

        {selectedId !== null && selectedClient && (
          <ClientFacturesPanel client={selectedClient} factures={factures} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npx vitest run tests/Clients.test.jsx
```

Attendu : 4 tests PASS

- [ ] **Step 5 : Lancer la suite complète**

```bash
npx vitest run
```

Attendu : tous les tests existants PASS + nouveaux tests PASS

- [ ] **Step 6 : Commit**

```bash
git add src/pages/Clients.jsx tests/Clients.test.jsx
git commit -m "feat(Clients): show invoice history panel on client click"
```
