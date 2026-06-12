import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { ToolDetailPage } from "../../src/pages/ToolDetailPage";
import { ToastViewport } from "../../src/components/ui";
import { DEFAULT_PLACEHOLDER_IMAGE } from "../../src/utils/categories";

const { getTools, createToolRequest, createReport } = vi.hoisted(() => ({
  getTools: vi.fn(),
  createToolRequest: vi.fn(),
  createReport: vi.fn()
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getTools,
    createToolRequest,
    createReport
  }
}));

describe("ToolDetailPage", () => {
  it("shows the design-system detail layout with calendar and discrete booking inputs", async () => {
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
        <MemoryRouter initialEntries={["/tools/t1"]}>
          <Routes>
            <Route path="/tools/:id" element={<ToolDetailPage token="token-123" />} />
            <Route path="/inbox" element={<div>Inbox</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Werkzeug buchen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Werkzeug melden" })).toBeInTheDocument();
    const title = screen.getByRole("heading", { name: "Akkuschrauber Bosch", level: 1 });
    expect(title.parentElement).toHaveTextContent("Akkuschrauber BoschElektrowerkzeuge");
    expect(screen.getByRole("button", { name: "Akkuschrauber Bosch vergrößern" }).querySelector(".status-badge")).toBeNull();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Abholdatum")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Abholzeit")).toHaveAttribute("type", "time");
    expect(screen.getByLabelText("Abgabedatum")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Abgabezeit")).toHaveAttribute("type", "time");
    expect(screen.getByRole("button", { name: "Nächste Monate" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Akkuschrauber Bosch vergrößern" }));
    expect(screen.getByRole("dialog", { name: "Bild von Akkuschrauber Bosch" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bildansicht schließen" }));
    expect(screen.queryByRole("dialog", { name: "Bild von Akkuschrauber Bosch" })).not.toBeInTheDocument();
    await waitFor(() => expect(getTools).toHaveBeenCalled());
  });

  it("shows a notice instead of opening the default image", async () => {
    getTools.mockResolvedValueOnce([
      {
        id: "t1",
        ownerId: "u1",
        name: "Akkuschrauber Bosch",
        description: "Leistungsstark",
        category: "Elektro",
        imageUrl: DEFAULT_PLACEHOLDER_IMAGE,
        status: "VERFUEGBAR"
      }
    ]);

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/tools/t1"]}>
          <Routes>
            <Route path="/tools/:id" element={<ToolDetailPage token="token-123" />} />
          </Routes>
        </MemoryRouter>
        <ToastViewport />
      </ToastProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Keine Bilder vorhanden" }));

    expect(await screen.findByText("Keine Bilder vorhanden.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Bild von/i })).not.toBeInTheDocument();
  });

  it("creates the request from the selected pickup and return data", async () => {
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
    createToolRequest.mockResolvedValueOnce({ id: "b1" });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/tools/t1"]}>
          <Routes>
            <Route path="/tools/:id" element={<ToolDetailPage token="token-123" />} />
            <Route path="/inbox" element={<div>Inbox</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByText("Werkzeug buchen");

    fireEvent.change(screen.getByLabelText("Abholdatum"), { target: { value: "2026-07-06" } });
    fireEvent.change(screen.getByLabelText("Abholzeit"), { target: { value: "09:30" } });
    fireEvent.change(screen.getByLabelText("Abgabedatum"), { target: { value: "2026-07-08" } });
    fireEvent.change(screen.getByLabelText("Abgabezeit"), { target: { value: "11:00" } });

    fireEvent.click(screen.getByRole("button", { name: /Anfrage senden/i }));

    await waitFor(() =>
      expect(createToolRequest).toHaveBeenCalledWith(
        {
          toolId: "t1",
          startIso: "2026-07-06T09:30",
          endIso: "2026-07-08T11:00",
          pickupTimeIso: "2026-07-06T09:30"
        },
        "token-123"
      )
    );
  });

  it("rejects an invalid return before pickup", async () => {
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
        <MemoryRouter initialEntries={["/tools/t1"]}>
          <Routes>
            <Route path="/tools/:id" element={<ToolDetailPage token="token-123" />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByText("Werkzeug buchen");
    fireEvent.change(screen.getByLabelText("Abholdatum"), { target: { value: "2026-07-06" } });
    fireEvent.change(screen.getByLabelText("Abholzeit"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText("Abgabedatum"), { target: { value: "2026-07-06" } });
    fireEvent.change(screen.getByLabelText("Abgabezeit"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: /Anfrage senden/i }));

    await waitFor(() => expect(createToolRequest).not.toHaveBeenCalled());
  });

  it("shows unavailable and guest states with proper actions", async () => {
    getTools
      .mockResolvedValueOnce([
        {
          id: "t1",
          ownerId: "u1",
          name: "Akkuschrauber Bosch",
          description: "Leistungsstark",
          category: "Elektro",
          imageUrl: "https://example.com/tool.jpg",
          status: "AUSGELIEHEN"
        }
      ])
      .mockResolvedValueOnce([
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

    const { unmount } = render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/tools/t1"]}>
          <Routes>
            <Route path="/tools/:id" element={<ToolDetailPage token="token-123" />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText(/derzeit ausgeliehen/i)).toBeInTheDocument();
    unmount();

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/tools/t1"]}>
          <Routes>
            <Route path="/tools/:id" element={<ToolDetailPage />} />
            <Route path="/auth" element={<p>auth-screen</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByRole("link", { name: /Jetzt einloggen/i })).toHaveAttribute("href", "/auth");
  });
});
