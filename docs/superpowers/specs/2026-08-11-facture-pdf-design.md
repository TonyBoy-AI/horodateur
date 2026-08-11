# Facture PDF — Design Spec

**Date :** 2026-08-11  
**Fonctionnalité :** Génération et téléchargement d'un PDF de facture à partir du template de Noémy Bizier

---

## Objectif

Lors de la création d'une facture dans la page Factures, remplir automatiquement le template PDF de la comptable (overlay avec `pdf-lib`) et déclencher le téléchargement du PDF rempli. Un bouton "Re-télécharger PDF" sur chaque facture existante permet de regénérer le document.

---

## Contexte codebase

- `src/db/database.js` — fonctions async SQLite
- `src/components/ClientPanel.jsx` — formulaire d'édition client (déjà: nom, taux_horaire, courriel, adresse, couleur, actif)
- `src-tauri/migrations/` — migrations SQLite au démarrage
- `src/pages/Factures.jsx` — page factures (liste + panel création)
- Table `clients` : `id, nom, taux_horaire, courriel, adresse, couleur, actif, cree_le`
- Table `entrees_temps` : `id, client_id, projet_id, debut, fin, duree_minutes, duree_arrondie_minutes, note, facture_id`

---

## Fichiers touchés

| Action | Fichier | Responsabilité |
|--------|---------|----------------|
| CREATE | `src-tauri/migrations/003_client_contact.sql` | Ajouter `telephone` et `personne_reference` à clients |
| MODIFY | `src/db/database.js` | Inclure les 2 nouveaux champs dans createClient / updateClient |
| MODIFY | `src/components/ClientPanel.jsx` | Champs Téléphone + Personne référence dans le formulaire |
| COPY | `public/template-facture.pdf` | Template PDF source (Noémy Bizier) |
| CREATE | `src/utils/generatePdf.js` | Logique pdf-lib : charger template, grouper par semaine, overlay texte, retourner bytes |
| MODIFY | `src/pages/Factures.jsx` | Appel generatePdf après createFacture, download, bouton re-télécharger, warning >8 semaines |

---

## Section 1 : BD — Nouveaux champs client

### Migration `003_client_contact.sql`

```sql
ALTER TABLE clients ADD COLUMN telephone TEXT;
ALTER TABLE clients ADD COLUMN personne_reference TEXT;
```

### DB functions

`createClient` et `updateClient` dans `database.js` reçoivent et persistents `telephone` et `personne_reference` en plus des champs existants. Les signatures deviennent :

```js
createClient({ nom, taux_horaire, courriel, adresse, telephone, personne_reference, couleur, actif })
updateClient(id, { nom, taux_horaire, courriel, adresse, telephone, personne_reference, couleur, actif })
```

`getClients()` retourne déjà `SELECT *` donc les nouveaux champs sont automatiquement inclus.

---

## Section 2 : UI Client — Nouveaux champs

Dans `ClientPanel.jsx`, ajouter 2 champs après le champ Courriel, avant Adresse :

- **Téléphone** : `<input type="tel">`, id `cp-telephone`, placeholder `"581-000-0000"`
- **Personne de référence (payeur)** : `<input type="text">`, id `cp-reference`, placeholder `"Prénom Nom"`

`EMPTY_FORM` et le `useEffect` qui peuple le formulaire depuis `client` sont mis à jour avec `telephone: ""` et `personne_reference: ""`.

---

## Section 3 : Template PDF

Le fichier `Comptabilité - Noémy Bizier - Template  - Facture.pdf` est copié dans `public/template-facture.pdf`. Il est chargé dans le navigateur Tauri via `fetch('/template-facture.pdf')` → `ArrayBuffer` → `PDFDocument.load(arrayBuffer)`.

### Champs à remplir (overlay texte)

| Zone template | Source | Notes |
|---|---|---|
| N° FACTURE | `facture.numero` | |
| DATE | `facture.date_emission` | Format `JJ-M-AAAA` |
| Nom de l'entreprise | `client.nom` | |
| Adresse courriel | `client.courriel` | |
| Numéro de téléphone | `client.telephone` | |
| Adresse complète | `client.adresse` | |
| Personne référence (RÉF CLIENT) | `client.personne_reference` | |
| Lignes 1–8 | semaines groupées | max 8 |
| SOUS-TOTAL | somme des montants | |
| TOTAL | même valeur (pas de taxes) | |

### Coordonnées PDF

Les coordonnées exactes (x, y en points, origine bas-gauche) sont déterminées programmatiquement lors de l'implémentation via une phase d'inspection/calibrage du PDF avec `pdf-lib`. Elles seront des constantes dans `generatePdf.js`.

---

## Section 4 : Génération PDF (`src/utils/generatePdf.js`)

### Signature

```js
export async function generatePdf(facture, client, entrees)
// Returns: { pdfBytes: Uint8Array, truncated: boolean, weeksCount: number }
```

### Groupement par semaine

- Les entrées sont groupées par semaine ISO (lundi → dimanche)
- Tri chronologique
- Chaque groupe → 1 ligne du tableau PDF :
  - **Description** : `"semaine du DD MMM au DD MMM"` (ex: `"semaine du 04 août au 10 août"`)
  - **Notes** : toutes les notes non-nulles du groupe, jointes par `" / "`
  - **QTÉ (H)** : somme `duree_arrondie_minutes` / 60, arrondie à 2 décimales
  - **Prix unitaire** : `client.taux_horaire`
  - **Montant** : heures × taux, arrondi à 2 décimales

### Limite 8 semaines

- Si le nombre de semaines > 8 : inclure seulement les 8 premières, `truncated: true`
- Lignes vides (semaines 9+) laissées vides dans le PDF

### Téléchargement

```js
const blob = new Blob([pdfBytes], { type: 'application/pdf' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `${facture.numero}.pdf`;
a.click();
URL.revokeObjectURL(url);
```

---

## Section 5 : Intégration dans Factures.jsx

### À la création (handleSubmit)

Après `createFacture` + `linkEntreesToFacture` :

1. Charger le client complet depuis `clients` (pour avoir tous les champs)
2. Charger les entrées liées à la facture (déjà dans `selectedEntrees`)
3. Appeler `generatePdf(facture, client, selectedEntrees)`
4. Déclencher le téléchargement
5. Si `truncated`, afficher un bandeau dans le panel : `"Attention : seulement 8 semaines sur X ont été incluses dans le PDF."`

### Bouton re-télécharger

Chaque ligne de facture dans la liste gagne un bouton **"📄 PDF"** (discret, après "Marquer payée/impayée"). Au clic :

1. Appeler `getEntreesParFacture(facture.id)` — nouvelle fonction DB
2. Charger le client
3. Appeler `generatePdf` + télécharger

### Nouvelle fonction DB

```js
export async function getEntreesParFacture(facture_id)
// SELECT * FROM entrees_temps WHERE facture_id = ? AND fin IS NOT NULL
```

---

## Section 6 : Gestion d'erreurs

- Si `fetch('/template-facture.pdf')` échoue → `throw new Error("Template PDF introuvable")`
- `generatePdf` propage l'erreur → `handleSubmit` l'affiche dans `error` state existant
- Le bouton re-télécharger affiche `console.error` + alert simple si échec

---

## Tests

- `tests/database.clientContact.test.js` — `createClient` et `updateClient` avec les 2 nouveaux champs
- `tests/generatePdf.test.js` — logique de groupement par semaine (sans charger le vrai PDF)
  - Groupement correct de N entrées en semaines ISO
  - Truncation à 8 semaines
  - Formatage des labels, heures, montants
- `tests/ClientPanel.test.jsx` — champs téléphone et personne_reference rendus et éditables
- `tests/Factures.test.jsx` — ajout test pour le bouton "📄 PDF" et le warning de truncation

---

## Dépendances à installer

```bash
npm install pdf-lib
```

Pas de dépendance Tauri supplémentaire — le téléchargement utilise une Blob URL native.
