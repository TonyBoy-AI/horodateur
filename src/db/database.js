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

export async function createClient({ nom, taux_horaire, courriel, adresse, couleur, actif }) {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO clients (nom, taux_horaire, courriel, adresse, couleur, actif) VALUES (?, ?, ?, ?, ?, ?)",
    [nom, taux_horaire, courriel || null, adresse || null, couleur || "#7FD8A0", actif ? 1 : 0]
  );
  return result.lastInsertId;
}

export async function updateClient(id, { nom, taux_horaire, courriel, adresse, couleur, actif }) {
  const d = await getDb();
  await d.execute(
    "UPDATE clients SET nom=?, taux_horaire=?, courriel=?, adresse=?, couleur=?, actif=? WHERE id=?",
    [nom, taux_horaire, courriel || null, adresse || null, couleur || "#7FD8A0", actif ? 1 : 0, id]
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
    [fin, duree_minutes, duree_arrondie_minutes, note || null, id]
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
