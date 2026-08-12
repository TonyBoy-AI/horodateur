import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getEntreesParFacture: vi.fn(),
}));

vi.mock("../src/utils/generatePdf", () => ({
  generatePdf: vi.fn().mockResolvedValue({ pdfBytes: new Uint8Array() }),
  downloadPdf: vi.fn(),
}));

import ClientFacturesPanel from "../src/components/ClientFacturesPanel";
import { getEntreesParFacture } from "../src/db/database";
import { generatePdf, downloadPdf } from "../src/utils/generatePdf";

const client = {
  id: 1, nom: "Studio Lumière", taux_horaire: 80,
  courriel: "a@b.ca", telephone: "", adresse: "", personne_reference: "",
};

const factures = [
  { id: 1, numero: "F-2026-001", date_emission: "2026-08-11", montant_total: 120, statut: "impayee" },
  { id: 2, numero: "F-2026-002", date_emission: "2026-07-15", montant_total: 80, statut: "payee" },
];

beforeEach(() => {
  vi.clearAllMocks();
  getEntreesParFacture.mockResolvedValue([]);
});

describe("ClientFacturesPanel", () => {
  it("affiche le titre Factures", () => {
    render(<ClientFacturesPanel client={client} factures={[]} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Factures");
  });

  it("affiche un message vide quand pas de factures", () => {
    render(<ClientFacturesPanel client={client} factures={[]} />);
    expect(screen.getByText("Aucune facture pour ce client.")).toBeInTheDocument();
  });

  it("affiche chaque facture avec numéro, montant et statut", () => {
    render(<ClientFacturesPanel client={client} factures={factures} />);
    expect(screen.getByText("F-2026-001")).toBeInTheDocument();
    expect(screen.getByText("120.00 $")).toBeInTheDocument();
    expect(screen.getByText("Impayée")).toBeInTheDocument();
    expect(screen.getByText("Payée")).toBeInTheDocument();
  });

  it("formate la date en JJ-M-AAAA", () => {
    render(<ClientFacturesPanel client={client} factures={[factures[0]]} />);
    expect(screen.getByText("11-8-2026")).toBeInTheDocument();
  });

  it("télécharge le PDF quand on clique sur 📄", async () => {
    render(<ClientFacturesPanel client={client} factures={[factures[0]]} />);
    await userEvent.click(screen.getByTitle("Télécharger le PDF"));
    await waitFor(() => expect(generatePdf).toHaveBeenCalledWith(
      factures[0], client, []
    ));
    expect(downloadPdf).toHaveBeenCalledWith(expect.any(Uint8Array), "F-2026-001.pdf");
  });
});
