# Paramètres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la page Paramètres permettant de configurer `nom_entreprise`, `arrondi_minutes` et `rappel_inactivite_heures` avec sauvegarde automatique dans SQLite.

**Architecture:** La table `parametres` (clé/valeur) existe déjà. On ajoute `setParametre` dans `database.js` pour l'écriture, une migration pour `nom_entreprise`, puis on remplace le stub `Parametres.jsx` par le formulaire complet avec auto-save au blur/change.

**Tech Stack:** React 18, Tauri 2 + plugin-sql (SQLite), Vitest + @testing-library/react

---

## Contexte codebase

- Worktree: `.worktrees/feat-parametres`, branche `feat/parametres`
- Migrations SQL: `src-tauri/migrations/` — nommées `NNN_nom.sql`, appliquées dans l'ordre lexicographique par le plugin SQL Tauri
- Table `parametres`: `cle TEXT PRIMARY KEY, valeur TEXT`
  - Rows existantes: `arrondi_minutes` (défaut "15"), `rappel_inactivite_heures` (défaut "4")
- `src/db/database.js`: exporte `getParametre(cle)` — renvoie `string | null`
- `src/pages/Parametres.jsx`: stub vide à remplacer
- CSS vars disponibles: `--color-bg`, `--color-sidebar`, `--color-accent` (#7FD8A0), `--color-surface`, `--color-text`, `--color-text-muted`, `--font-title` (Fredoka), `--font-body` (Quicksand), `--radius` (12px), `--shadow`
- Pattern BEM: un fichier `.css` par composant, classes `.nom-page__element--modifier`
- Pattern Chrono.css pour les inputs: `border: 1.5px solid #c8efd8`, `border-radius: 8px`, focus sur `--color-accent`
- Tests: `tests/setup.js` (`import "@testing-library/jest-dom"`), `vitest run`
- Mock DB dans les tests: `vi.mock("../src/db/database", () => ({ ... }))`

---

### Task 1: DB — migration `nom_entreprise` + fonction `setParametre`

**Files:**
- Create: `src-tauri/migrations/002_nom_entreprise.sql`
- Modify: `src/db/database.js` (ajouter `setParametre` à la fin)
- Test: `tests/database.parametres.test.js`

- [ ] **Étape 1: Écrire le test qui échoue**

Créer `tests/database.parametres.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock complet du plugin SQL Tauri — le module réel n'existe pas dans jsdom
vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = {
    select: vi.fn(),
    execute: vi.fn(),
  };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import { getParametre, setParametre } from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("getParametre", () => {
  it("renvoie la valeur quand la clé existe", async () => {
    mockDb.select.mockResolvedValue([{ valeur: "15" }]);
    const val = await getParametre("arrondi_minutes");
    expect(val).toBe("15");
    expect(mockDb.select).toHaveBeenCalledWith(
      "SELECT valeur FROM parametres WHERE cle = ?",
      ["arrondi_minutes"]
    );
  });

  it("renvoie null quand la clé est absente", async () => {
    mockDb.select.mockResolvedValue([]);
    const val = await getParametre("inexistante");
    expect(val).toBeNull();
  });
});

describe("setParametre", () => {
  it("exécute un UPSERT avec la clé et la valeur", async () => {
    mockDb.execute.mockResolvedValue({});
    await setParametre("arrondi_minutes", "30");
    expect(mockDb.execute).toHaveBeenCalledWith(
      "INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur=?",
      ["arrondi_minutes", "30", "30"]
    );
  });

  it("accepte une valeur vide (string vide)", async () => {
    mockDb.execute.mockResolvedValue({});
    await setParametre("nom_entreprise", "");
    expect(mockDb.execute).toHaveBeenCalledWith(
      "INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur=?",
      ["nom_entreprise", "", ""]
    );
  });
});
```

- [ ] **Étape 2: Vérifier que les tests échouent**

```bash
npm test -- tests/database.parametres.test.js
```

Résultat attendu: FAIL — `setParametre is not a function`

- [ ] **Étape 3: Créer la migration SQL**

Créer `src-tauri/migrations/002_nom_entreprise.sql`:

```sql
INSERT OR IGNORE INTO parametres (cle, valeur) VALUES ('nom_entreprise', '');
```

- [ ] **Étape 4: Ajouter `setParametre` à `database.js`**

Ajouter à la fin de `src/db/database.js`:

```js
export async function setParametre(cle, valeur) {
  const d = await getDb();
  await d.execute(
    "INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur=?",
    [cle, valeur, valeur]
  );
}
```

- [ ] **Étape 5: Vérifier que les tests passent**

```bash
npm test -- tests/database.parametres.test.js
```

Résultat attendu: PASS (4 tests)

- [ ] **Étape 6: Commit**

```bash
git add src-tauri/migrations/002_nom_entreprise.sql src/db/database.js tests/database.parametres.test.js
git commit -m "feat(db): add setParametre + migration for nom_entreprise"
```

---

### Task 2: UI — Parametres.jsx + Parametres.css + tests

**Files:**
- Modify: `src/pages/Parametres.jsx` (remplacer le stub)
- Create: `src/pages/Parametres.css`
- Create: `tests/Parametres.test.jsx`

- [ ] **Étape 1: Écrire les tests qui échouent**

Créer `tests/Parametres.test.jsx`:

```jsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getParametre: vi.fn(),
  setParametre: vi.fn(),
}));

import Parametres from "../src/pages/Parametres";
import { getParametre, setParametre } from "../src/db/database";

beforeEach(() => {
  vi.clearAllMocks();
  getParametre.mockImplementation((cle) => {
    const vals = {
      nom_entreprise: "ACME",
      arrondi_minutes: "15",
      rappel_inactivite_heures: "4",
    };
    return Promise.resolve(vals[cle] ?? null);
  });
  setParametre.mockResolvedValue(undefined);
});

describe("Parametres", () => {
  it("affiche les 3 champs avec les valeurs chargées depuis la DB", async () => {
    render(<Parametres />);
    await waitFor(() => expect(screen.getByDisplayValue("ACME")).toBeInTheDocument());
    expect(screen.getByDisplayValue("15")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
  });

  it("sauvegarde arrondi_minutes quand le select change", async () => {
    render(<Parametres />);
    await waitFor(() => screen.getByDisplayValue("15"));
    await userEvent.selectOptions(screen.getByLabelText(/arrondi/i), "30");
    expect(setParametre).toHaveBeenCalledWith("arrondi_minutes", "30");
  });

  it("sauvegarde rappel_inactivite_heures quand le select change", async () => {
    render(<Parametres />);
    await waitFor(() => screen.getByDisplayValue("4"));
    await userEvent.selectOptions(screen.getByLabelText(/rappel/i), "2");
    expect(setParametre).toHaveBeenCalledWith("rappel_inactivite_heures", "2");
  });

  it("sauvegarde nom_entreprise au blur du champ texte", async () => {
    render(<Parametres />);
    await waitFor(() => screen.getByDisplayValue("ACME"));
    const input = screen.getByDisplayValue("ACME");
    await userEvent.clear(input);
    await userEvent.type(input, "Nouvelle Entreprise");
    fireEvent.blur(input);
    expect(setParametre).toHaveBeenCalledWith("nom_entreprise", "Nouvelle Entreprise");
  });

  it("affiche le titre de la page", async () => {
    render(<Parametres />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
```

- [ ] **Étape 2: Vérifier que les tests échouent**

```bash
npm test -- tests/Parametres.test.jsx
```

Résultat attendu: FAIL — les éléments ne sont pas trouvés (stub vide)

- [ ] **Étape 3: Remplacer le stub `Parametres.jsx`**

Écrire `src/pages/Parametres.jsx`:

```jsx
import { useState, useEffect } from "react";
import { getParametre, setParametre } from "../db/database";
import "./Parametres.css";

export default function Parametres() {
  const [nomEntreprise, setNomEntreprise] = useState("");
  const [arrondi, setArrondi] = useState("15");
  const [rappel, setRappel] = useState("4");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      getParametre("nom_entreprise"),
      getParametre("arrondi_minutes"),
      getParametre("rappel_inactivite_heures"),
    ])
      .then(([nom, arr, rap]) => {
        setNomEntreprise(nom ?? "");
        setArrondi(arr ?? "15");
        setRappel(rap ?? "4");
      })
      .catch(console.error);
  }, []);

  async function save(cle, valeur) {
    await setParametre(cle, valeur).catch(console.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="parametres-page">
      <h1 className="parametres-page__title">⚙️ Paramètres</h1>

      {saved && (
        <p className="parametres-page__saved" role="status">
          ✓ Sauvegardé
        </p>
      )}

      <section className="parametres-page__section">
        <h2 className="parametres-page__section-title">Entreprise</h2>
        <div className="parametres-page__field">
          <label htmlFor="p-nom">Nom de l'entreprise</label>
          <input
            id="p-nom"
            type="text"
            value={nomEntreprise}
            onChange={(e) => setNomEntreprise(e.target.value)}
            onBlur={() => save("nom_entreprise", nomEntreprise)}
            placeholder="Ex: Studio Créatif"
          />
        </div>
      </section>

      <section className="parametres-page__section">
        <h2 className="parametres-page__section-title">Chronomètre</h2>

        <div className="parametres-page__field">
          <label htmlFor="p-arrondi">Arrondi des durées</label>
          <select
            id="p-arrondi"
            value={arrondi}
            onChange={(e) => {
              setArrondi(e.target.value);
              save("arrondi_minutes", e.target.value);
            }}
          >
            <option value="1">1 minute (aucun arrondi)</option>
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 heure</option>
          </select>
        </div>

        <div className="parametres-page__field">
          <label htmlFor="p-rappel">Rappel d'inactivité</label>
          <select
            id="p-rappel"
            value={rappel}
            onChange={(e) => {
              setRappel(e.target.value);
              save("rappel_inactivite_heures", e.target.value);
            }}
          >
            <option value="0">Désactivé</option>
            <option value="1">1 heure</option>
            <option value="2">2 heures</option>
            <option value="4">4 heures</option>
            <option value="8">8 heures</option>
          </select>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Étape 4: Créer `Parametres.css`**

Créer `src/pages/Parametres.css`:

```css
.parametres-page {
  max-width: 480px;
  margin: 0 auto;
  padding-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.parametres-page__title {
  font-family: var(--font-title);
  font-size: 22px;
  color: var(--color-text);
  font-weight: 700;
}

.parametres-page__saved {
  font-size: 13px;
  color: var(--color-text-muted);
  font-weight: 600;
}

.parametres-page__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: white;
  border-radius: var(--radius);
  padding: 16px 20px;
  box-shadow: var(--shadow);
}

.parametres-page__section-title {
  font-family: var(--font-title);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.parametres-page__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.parametres-page__field label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.parametres-page__field input,
.parametres-page__field select {
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

.parametres-page__field input:focus,
.parametres-page__field select:focus {
  border-color: var(--color-accent);
}
```

- [ ] **Étape 5: Vérifier que tous les tests passent**

```bash
npm test
```

Résultat attendu: PASS — 15 tests (6 ClientCard + 4 database.parametres + 5 Parametres)

Attendre: `Test Files  3 passed (3)` et `Tests  15 passed (15)`

- [ ] **Étape 6: Commit**

```bash
git add src/pages/Parametres.jsx src/pages/Parametres.css tests/Parametres.test.jsx
git commit -m "feat(Parametres): add settings page with auto-save for nom_entreprise, arrondi, rappel"
```
