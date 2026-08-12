import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = { select: vi.fn(), execute: vi.fn() };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import { updateEntree, deleteEntree, getEntreesRecentes, getEntreesParPeriode } from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("updateEntree", () => {
  it("exécute UPDATE avec tous les champs", async () => {
    mockDb.execute.mockResolvedValue({});
    await updateEntree(5, {
      client_id: 1,
      projet_id: 2,
      debut: "2026-08-01T09:00:00",
      fin: "2026-08-01T11:00:00",
      duree_minutes: 120,
      duree_arrondie_minutes: 120,
      note: "Travail",
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      "UPDATE entrees_temps SET client_id=?, projet_id=?, debut=?, fin=?, duree_minutes=?, duree_arrondie_minutes=?, note=? WHERE id=?",
      [1, 2, "2026-08-01T09:00:00", "2026-08-01T11:00:00", 120, 120, "Travail", 5]
    );
  });

  it("accepte projet_id null", async () => {
    mockDb.execute.mockResolvedValue({});
    await updateEntree(5, {
      client_id: 1,
      projet_id: null,
      debut: "2026-08-01T09:00:00",
      fin: "2026-08-01T11:00:00",
      duree_minutes: 120,
      duree_arrondie_minutes: 120,
      note: null,
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.any(String),
      [1, null, "2026-08-01T09:00:00", "2026-08-01T11:00:00", 120, 120, null, 5]
    );
  });
});

describe("deleteEntree", () => {
  it("supprime l'entrée si elle n'est pas facturée", async () => {
    mockDb.execute.mockResolvedValue({ rowsAffected: 1 });
    await deleteEntree(3);
    expect(mockDb.execute).toHaveBeenCalledWith(
      "DELETE FROM entrees_temps WHERE id = ? AND facture_id IS NULL",
      [3]
    );
  });

  it("lance une erreur si l'entrée est liée à une facture", async () => {
    mockDb.execute.mockResolvedValue({ rowsAffected: 0 });
    mockDb.select.mockResolvedValue([{ facture_id: 7 }]);
    await expect(deleteEntree(3)).rejects.toThrow("liée à une facture");
  });

  it("ne lance pas d'erreur si l'entrée n'existe pas (idempotent)", async () => {
    mockDb.execute.mockResolvedValue({ rowsAffected: 0 });
    mockDb.select.mockResolvedValue([]); // aucune ligne retournée
    await expect(deleteEntree(99)).resolves.toBeUndefined();
  });
});

describe("getEntreesRecentes", () => {
  it("inclut client_id, projet_id et facture_id dans le SELECT", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesRecentes(10);
    const query = mockDb.select.mock.calls[0][0];
    expect(query).toContain("e.client_id");
    expect(query).toContain("e.projet_id");
    expect(query).toContain("e.facture_id");
  });
});

describe("getEntreesParPeriode", () => {
  it("inclut projet_id et facture_id dans le SELECT", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesParPeriode({ debut: "2026-08-01T00:00:00", fin: "2026-09-01T00:00:00" });
    const query = mockDb.select.mock.calls[0][0];
    expect(query).toContain("e.projet_id");
    expect(query).toContain("e.facture_id");
  });
});
