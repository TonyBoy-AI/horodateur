import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = { select: vi.fn(), execute: vi.fn() };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import {
  getFactures,
  getEntreesSansFacture,
  createFacture,
  linkEntreesToFacture,
  updateFactureStatut,
  getFacturesParClient,
} from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("getFactures", () => {
  it("retourne les factures avec le nom du client", async () => {
    const mockRows = [{ id: 1, numero: "F-2026-001", client_nom: "Studio Lumière", statut: "impayee" }];
    mockDb.select.mockResolvedValue(mockRows);
    const rows = await getFactures();
    expect(rows).toEqual(mockRows);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("LEFT JOIN clients")
    );
  });
});

describe("getEntreesSansFacture", () => {
  it("retourne les entrées non facturées d'un client", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesSansFacture(1);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("facture_id IS NULL"),
      [1]
    );
  });
});

describe("createFacture", () => {
  it("insère une facture et retourne son id", async () => {
    mockDb.execute.mockResolvedValue({ lastInsertId: 7 });
    const id = await createFacture({
      client_id: 1,
      numero: "F-2026-001",
      date_emission: "2026-08-11",
      montant_total: 120,
    });
    expect(id).toBe(7);
    expect(mockDb.execute).toHaveBeenCalledWith(
      "INSERT INTO factures (client_id, numero, date_emission, montant_total) VALUES (?, ?, ?, ?)",
      [1, "F-2026-001", "2026-08-11", 120]
    );
  });
});

describe("linkEntreesToFacture", () => {
  it("met à jour facture_id pour chaque entrée fournie", async () => {
    mockDb.execute.mockResolvedValue({});
    await linkEntreesToFacture(5, [1, 2, 3]);
    expect(mockDb.execute).toHaveBeenCalledTimes(3);
    expect(mockDb.execute).toHaveBeenCalledWith(
      "UPDATE entrees_temps SET facture_id=? WHERE id=?",
      [5, 1]
    );
  });
});

describe("updateFactureStatut", () => {
  it("met à jour le statut d'une facture", async () => {
    mockDb.execute.mockResolvedValue({});
    await updateFactureStatut(3, "payee");
    expect(mockDb.execute).toHaveBeenCalledWith(
      "UPDATE factures SET statut=? WHERE id=?",
      ["payee", 3]
    );
  });
});

describe("getFacturesParClient", () => {
  it("retourne les factures filtrées par client_id", async () => {
    const mockRows = [
      { id: 1, numero: "F-2026-001", date_emission: "2026-08-11", montant_total: 120, statut: "impayee" },
    ];
    mockDb.select.mockResolvedValue(mockRows);
    const rows = await getFacturesParClient(5);
    expect(rows).toEqual(mockRows);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("WHERE client_id = ?"),
      [5]
    );
  });

  it("retourne un tableau vide si pas de factures", async () => {
    mockDb.select.mockResolvedValue([]);
    const rows = await getFacturesParClient(99);
    expect(rows).toEqual([]);
  });
});
