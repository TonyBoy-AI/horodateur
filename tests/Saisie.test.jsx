import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getClients: vi.fn(),
  getProjetsByClient: vi.fn(),
  createEntreeComplete: vi.fn(),
  getEntreesRecentes: vi.fn(),
  getParametre: vi.fn(),
}));

import Saisie from "../src/pages/Saisie";
import { getClients, getProjetsByClient, createEntreeComplete, getEntreesRecentes, getParametre } from "../src/db/database";

beforeEach(() => {
  vi.clearAllMocks();
  getClients.mockResolvedValue([{ id: 1, nom: "Studio Lumière", actif: 1 }]);
  getProjetsByClient.mockResolvedValue([]);
  createEntreeComplete.mockResolvedValue(1);
  getEntreesRecentes.mockResolvedValue([]);
  getParametre.mockResolvedValue("15");
});

describe("Saisie", () => {
  it("affiche le formulaire avec la date du jour par défaut", async () => {
    render(<Saisie />);
    const today = new Date().toISOString().slice(0, 10);
    await waitFor(() => expect(screen.getByLabelText(/date/i)).toHaveValue(today));
  });

  it("affiche une erreur si client non sélectionné", async () => {
    render(<Saisie />);
    await userEvent.click(screen.getByRole("button", { name: /ajouter/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/client/i);
  });

  it("affiche une erreur si les heures sont manquantes", async () => {
    render(<Saisie />);
    await waitFor(() => screen.getByText("Studio Lumière"));
    await userEvent.selectOptions(screen.getByLabelText(/client/i), "1");
    await userEvent.click(screen.getByRole("button", { name: /ajouter/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/heure/i);
  });

  it("affiche une erreur si fin <= début", async () => {
    render(<Saisie />);
    await waitFor(() => screen.getByText("Studio Lumière"));
    await userEvent.selectOptions(screen.getByLabelText(/client/i), "1");
    fireEvent.change(screen.getByLabelText(/début/i), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText(/fin/i), { target: { value: "09:00" } });
    await userEvent.click(screen.getByRole("button", { name: /ajouter/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/fin/i);
  });

  it("crée une entrée valide et affiche le message de succès", async () => {
    render(<Saisie />);
    await waitFor(() => screen.getByText("Studio Lumière"));
    await userEvent.selectOptions(screen.getByLabelText(/client/i), "1");
    fireEvent.change(screen.getByLabelText(/début/i), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText(/fin/i), { target: { value: "10:30" } });
    await userEvent.click(screen.getByRole("button", { name: /ajouter/i }));
    await waitFor(() =>
      expect(createEntreeComplete).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: 1, duree_minutes: 90 })
      )
    );
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
  });

  it("affiche la section des entrées récentes quand il y en a", async () => {
    getEntreesRecentes.mockResolvedValue([{
      id: 1, debut: "2026-08-11T09:00:00", fin: "2026-08-11T10:30:00",
      duree_minutes: 90, duree_arrondie_minutes: 90, note: null,
      client_nom: "Atelier Zinc", projet_nom: null,
    }]);
    render(<Saisie />);
    await waitFor(() => expect(screen.getByText("Atelier Zinc")).toBeInTheDocument());
    expect(screen.getByText(/entrées récentes/i)).toBeInTheDocument();
  });
});
