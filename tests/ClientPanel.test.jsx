import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  getProjetsByClient: vi.fn(),
}));

import ClientPanel from "../src/components/ClientPanel";
import { createClient, getProjetsByClient } from "../src/db/database";

beforeEach(() => {
  vi.clearAllMocks();
  getProjetsByClient.mockResolvedValue([]);
  createClient.mockResolvedValue(1);
});

describe("ClientPanel — nouveaux champs contact", () => {
  it("affiche le champ téléphone", () => {
    render(<ClientPanel client={null} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} />);
    expect(screen.getByLabelText(/téléphone/i)).toBeInTheDocument();
  });

  it("affiche le champ personne de référence", () => {
    render(<ClientPanel client={null} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} />);
    expect(screen.getByLabelText(/référence/i)).toBeInTheDocument();
  });

  it("pré-remplit telephone depuis le client existant", () => {
    const client = {
      id: 1, nom: "Studio", taux_horaire: 80, courriel: "", adresse: "",
      telephone: "581-999-1234", personne_reference: "Alice", couleur: "#7FD8A0", actif: 1,
    };
    render(<ClientPanel client={client} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} />);
    expect(screen.getByDisplayValue("581-999-1234")).toBeInTheDocument();
  });

  it("inclut telephone et personne_reference lors de la création", async () => {
    render(<ClientPanel client={null} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} />);
    await userEvent.type(screen.getByLabelText(/nom \*/i), "Test Corp");
    await userEvent.type(screen.getByLabelText(/taux horaire/i), "75");
    await userEvent.type(screen.getByLabelText(/téléphone/i), "418-000-0000");
    await userEvent.type(screen.getByLabelText(/référence/i), "Bob Martin");
    await userEvent.click(screen.getByText(/sauvegarder/i));
    await waitFor(() =>
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({ telephone: "418-000-0000", personne_reference: "Bob Martin" })
      )
    );
  });
});
