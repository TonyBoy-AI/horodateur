import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getProjetsByClient: vi.fn(),
  updateEntree: vi.fn(),
  deleteEntree: vi.fn(),
  getParametre: vi.fn(),
}));

import EntreePanel from "../src/components/EntreePanel";
import { getProjetsByClient, updateEntree, deleteEntree, getParametre } from "../src/db/database";

const clients = [
  { id: 1, nom: "Studio Lumière", actif: 1 },
  { id: 2, nom: "AgenceX", actif: 1 },
];

const entree = {
  id: 10,
  client_id: 1,
  projet_id: null,
  debut: "2026-08-01T09:00:00",
  fin: "2026-08-01T11:00:00",
  duree_minutes: 120,
  duree_arrondie_minutes: 120,
  note: "Réunion",
  facture_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getProjetsByClient.mockResolvedValue([{ id: 5, nom: "Site web" }]);
  updateEntree.mockResolvedValue(undefined);
  deleteEntree.mockResolvedValue(undefined);
  getParametre.mockResolvedValue("15");
});

describe("EntreePanel", () => {
  it("affiche les champs préremplis avec les valeurs de l'entrée", async () => {
    render(<EntreePanel entree={entree} clients={clients} onSaved={vi.fn()} onDeleted={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("09:00")).toBeInTheDocument());
    expect(screen.getByDisplayValue("11:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-08-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Réunion")).toBeInTheDocument();
  });

  it("appelle updateEntree et onSaved lors de la sauvegarde", async () => {
    const onSaved = vi.fn();
    render(<EntreePanel entree={entree} clients={clients} onSaved={onSaved} onDeleted={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => screen.getByDisplayValue("09:00"));
    fireEvent.click(screen.getByRole("button", { name: /sauvegarder/i }));
    await waitFor(() => expect(updateEntree).toHaveBeenCalledWith(10, expect.objectContaining({
      client_id: 1,
      debut: "2026-08-01T09:00:00",
      fin: "2026-08-01T11:00:00",
    })));
    expect(onSaved).toHaveBeenCalled();
  });

  it("appelle deleteEntree et onDeleted après confirmation", async () => {
    const onDeleted = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<EntreePanel entree={entree} clients={clients} onSaved={vi.fn()} onDeleted={onDeleted} onClose={vi.fn()} />);
    await waitFor(() => screen.getByDisplayValue("09:00"));
    fireEvent.click(screen.getByRole("button", { name: /supprimer/i }));
    await waitFor(() => expect(deleteEntree).toHaveBeenCalledWith(10));
    expect(onDeleted).toHaveBeenCalled();
  });

  it("désactive le bouton supprimer si l'entrée est facturée", async () => {
    const entreeFacturee = { ...entree, facture_id: 3 };
    render(<EntreePanel entree={entreeFacturee} clients={clients} onSaved={vi.fn()} onDeleted={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => screen.getByDisplayValue("09:00"));
    expect(screen.getByRole("button", { name: /supprimer/i })).toBeDisabled();
  });

  it("appelle onClose quand on clique ✕", async () => {
    const onClose = vi.fn();
    render(<EntreePanel entree={entree} clients={clients} onSaved={vi.fn()} onDeleted={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("✕"));
    expect(onClose).toHaveBeenCalled();
  });
});
