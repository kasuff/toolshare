import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../hooks/useToast";
import { api } from "../../services/api";
import { ToolDetailPage } from "../../pages/ToolDetailPage";
import { WorkshopsPage } from "../../pages/WorkshopsPage";

vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getTools: vi.fn(),
      getRatingsForTool: vi.fn(),
      getWorkshops: vi.fn(),
      createWorkshopBooking: vi.fn()
    }
  };
});

function AuthStateProbe() {
  const location = useLocation();
  return <p data-testid="redirect-hint">{(location.state as { redirectHint?: string } | null)?.redirectHint ?? "no-hint"}</p>;
}

function renderWithRoutes(element: ReactElement, path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="/workshops/:id" element={element} />
          <Route path="/auth" element={<AuthStateProbe />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("Guest protected actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects guests to auth when requesting a tool", async () => {
    vi.mocked(api.getRatingsForTool).mockResolvedValue([]);
    vi.mocked(api.getTools).mockResolvedValue([
      {
        id: "tool-1",
        ownerId: "owner-1",
        name: "Bohrmaschine",
        description: "Leistungsstark",
        category: "Elektro",
        status: "VERFUEGBAR",
        imageUrl: "https://example.com/tool.jpg",
        pickupLocation: "Leopoldstraße 120, 80802 München, Deutschland"
      }
    ]);

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/tools/tool-1"]}>
          <Routes>
            <Route path="/tools/:id" element={<ToolDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByRole("link", { name: "Jetzt einloggen" })).toHaveAttribute("href", "/auth");
  });

  it("redirects guests to auth when booking a workshop slot", async () => {
    vi.mocked(api.getWorkshops).mockResolvedValue([
      {
        workshop: {
          id: "workshop-1",
          ownerId: "owner-1",
          name: "Holzwerkstatt",
          description: "Mit Betreuung",
          location: "München",
          maxCapacity: 5,
          extras: [],
          equipmentItems: [],
          imageUrls: [],
          toolIds: []
        },
        slots: [
          {
            id: "slot-1",
            workshopId: "workshop-1",
            startIso: "2026-05-06T10:00",
            endIso: "2026-05-06T12:00",
            blockedByOwner: false
          }
        ],
        tools: []
      }
    ]);

    renderWithRoutes(<WorkshopsPage />, "/workshops");

    fireEvent.click((await screen.findByText("Holzwerkstatt")).closest("article")!);
    fireEvent.click(await screen.findByRole("button", { name: "Jetzt einloggen" }));

    expect(await screen.findByTestId("redirect-hint")).toHaveTextContent(
      "Bitte melde dich an, um eine Werkstatt zu buchen."
    );
  });

  it("keeps borrowed workshop tools out of the selectable filter and marks them in details", async () => {
    vi.mocked(api.getWorkshops).mockResolvedValue([
      {
        workshop: {
          id: "workshop-1",
          ownerId: "owner-1",
          name: "Holzwerkstatt",
          description: "Mit Betreuung",
          location: "München",
          maxCapacity: 5,
          extras: [],
          equipmentItems: [],
          imageUrls: [],
          toolIds: []
        },
        slots: [],
        tools: [
          {
            id: "tool-available",
            ownerId: "owner-1",
            name: "Bandsäge",
            description: "Werkstatt-Werkzeug",
            category: "holz",
            status: "VERFUEGBAR",
            imageUrl: "https://example.com/available.jpg",
            selectable: true
          },
          {
            id: "tool-borrowed",
            ownerId: "owner-1",
            name: "Schleifer",
            description: "Werkstatt-Werkzeug",
            category: "holz",
            status: "AUSGELIEHEN",
            imageUrl: "https://example.com/borrowed.jpg",
            selectable: false
          }
        ]
      }
    ]);

    renderWithRoutes(<WorkshopsPage />, "/workshops");

    const toolFilter = await screen.findByRole("combobox", { name: /Werkzeugfilter/i });
    expect(toolFilter).toHaveTextContent("Bandsäge");
    expect(toolFilter).not.toHaveTextContent("Schleifer");

    fireEvent.click((await screen.findByText("Holzwerkstatt")).closest("article")!);

    expect((await screen.findAllByText("Bandsäge")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Schleifer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ausgeliehen").length).toBeGreaterThan(0);
  });
});
