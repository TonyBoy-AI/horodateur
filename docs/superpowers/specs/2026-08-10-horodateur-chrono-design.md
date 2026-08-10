# Chrono — Design Spec

## Goal

Page d'accueil de l'app : démarrer/arrêter un chronomètre lié à un client, avec persistence complète (navigation entre pages + redémarrage de l'app).

## Architecture

### ChronoContext

Un context React placé dans `AppLayout` (fichier `src/ChronoContext.jsx`) expose :

```js
{
  entree: { id, debut, clientId, projetId, note } | null,
  demarrer(clientId, projetId),
  arreter(),
  setNote(texte),
}
```

- `entree === null` → chrono arrêté
- `entree.debut` est un timestamp ISO 8601 string stocké en DB

### Persistence au démarrage

`AppLayout` appelle `getEntreeOuverte()` au mount. Si une entrée avec `fin IS NULL` existe, le contexte est restauré depuis ses données DB. Le timer repart en calculant l'écoulé depuis `debut`.

### Fonctions DB (ajouts à `database.js`)

| Fonction | SQL |
|---|---|
| `getEntreeOuverte()` | `SELECT * FROM entrees_temps WHERE fin IS NULL LIMIT 1` |
| `demarrerEntree({ client_id, projet_id })` | INSERT, retourne `lastInsertId` |
| `arreterEntree(id, { fin, duree_minutes, duree_arrondie_minutes, note })` | UPDATE SET fin, durees, note |
| `updateEntreeNote(id, note)` | UPDATE SET note seule |
| `getParametre(cle)` | `SELECT valeur FROM parametres WHERE cle = ?` |

### Calcul de l'arrondi (à l'arrêt)

```js
const arrondi = Number(await getParametre("arrondi_minutes")) || 15;
const duree = Math.round((fin - debut) / 60000);          // minutes exactes
const arrondie = Math.ceil(duree / arrondi) * arrondi;    // arrondi au plafond
```

## UI — Page Chrono (`src/pages/Chrono.jsx`)

Mise en page centrée verticalement, colonne unique :

1. **Titre** : `⏱️ Chronomètre`
2. **Dropdown Client** : liste des clients actifs (disabled quand chrono tourne)
3. **Dropdown Projet** : liste des projets du client sélectionné, option vide en tête (disabled quand chrono tourne)
4. **Affichage timer** : `HH:MM:SS` en grande police (`font-title`), mis à jour chaque seconde via `setInterval` — calcule l'écoulé depuis `entree.debut`
5. **Textarea Note** : toujours éditable ; `onBlur` → `updateEntreeNote(entree.id, note)` si chrono en cours
6. **Bouton principal** :
   - Arrêté → `▶ Démarrer` (vert, désactivé si aucun client sélectionné)
   - En cours → `⏹ Arrêter` (rouge)

### Comportement Démarrer

1. Appelle `demarrerEntree({ client_id, projet_id })` → reçoit `id`
2. Met à jour le contexte : `entree = { id, debut: new Date().toISOString(), clientId, projetId, note: "" }`
3. Le timer démarre

### Comportement Arrêter

1. Lit `arrondi_minutes` via `getParametre`
2. Calcule `duree_minutes` et `duree_arrondie_minutes`
3. Appelle `arreterEntree(id, { fin, duree_minutes, duree_arrondie_minutes, note })`
4. Réinitialise le contexte : `entree = null`
5. Remet les dropdowns à leur état initial

## Sidebar — Indicateur en cours

Dans `Sidebar.jsx`, si `entree !== null` (lu depuis `ChronoContext`), afficher un point vert animé (`●`) à côté du lien Chrono.

CSS : animation `pulse` (opacity 1 → 0.3 → 1, 1.5s infinite).

## Fichiers à créer / modifier

| Fichier | Action |
|---|---|
| `src/ChronoContext.jsx` | Créer — context + provider |
| `src/AppLayout.jsx` | Modifier — wrapper `<ChronoProvider>`, restauration au mount |
| `src/db/database.js` | Modifier — 5 nouvelles fonctions |
| `src/pages/Chrono.jsx` | Remplacer le stub — page complète |
| `src/pages/Chrono.css` | Créer |
| `src/Sidebar.jsx` | Modifier — lire contexte + indicateur pulsing |
| `src/Sidebar.css` | Modifier — ajouter `.sidebar__pulse` |

## Tests

Aucun test unitaire automatisé — les composants dépendent du contexte Tauri SQL. Vérification manuelle :

1. Sélectionner un client → bouton Démarrer s'active
2. Cliquer Démarrer → timer tourne, dropdowns grisés, point vert dans sidebar
3. Naviguer vers Clients → revenir à Chrono → timer toujours en cours, même valeur
4. Fermer l'app → rouvrir → timer reprend depuis le bon début
5. Écrire une note → naviguer → revenir → note toujours là
6. Arrêter → vérifier en DB que l'entrée a `fin`, `duree_minutes`, `duree_arrondie_minutes` correctes
7. Sélectionner un projet optionnel → Démarrer → Arrêter → vérifier `projet_id` en DB
8. Démarrer sans projet → vérifier `projet_id = NULL` en DB
