import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = { select: vi.fn(), execute: vi.fn() };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import { createEntreeComplete, getEntreesRecentes } from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("createEntreeComplete", () => {
  it("insère une entrée complète et retourne l'id", async () => {
    mockDb.execute.mockResolvedValue({ lastInsertId: 42 });
    const id = await createEntreeComplete({
      client_id: 1,
      projet_id: 2,
      debut: "2026-08-11T09:00:00",
      fin: "2026-08-11T10:30:00",
      duree_minutes: 90,
      duree_arrondie_minutes: 90,
      note: "Réunion client",
    });
    expect(id).toBe(42);
    expect(mockDb.execute).toHaveBeenCalledWith(
      "INSERT INTO entrees_temps (client_id, projet_id, debut, fin, duree_minutes, duree_arrondie_minutes, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [1, 2, "2026-08-11T09:00:00", "2026-08-11T10:30:00", 90, 90, "Réunion client"]
    );
  });

  it("utilise null pour projet_id absent et note vide", async () => {
    mockDb.execute.mockResolvedValue({ lastInsertId: 1 });
    await createEntreeComplete({
      client_id: 1,
      projet_id: null,
      debut: "2026-08-11T09:00:00",
      fin: "2026-08-11T10:30:00",
      duree_minutes: 90,
      duree_arrondie_minutes: 90,
      note: "",
    });
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.any(String),
      [1, null, "2026-08-11T09:00:00", "2026-08-11T10:30:00", 90, 90, null]
    );
  });
});

describe("getEntreesRecentes", () => {
  it("retourne les entrées avec JOIN clients et projets", async () => {
    const mockRows = [{
      id: 1, debut: "2026-08-11T09:00:00", fin: "2026-08-11T10:30:00",
      duree_minutes: 90, duree_arrondie_minutes: 90, note: null,
      client_nom: "Studio Lumière", projet_nom: null,
    }];
    mockDb.select.mockResolvedValue(mockRows);
    const rows = await getEntreesRecentes(10);
    expect(rows).toEqual(mockRows);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("LEFT JOIN clients"),
      [10]
    );
  });

  it("utilise une limite de 10 par défaut", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesRecentes();
    expect(mockDb.select).toHaveBeenCalledWith(expect.any(String), [10]);
  });
});
