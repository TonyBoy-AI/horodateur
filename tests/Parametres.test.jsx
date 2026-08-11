import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/database", () => ({
  getParametre: vi.fn(),
  setParametre: vi.fn(),
}));

import Parametres from "../src/pages/Parametres";
import { getParametre, setParametre } from "../src/db/database";

beforeEach(() => {
  vi.clearAllMocks();
  getParametre.mockImplementation((cle) => {
    const vals = {
      nom_entreprise: "ACME",
      arrondi_minutes: "15",
      rappel_inactivite_heures: "4",
    };
    return Promise.resolve(vals[cle] ?? null);
  });
  setParametre.mockResolvedValue(undefined);
});

describe("Parametres", () => {
  it("affiche les 3 champs avec les valeurs chargées depuis la DB", async () => {
    render(<Parametres />);
    await waitFor(() => expect(screen.getByDisplayValue("ACME")).toBeInTheDocument());
    expect(screen.getByDisplayValue("15 minutes")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4 heures")).toBeInTheDocument();
  });

  it("sauvegarde arrondi_minutes quand le select change", async () => {
    render(<Parametres />);
    await waitFor(() => screen.getByDisplayValue("15 minutes"));
    await userEvent.selectOptions(screen.getByLabelText(/arrondi/i), "30");
    expect(setParametre).toHaveBeenCalledWith("arrondi_minutes", "30");
  });

  it("sauvegarde rappel_inactivite_heures quand le select change", async () => {
    render(<Parametres />);
    await waitFor(() => screen.getByDisplayValue("4 heures"));
    await userEvent.selectOptions(screen.getByLabelText(/rappel/i), "2");
    expect(setParametre).toHaveBeenCalledWith("rappel_inactivite_heures", "2");
  });

  it("sauvegarde nom_entreprise au blur du champ texte", async () => {
    render(<Parametres />);
    await waitFor(() => screen.getByDisplayValue("ACME"));
    const input = screen.getByDisplayValue("ACME");
    await userEvent.clear(input);
    await userEvent.type(input, "Nouvelle Entreprise");
    fireEvent.blur(input);
    expect(setParametre).toHaveBeenCalledWith("nom_entreprise", "Nouvelle Entreprise");
  });

  it("affiche le titre de la page", async () => {
    render(<Parametres />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
