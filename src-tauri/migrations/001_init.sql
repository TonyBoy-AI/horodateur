CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    taux_horaire REAL NOT NULL DEFAULT 0,
    courriel TEXT,
    adresse TEXT,
    couleur TEXT DEFAULT '#7FD8A0',
    actif INTEGER NOT NULL DEFAULT 1,
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    taux_horaire REAL, -- si NULL, on utilise le taux du client
    actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS entrees_temps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    projet_id INTEGER REFERENCES projets(id) ON DELETE SET NULL,
    debut TEXT NOT NULL,          -- ISO 8601
    fin TEXT,                     -- NULL si chrono en cours
    duree_minutes INTEGER,        -- calculée à l'arrêt, avant arrondi
    duree_arrondie_minutes INTEGER,
    note TEXT,
    facture_id INTEGER REFERENCES factures(id) ON DELETE SET NULL,
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS factures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    date_emission TEXT NOT NULL DEFAULT (datetime('now')),
    montant_total REAL NOT NULL DEFAULT 0,
    statut TEXT NOT NULL DEFAULT 'impayee' -- impayee | payee
);

CREATE TABLE IF NOT EXISTS parametres (
    cle TEXT PRIMARY KEY,
    valeur TEXT
);

INSERT OR IGNORE INTO parametres (cle, valeur) VALUES ('arrondi_minutes', '15');
INSERT OR IGNORE INTO parametres (cle, valeur) VALUES ('rappel_inactivite_heures', '4');
