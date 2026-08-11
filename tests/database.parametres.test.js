import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = {
    select: vi.fn(),
    execute: vi.fn(),
  };
  return { default: { load: vi.fn(() => Promise.resolve(mockDb)) } };
});

import Database from "@tauri-apps/plugin-sql";
import { getParametre, setParametre } from "../src/db/database";

let mockDb;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb = await Database.load();
});

describe("getParametre", () => {
  it("renvoie la valeur quand la clé existe", async () => {
    mockDb.select.mockResolvedValue([{ valeur: "15" }]);
    const val = await getParametre("arrondi_minutes");
    expect(val).toBe("15");
    expect(mockDb.select).toHaveBeenCalledWith(
      "SELECT valeur FROM parametres WHERE cle = ?",
      ["arrondi_minutes"]
    );
  });

  it("renvoie null quand la clé est absente", async () => {
    mockDb.select.mockResolvedValue([]);
    const val = await getParametre("inexistante");
    expect(val).toBeNull();
  });
});

describe("setParametre", () => {
  it("exécute un UPSERT avec la clé et la valeur", async () => {
    mockDb.execute.mockResolvedValue({});
    await setParametre("arrondi_minutes", "30");
    expect(mockDb.execute).toHaveBeenCalledWith(
      "INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur=?",
      ["arrondi_minutes", "30", "30"]
    );
  });

  it("accepte une valeur vide (string vide)", async () => {
    mockDb.execute.mockResolvedValue({});
    await setParametre("nom_entreprise", "");
    expect(mockDb.execute).toHaveBeenCalledWith(
      "INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur=?",
      ["nom_entreprise", "", ""]
    );
  });
});
