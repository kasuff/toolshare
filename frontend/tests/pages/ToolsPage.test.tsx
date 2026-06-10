import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { ToolsPage } from "../../src/pages/ToolsPage";

const { getTools } = vi.hoisted(() => ({
  getTools: vi.fn()
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getTools,
    createToolRequest: vi.fn()
  }
}));

describe("ToolsPage", () => {
  it("renders tool cards as detail links and no longer shows inline booking controls", async () => {
    getTools.mockResolvedValueOnce([
      {
        id: "t1",
        ownerId: "u1",
        name: "Akkuschrauber Bosch",
        description: "Leistungsstark",
        category: "Elektro",
        imageUrl: "https://example.com/tool.jpg",
        status: "VERFUEGBAR",
        pickupLocation: "Leopoldstraße 120, 80802 München, Deutschland"
      }
    ]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <ToolsPage token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    const toolLink = await screen.findByRole("link", { name: /Akkuschrauber Bosch/i });
    expect(toolLink).toHaveAttribute("href", "/tools/t1");
    expect(screen.queryByText("Ausleihanfrage vorbereiten")).not.toBeInTheDocument();
    expect(screen.getByText(/^Details$/i)).toBeInTheDocument();
    await waitFor(() => expect(getTools).toHaveBeenCalled());
  });

  it("shows guest banner and resets filters", async () => {
    getTools
      .mockResolvedValueOnce([
        {
          id: "t1",
          ownerId: "u1",
          name: "Säge",
          description: "Holz",
          category: "Holz",
          imageUrl: "https://example.com/tool.jpg",
          status: "VERFUEGBAR",
          pickupLocation: "Heidemannstraße 20, 80939 München, Deutschland"
        }
      ])
      .mockResolvedValue([
        {
          id: "t1",
          ownerId: "u1",
          name: "Säge",
          description: "Holz",
          category: "Holz",
          imageUrl: "https://example.com/tool.jpg",
          status: "VERFUEGBAR",
          pickupLocation: "Heidemannstraße 20, 80939 München, Deutschland"
        }
      ]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <ToolsPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText(/Du kannst als Gast stöbern/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bitte anmelden" })).toBeInTheDocument();
    expect(screen.queryByText("Easy verleihen. Schnell Nachbarn helfen.")).not.toBeInTheDocument();
    const guestBanner = screen.getByRole("complementary");
    expect(guestBanner.closest(".search-page")?.firstElementChild).toBe(guestBanner);
    const searchInput = screen.getByPlaceholderText(/Name oder Beschreibung/i);
    const categoryInput = screen.getByRole("combobox", { name: /Kategorie/i });

    fireEvent.change(searchInput, { target: { value: "Bohr" } });
    fireEvent.change(categoryInput, { target: { value: "elektro" } });

    const resetButton = await screen.findByRole("button", { name: /Filter zurücksetzen/i });
    fireEvent.click(resetButton);

    expect(searchInput).toHaveValue("");
    expect(categoryInput).toHaveValue("");
  });
});
