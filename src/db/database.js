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
