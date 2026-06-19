import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DatenschutzPage } from "../../src/pages/DatenschutzPage";
import { ImpressumPage } from "../../src/pages/ImpressumPage";

describe("legal pages", () => {
  it("renders impressum content", () => {
    render(
      <MemoryRouter>
        <ImpressumPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Impressum", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Maik Unglert/)).toBeInTheDocument();
    expect(screen.getByText(/unglertmaik@gmail.com/)).toBeInTheDocument();
  });

  it("renders datenschutz content", () => {
    render(
      <MemoryRouter>
        <DatenschutzPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Datenschutzerklärung", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Verantwortlicher", level: 2 })).toBeInTheDocument();
  });
});
