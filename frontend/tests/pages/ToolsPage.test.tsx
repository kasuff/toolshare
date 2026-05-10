import { render, screen, waitFor } from "@testing-library/react";
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
        status: "VERFUEGBAR"
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
    expect(screen.getByText(/Klicke um Details und Buchung zu sehen/i)).toBeInTheDocument();
    await waitFor(() => expect(getTools).toHaveBeenCalled());
  });
});
