import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getClients: vi.fn(),
  getFacturesParClient: vi.fn(),
}));

vi.mock("../src/components/ClientPanel", () => ({
  default: ({ client, onClose }) => (
    <div data-testid="client-panel">
      {client?.nom}
      <button onClick={onClose}>Fermer</button>
    </div>
  ),
}));

vi.mock("../src/components/ClientFacturesPanel", () => ({
  default: ({ factures }) => (
    <div data-testid="factures-panel">{factures.length} facture(s)</div>
  ),
}));

import Clients from "../src/pages/Clients";
import { getClients, getFacturesParClient } from "../src/db/database";

const mockClients = [
  { id: 1, nom: "Studio Lumière", taux_horaire: 80, actif: 1, couleur: "#7FD8A0" },
];

beforeEach(() => {
  vi.clearAllMocks();
  getClients.mockResolvedValue(mockClients);
  getFacturesParClient.mockResolvedValue([]);
});

describe("Clients", () => {
  it("n'affiche pas le panel d'historique au chargement", async () => {
    render(<Clients />);
    await waitFor(() => expect(screen.getByText("Studio Lumière")).toBeInTheDocument());
    expect(screen.queryByTestId("factures-panel")).not.toBeInTheDocument();
  });

  it("affiche le panel d'historique quand un client est sélectionné", async () => {
    render(<Clients />);
    await waitFor(() => expect(screen.getByText("Studio Lumière")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Studio Lumière"));
    await waitFor(() => expect(getFacturesParClient).toHaveBeenCalledWith(1));
    expect(screen.getByTestId("factures-panel")).toBeInTheDocument();
  });

  it("affiche les factures du client dans le panel", async () => {
    getFacturesParClient.mockResolvedValue([
      { id: 1, numero: "F-2026-001", montant_total: 120, statut: "impayee" },
    ]);
    render(<Clients />);
    await waitFor(() => expect(screen.getByText("Studio Lumière")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Studio Lumière"));
    await waitFor(() => expect(screen.getByText("1 facture(s)")).toBeInTheDocument());
  });

  it("cache le panel d'historique quand on ferme le panel client", async () => {
    render(<Clients />);
    await waitFor(() => expect(screen.getByText("Studio Lumière")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Studio Lumière"));
    await waitFor(() => expect(screen.getByTestId("factures-panel")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Fermer"));
    expect(screen.queryByTestId("factures-panel")).not.toBeInTheDocument();
  });
});
