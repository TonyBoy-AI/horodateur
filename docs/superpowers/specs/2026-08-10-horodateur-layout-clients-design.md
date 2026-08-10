# Horodateur — Layout général + Admin Clients

**Date :** 2026-08-10
**Scope :** Structure des routes React, layout avec sidebar, écran Admin Clients (CRUD complet)

---

## 1. Stack & contraintes

- React 18 + Vite, react-router-dom v6
- Tauri 2 + tauri-plugin-sql (SQLite) — requêtes SQL directement depuis le frontend via `Database`
- Polices : Fredoka (titres), Quicksand (texte) — déjà chargées dans `index.html`
- Palette : `#1b4332` (sidebar fond), `#2d6a4f` (hover/actif), `#7FD8A0` (accent vert vif), `#E8F8EE` (fond contenu), `#d8f3dc` (surfaces secondaires)
- Fenêtre desktop : 1100×720 px (min 800×560)
- Pas de TypeScript, pas de lib CSS externe — un fichier `.css` par composant/page importé directement, nommage BEM simple

---

## 2. Routes

```
/                  → redirect vers /chrono
/chrono            → Chronomètre (dashboard)
/saisie            → Saisie manuelle d'une entrée
/clients           → Admin Clients (scope de cette session)
/rapports          → Rapports hebdo/mensuel
/factures          → Facturation & export PDF
/parametres        → Paramètres app (arrondi, rappel)
```

---

## 3. Layout général

### AppLayout
Wrapper commun rendu autour de toutes les routes via `<Outlet />` de react-router.

```
┌──────────────────────────────────────────────────┐
│  Sidebar (120px fixe)  │  Contenu (<Outlet />)   │
│  bg #1b4332            │  bg #E8F8EE              │
│                        │  flex:1, overflow auto   │
└──────────────────────────────────────────────────┘
```

### Sidebar
- Logo : "🌿 Horodateur" en Fredoka 16px, couleur `#7FD8A0`
- Liens (icône emoji + label) dans l'ordre : Chrono, Saisie, Clients, Rapports, Factures
- Paramètres en bas (poussé par `margin-top: auto`)
- `<NavLink>` de react-router : classe `.active` → `background: #2d6a4f`, border-radius 0 8px 8px 0, `margin-right: 6px`
- Pas de tooltip (labels visibles)

### Fichiers
```
src/
  main.jsx                  — BrowserRouter + routes
  AppLayout.jsx             — sidebar + <Outlet />
  Sidebar.jsx               — nav links
  index.css                 — reset + variables CSS globales
```

---

## 4. Couche données (`src/db/database.js`)

Singleton qui ouvre la connexion SQLite une seule fois et exporte des helpers :

```js
// ouverture
const db = await Database.load('sqlite:horodateur.db')

// helpers exportés
getClients()          // SELECT actifs + inactifs
getProjetsByClient(clientId)
createClient(data)
updateClient(id, data)
deleteClient(id)      // CASCADE supprime projets + entrées
createProjet(data)
updateProjet(id, data)
deleteProjet(id)
getParametre(cle)
setParametre(cle, valeur)
```

Toutes les fonctions sont `async`, retournent les résultats directs de `db.select()` / `db.execute()`.

---

## 5. Admin Clients (`/clients`)

### Vue d'ensemble

```
┌─────────────────────────────────────────────────┐
│ 👥 Mes clients            [+ Nouveau client]     │
├────────────────────────┬────────────────────────┤
│  Grille 2 colonnes     │  Panneau latéral        │
│  de cartes clients     │  (glisse depuis droite) │
│                        │  200px                  │
└────────────────────────┴────────────────────────┘
```

### ClientCard
- Fond blanc, border-radius 12px, ombre douce
- Avatar coloré (fond = couleur du client, emoji générique 🏢 ou initiale)
- Nom du client (Fredoka), taux horaire, badge Actif/Inactif
- Client inactif : opacité 0.55
- Clic sur la carte → sélectionne et ouvre le panneau

### ClientPanel (panneau latéral)
Ouvert quand un client est sélectionné ou qu'on clique "+ Nouveau". Glisse depuis la droite avec une transition CSS (`transform: translateX`).

**Section formulaire client :**
| Champ | Type | Requis |
|---|---|---|
| Nom | text | oui |
| Taux horaire ($/h) | number | oui |
| Courriel | email | non |
| Adresse | textarea (2 lignes) | non |
| Couleur | palette 10 swatches pastels | non (défaut #7FD8A0) |
| Actif | toggle switch | oui |

**Palette de couleurs prédéfinie (10 swatches) :**
`#7FD8A0`, `#a8dadc`, `#f4a261`, `#e76f51`, `#ffd166`, `#06d6a0`, `#118ab2`, `#c77dff`, `#f72585`, `#b5838d`

**Section projets du client (en dessous du formulaire) :**
- Titre "📁 Projets"
- Liste de projets : nom + taux optionnel (badge "hérite du client" si NULL)
- Chaque projet : bouton ✏️ (édition inline dans la liste) + 🗑️
- Bouton "+ Ajouter un projet" → ajoute une ligne de saisie inline
- Taux du projet : champ numérique optionnel, placeholder "Taux du client"

**Footer du panneau :**
- Bouton `💾 Sauvegarder` (pleine largeur, vert `#7FD8A0`)
- Si nouveau client : pas de bouton supprimer
- Si client existant : lien "🗑️ Supprimer ce client" (texte rouge discret, en bas)

### Suppression client
`window.confirm("Supprimer [nom] ? Toutes ses entrées de temps seront perdues.")` → si oui, `deleteClient(id)` (CASCADE SQL), ferme le panneau, retire la carte.

### État local (Clients.jsx)
```js
const [clients, setClients] = useState([])
const [selectedId, setSelectedId] = useState(null)   // null = panneau fermé
const [isNew, setIsNew] = useState(false)
```

### Flux "Nouveau client"
1. Clic "+ Nouveau" → `setIsNew(true)`, `setSelectedId(null)`, ouvre panneau avec formulaire vide
2. Sauvegarder → `createClient()` → recharge liste → sélectionne le nouveau client

### Flux "Modifier client"
1. Clic carte → `setSelectedId(id)`, panneau s'ouvre avec données pré-remplies
2. Sauvegarder → `updateClient()` → recharge liste

---

## 6. Comportements non-visuels

- **Pas de validation complexe** : seuls Nom et Taux horaire sont requis (attribut HTML `required`)
- **Pas de recherche/filtre** sur la liste clients pour l'instant
- **Tri** : clients actifs en premier, puis inactifs, puis par nom alphabétique
- **Rechargement** : après chaque mutation (create/update/delete), on recharge la liste complète depuis SQLite

---

## 7. Fichiers à créer

```
src/
  main.jsx
  AppLayout.jsx
  Sidebar.jsx
  index.css
  db/
    database.js
  pages/
    Clients.jsx
    Chrono.jsx          (stub vide pour cette session)
    Saisie.jsx          (stub vide)
    Rapports.jsx        (stub vide)
    Factures.jsx        (stub vide)
    Parametres.jsx      (stub vide)
  components/
    ClientCard.jsx
    ClientPanel.jsx
    ProjetsList.jsx
```

---

## 8. Hors-scope de cette session

- Logique du chronomètre (start/stop, timer en direct)
- Saisie manuelle, arrondi, détection de chevauchement
- Rapports, facturation, export PDF/CSV
- Rappel d'inactivité
- Paramètres configurables
