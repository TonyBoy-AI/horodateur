import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ClientCard from "../src/components/ClientCard";

const baseClient = {
  id: 1,
  nom: "Studio Lumière",
  taux_horaire: 85,
  couleur: "#7FD8A0",
  actif: 1,
};

describe("ClientCard", () => {
  it("affiche le nom et le taux horaire", () => {
    render(<ClientCard client={baseClient} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("Studio Lumière")).toBeInTheDocument();
    expect(screen.getByText("85 $/h")).toBeInTheDocument();
  });

  it("affiche le badge Actif quand actif=1", () => {
    render(<ClientCard client={baseClient} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("Actif")).toBeInTheDocument();
  });

  it("affiche le badge Inactif quand actif=0", () => {
    const inactif = { ...baseClient, actif: 0 };
    render(<ClientCard client={inactif} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("Inactif")).toBeInTheDocument();
  });

  it("ajoute la classe --inactive quand actif=0", () => {
    const inactif = { ...baseClient, actif: 0 };
    const { container } = render(<ClientCard client={inactif} isSelected={false} onClick={() => {}} />);
    expect(container.firstChild).toHaveClass("client-card--inactive");
  });

  it("ajoute la classe --selected quand isSelected=true", () => {
    const { container } = render(<ClientCard client={baseClient} isSelected={true} onClick={() => {}} />);
    expect(container.firstChild).toHaveClass("client-card--selected");
  });

  it("appelle onClick au clic", async () => {
    const onClick = vi.fn();
    render(<ClientCard client={baseClient} isSelected={false} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: /Studio Lumière/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
