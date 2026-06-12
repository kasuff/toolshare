import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DashboardPage } from "../../src/pages/DashboardPage";

describe("DashboardPage", () => {
  it("renders the wireframe hero and quick start links", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Finde Werkzeuge und Werkstätten in deiner Community." })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Werkzeuge auf einer Werkbank/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Werkzeuge entdecken/i })).toHaveAttribute("href", "/tools");
    expect(screen.getByRole("link", { name: /Werkstätten buchen/i })).toHaveAttribute("href", "/workshops");
    expect(screen.getByRole("link", { name: /Anfragen verwalten/i })).toHaveAttribute("href", "/inbox");
  });
});
