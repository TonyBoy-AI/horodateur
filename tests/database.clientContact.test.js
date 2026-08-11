import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = { select: vi.fn(), execute: vi.fn() };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import { createClient, updateClient, getEntreesParFacture, getFactures } from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("createClient avec nouveaux champs", () => {
  it("persiste telephone et personne_reference", async () => {
    mockDb.execute.mockResolvedValue({ lastInsertId: 1 });
    await createClient({
      nom: "Studio Test", taux_horaire: 80, courriel: "test@test.com",
      adresse: "123 rue Test", telephone: "581-000-0000",
      personne_reference: "Jean Dupont", couleur: "#7FD8A0", actif: true,
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      "INSERT INTO clients (nom, taux_horaire, courriel, adresse, telephone, personne_reference, couleur, actif) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["Studio Test", 80, "test@test.com", "123 rue Test", "581-000-0000", "Jean Dupont", "#7FD8A0", 1]
    );
  });
});

describe("updateClient avec nouveaux champs", () => {
  it("met à jour telephone et personne_reference", async () => {
    mockDb.execute.mockResolvedValue({});
    await updateClient(1, {
      nom: "Studio Test", taux_horaire: 80, courriel: "test@test.com",
      adresse: "123 rue Test", telephone: "581-111-1111",
      personne_reference: "Marie Tremblay", couleur: "#7FD8A0", actif: true,
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      "UPDATE clients SET nom=?, taux_horaire=?, courriel=?, adresse=?, telephone=?, personne_reference=?, couleur=?, actif=? WHERE id=?",
      ["Studio Test", 80, "test@test.com", "123 rue Test", "581-111-1111", "Marie Tremblay", "#7FD8A0", 1, 1]
    );
  });
});

describe("getEntreesParFacture", () => {
  it("sélectionne les entrées avec le bon facture_id", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesParFacture(3);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("facture_id = ?"),
      [3]
    );
  });
});

describe("getFactures inclut client_id", () => {
  it("sélectionne f.client_id", async () => {
    mockDb.select.mockResolvedValue([]);
    await getFactures();
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("f.client_id")
    );
  });
});
