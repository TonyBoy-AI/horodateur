import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = { select: vi.fn(), execute: vi.fn() };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import { getEntreesParPeriode } from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("getEntreesParPeriode", () => {
  it("retourne les entrées pour une période sans filtre client", async () => {
    const mockRows = [{
      id: 1, debut: "2026-08-11T09:00:00", fin: "2026-08-11T10:30:00",
      duree_minutes: 90, duree_arrondie_minutes: 90, note: null,
      client_id: 1, client_nom: "Studio Lumière", client_taux: 80, projet_nom: null,
    }];
    mockDb.select.mockResolvedValue(mockRows);
    const rows = await getEntreesParPeriode({
      debut: "2026-08-01T00:00:00",
      fin: "2026-09-01T00:00:00",
    });
    expect(rows).toEqual(mockRows);
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("e.debut >= ?"),
      ["2026-08-01T00:00:00", "2026-09-01T00:00:00"]
    );
  });

  it("ajoute le filtre client_id quand fourni", async () => {
    mockDb.select.mockResolvedValue([]);
    await getEntreesParPeriode({
      debut: "2026-08-01T00:00:00",
      fin: "2026-09-01T00:00:00",
      client_id: 3,
    });
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("AND e.client_id"),
      ["2026-08-01T00:00:00", "2026-09-01T00:00:00", 3]
    );
  });
});
