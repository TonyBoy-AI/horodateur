# Historique des factures par client — Design

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan.

**Goal:** Afficher l'historique des factures d'un client dans un deuxième panel côte à côte avec le panel d'édition, accessible en cliquant sur une carte client.

**Architecture:** Nouveau composant `ClientFacturesPanel` rendu à droite du `ClientPanel` existant. La page `Clients` charge les factures via une nouvelle fonction DB filtrée par client. Le layout à 3 colonnes est géré dans `Clients.css`.

**Tech Stack:** React 18, SQLite via @tauri-apps/plugin-sql, pdf-lib (réutilisé), BEM CSS.

---

## Données

Nouvelle fonction `getFacturesParClient(client_id)` dans `database.js` — même requête que `getFactures()` filtrée par `client_id`. Retourne : `id, numero, date_emission, montant_total, statut`.

## Layout

`clients-page__body` passe en flex row :
- `clients-page__grid` — se rétrécit quand un client est sélectionné (`clients-page__grid--collapsed`)
- `ClientPanel` — panel d'édition existant, inchangé
- `ClientFacturesPanel` — nouveau panel historique, affiché seulement quand `selectedId !== null`

## ClientFacturesPanel

**Props :** `client` (objet client), `factures` (tableau), `onDownloadPdf(facture)`.

**Contenu :**
- Titre : "Factures — {client.nom}"
- Liste des factures : N° facture, date (format JJ-MM-AAAA), montant (X.XX $), badge statut (Payée / Impayée), bouton 📄 PDF
- État vide : "Aucune facture pour ce client."
- Pas d'état de chargement explicite (les factures arrivent avec `selectedId`)

**PDF :** Le bouton 📄 appelle `onDownloadPdf(facture)` — logique identique à `handleDownloadPdf` dans `Factures.jsx` (getEntreesParFacture → generatePdf → downloadPdf).

## Fichiers

| Fichier | Action |
|---|---|
| `src/db/database.js` | Ajout de `getFacturesParClient(client_id)` |
| `src/pages/Clients.jsx` | État `factures`, chargement on select, rendu `ClientFacturesPanel` |
| `src/pages/Clients.css` | Layout flex 3 colonnes, classe `--collapsed` pour la grille |
| `src/components/ClientFacturesPanel.jsx` | Nouveau composant |
| `src/components/ClientFacturesPanel.css` | Styles BEM du nouveau composant |

## Comportement

- Cliquer une carte client → les deux panels s'ouvrent simultanément
- Cliquer une carte déjà sélectionnée → tout se ferme (comportement existant conservé)
- Changer de client sélectionné → les deux panels se mettent à jour
- Bouton PDF dans l'historique → télécharge le PDF de cette facture (sans changer de page)
