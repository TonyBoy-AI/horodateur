import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getClients: vi.fn(),
  getEntreesParPeriode: vi.fn(),
}));

import Rapports from "../src/pages/Rapports";
import { getClients, getEntreesParPeriode } from "../src/db/database";

beforeEach(() => {
  vi.clearAllMocks();
  getClients.mockResolvedValue([{ id: 1, nom: "Studio Lumière", actif: 1 }]);
  getEntreesParPeriode.mockResolvedValue([]);
});

describe("Rapports", () => {
  it("affiche le titre et les boutons de période", () => {
    render(<Rapports />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Cette semaine")).toBeInTheDocument();
    expect(screen.getByText("Ce mois")).toBeInTheDocument();
    expect(screen.getByText("Personnalisé")).toBeInTheDocument();
  });

  it("charge les entrées du mois courant au mount", async () => {
    render(<Rapports />);
    await waitFor(() => expect(getEntreesParPeriode).toHaveBeenCalled());
    const call = getEntreesParPeriode.mock.calls[0][0];
    expect(call.debut).toMatch(/^\d{4}-\d{2}-01T00:00:00$/);
  });

  it("affiche le total des heures et la répartition par client", async () => {
    getEntreesParPeriode.mockResolvedValue([{
      id: 1, debut: "2026-08-11T09:00:00", fin: "2026-08-11T10:30:00",
      duree_minutes: 90, duree_arrondie_minutes: 90, note: null,
      client_id: 1, client_nom: "Studio Lumière", client_taux: 80, projet_nom: null,
    }]);
    render(<Rapports />);
    await waitFor(() => expect(screen.getAllByText("1h30")[0]).toBeInTheDocument());
    expect(screen.getByText("Studio Lumière")).toBeInTheDocument();
    expect(screen.getByText("120.00 $")).toBeInTheDocument();
  });

  it("bascule vers 'semaine' et recharge les entrées", async () => {
    render(<Rapports />);
    await waitFor(() => expect(getEntreesParPeriode).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByText("Cette semaine"));
    await waitFor(() => expect(getEntreesParPeriode).toHaveBeenCalledTimes(2));
  });

  it("affiche 'Aucune entrée' quand la liste est vide", async () => {
    render(<Rapports />);
    await waitFor(() => expect(screen.getByText(/aucune entrée/i)).toBeInTheDocument());
  });
});
