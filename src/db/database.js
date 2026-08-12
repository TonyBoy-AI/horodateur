import Database from "@tauri-apps/plugin-sql";

let db = null;

async function getDb() {
  if (!db) db = await Database.load("sqlite:horodateur.db");
  return db;
}

export async function getClients() {
  const d = await getDb();
  return d.select("SELECT * FROM clients ORDER BY actif DESC, nom ASC");
}

export async function getProjetsByClient(clientId) {
  const d = await getDb();
  return d.select(
    "SELECT * FROM projets WHERE client_id = ? ORDER BY nom ASC",
    [clientId]
  );
}

export async function createClient({ nom, taux_horaire, courriel, adresse, telephone, personne_reference, couleur, actif }) {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO clients (nom, taux_horaire, courriel, adresse, telephone, personne_reference, couleur, actif) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [nom, taux_horaire, courriel || null, adresse || null, telephone || null, personne_reference || null, couleur || "#7FD8A0", actif ? 1 : 0]
  );
  return result.lastInsertId;
}

export async function updateClient(id, { nom, taux_horaire, courriel, adresse, telephone, personne_reference, couleur, actif }) {
  const d = await getDb();
  await d.execute(
    "UPDATE clients SET nom=?, taux_horaire=?, courriel=?, adresse=?, telephone=?, personne_reference=?, couleur=?, actif=? WHERE id=?",
    [nom, taux_horaire, courriel || null, adresse || null, telephone || null, personne_reference || null, couleur || "#7FD8A0", actif ? 1 : 0, id]
  );
}

export async function deleteClient(id) {
  const d = await getDb();
  await d.execute("DELETE FROM clients WHERE id = ?", [id]);
}

export async function createProjet({ client_id, nom, taux_horaire }) {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO projets (client_id, nom, taux_horaire) VALUES (?, ?, ?)",
    [client_id, nom, taux_horaire ?? null]
  );
  return result.lastInsertId;
}

export async function updateProjet(id, { nom, taux_horaire }) {
  const d = await getDb();
  await d.execute(
    "UPDATE projets SET nom=?, taux_horaire=? WHERE id=?",
    [nom, taux_horaire ?? null, id]
  );
}

export async function deleteProjet(id) {
  const d = await getDb();
  await d.execute("DELETE FROM projets WHERE id = ?", [id]);
}

export async function getEntreeOuverte() {
  const d = await getDb();
  const rows = await d.select(
    "SELECT * FROM entrees_temps WHERE fin IS NULL LIMIT 1"
  );
  return rows[0] ?? null;
}

export async function demarrerEntree({ client_id, projet_id, debut }) {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO entrees_temps (client_id, projet_id, debut) VALUES (?, ?, ?)",
    [client_id, projet_id ?? null, debut]
  );
  return result.lastInsertId;
}

export async function arreterEntree(id, { fin, duree_minutes, duree_arrondie_minutes, note }) {
  const d = await getDb();
  await d.execute(
    "UPDATE entrees_temps SET fin=?, duree_minutes=?, duree_arrondie_minutes=?, note=? WHERE id=?",
    [fin, duree_minutes ?? null, duree_arrondie_minutes ?? null, note || null, id]
  );
}

export async function updateEntreeNote(id, note) {
  const d = await getDb();
  await d.execute(
    "UPDATE entrees_temps SET note=? WHERE id=?",
    [note || null, id]
  );
}

export async function getParametre(cle) {
  const d = await getDb();
  const rows = await d.select(
    "SELECT valeur FROM parametres WHERE cle = ?",
    [cle]
  );
  return rows[0]?.valeur ?? null;
}

export async function setParametre(cle, valeur) {
  const d = await getDb();
  await d.execute(
    "INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur=?",
    [cle, valeur, valeur]
  );
}

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

export async function getEntreesSansFacture(client_id) {
  const d = await getDb();
  return d.select(
    `SELECT e.id, e.debut, e.fin, e.duree_minutes, e.duree_arrondie_minutes, e.note,
            p.nom AS projet_nom
     FROM entrees_temps e
     LEFT JOIN projets p ON p.id = e.projet_id
     WHERE e.client_id = ? AND e.fin IS NOT NULL AND e.facture_id IS NULL
     ORDER BY e.debut ASC`,
    [client_id]
  );
}

export async function createFacture({ client_id, numero, date_emission, montant_total }) {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO factures (client_id, numero, date_emission, montant_total) VALUES (?, ?, ?, ?)",
    [client_id, numero, date_emission, montant_total]
  );
  return result.lastInsertId;
}

export async function linkEntreesToFacture(facture_id, entree_ids) {
  const d = await getDb();
  for (const id of entree_ids) {
    await d.execute("UPDATE entrees_temps SET facture_id=? WHERE id=?", [facture_id, id]);
  }
}

export async function updateFactureStatut(id, statut) {
  const d = await getDb();
  await d.execute("UPDATE factures SET statut=? WHERE id=?", [statut, id]);
}

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

export async function updateEntree(id, { client_id, projet_id, debut, fin, duree_minutes, duree_arrondie_minutes, note }) {
  const d = await getDb();
  await d.execute(
    "UPDATE entrees_temps SET client_id=?, projet_id=?, debut=?, fin=?, duree_minutes=?, duree_arrondie_minutes=?, note=? WHERE id=?",
    [client_id, projet_id ?? null, debut, fin, duree_minutes, duree_arrondie_minutes ?? null, note || null, id]
  );
}

export async function deleteEntree(id) {
  const d = await getDb();
  const result = await d.execute(
    "DELETE FROM entrees_temps WHERE id = ? AND facture_id IS NULL",
    [id]
  );
  if (result.rowsAffected === 0) {
    const rows = await d.select("SELECT facture_id FROM entrees_temps WHERE id = ?", [id]);
    if (rows[0]?.facture_id) throw new Error("Cette entrée est liée à une facture.");
  }
}
