import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getClients: vi.fn(),
  getFactures: vi.fn(),
  getEntreesSansFacture: vi.fn(),
  createFacture: vi.fn(),
  linkEntreesToFacture: vi.fn(),
  updateFactureStatut: vi.fn(),
}));

import Factures from "../src/pages/Factures";
import {
  getClients,
  getFactures,
  getEntreesSansFacture,
  createFacture,
  linkEntreesToFacture,
  updateFactureStatut,
} from "../src/db/database";

beforeEach(() => {
  vi.clearAllMocks();
  getClients.mockResolvedValue([{ id: 1, nom: "Studio Lumière", taux_horaire: 80, actif: 1 }]);
  getFactures.mockResolvedValue([]);
  getEntreesSansFacture.mockResolvedValue([]);
  createFacture.mockResolvedValue(1);
  linkEntreesToFacture.mockResolvedValue(undefined);
  updateFactureStatut.mockResolvedValue(undefined);
});

describe("Factures", () => {
  it("affiche le titre et le bouton Nouvelle facture", async () => {
    render(<Factures />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("+ Nouvelle facture")).toBeInTheDocument();
  });

  it("affiche la liste des factures avec statut et montant", async () => {
    getFactures.mockResolvedValue([{
      id: 1, numero: "F-2026-001", client_nom: "Studio Lumière",
      date_emission: "2026-08-11", montant_total: 120, statut: "impayee",
    }]);
    render(<Factures />);
    await waitFor(() => expect(screen.getByText("F-2026-001")).toBeInTheDocument());
    expect(screen.getByText("Impayée")).toBeInTheDocument();
    expect(screen.getByText("120.00 $")).toBeInTheDocument();
  });

  it("marque une facture comme payée", async () => {
    getFactures.mockResolvedValue([{
      id: 1, numero: "F-2026-001", client_nom: "Studio Lumière",
      date_emission: "2026-08-11", montant_total: 120, statut: "impayee",
    }]);
    render(<Factures />);
    await waitFor(() => screen.getByText("Marquer payée"));
    await userEvent.click(screen.getByText("Marquer payée"));
    expect(updateFactureStatut).toHaveBeenCalledWith(1, "payee");
  });

  it("ouvre le panel de création au clic sur Nouvelle facture", async () => {
    render(<Factures />);
    await userEvent.click(screen.getByText("+ Nouvelle facture"));
    expect(screen.getByText("Nouvelle facture")).toBeInTheDocument();
    expect(screen.getByLabelText(/client/i)).toBeInTheDocument();
  });

  it("charge les entrées quand un client est sélectionné dans le panel", async () => {
    getEntreesSansFacture.mockResolvedValue([{
      id: 1, debut: "2026-08-11T09:00:00", fin: "2026-08-11T10:30:00",
      duree_minutes: 90, duree_arrondie_minutes: 90, note: null, projet_nom: null,
    }]);
    render(<Factures />);
    await userEvent.click(screen.getByText("+ Nouvelle facture"));
    await userEvent.selectOptions(screen.getByLabelText(/client/i), "1");
    await waitFor(() => expect(getEntreesSansFacture).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByText("1h30")).toBeInTheDocument());
  });
});
