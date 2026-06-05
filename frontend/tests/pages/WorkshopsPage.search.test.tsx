import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { WorkshopsPage } from "../../src/pages/WorkshopsPage";
import type { Tool, Workshop, WorkshopSlot } from "../../src/types/domain";

const { createWorkshopBooking, getWorkshops } = vi.hoisted(() => ({
  createWorkshopBooking: vi.fn(),
  getWorkshops: vi.fn()
}));

vi.mock("../../src/services/api", () => ({
  api: {
    createWorkshopBooking,
    getWorkshops
  }
}));

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location-path">{location.pathname}</span>;
}

function renderPage(initialPath = "/workshops") {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationProbe />
        <Routes>
          <Route
            path="/workshops"
            element={
              <WorkshopsPage
                token="token-123"
                currentUser={{
                  id: "requester-1",
                  name: "Mara Beispiel",
                  email: "mara@example.com",
                  address: "München Zentrum",
                  role: "NUTZER",
                  isSuspended: false
                }}
              />
            }
          />
          <Route
            path="/workshops/:id"
            element={
              <WorkshopsPage
                token="token-123"
                currentUser={{
                  id: "requester-1",
                  name: "Mara Beispiel",
                  email: "mara@example.com",
                  address: "München Zentrum",
                  role: "NUTZER",
                  isSuspended: false
                }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

function workshop(overrides: Partial<Workshop>): Workshop {
  return {
    id: "workshop-1",
    ownerId: "owner-1",
    ownerName: "Konstantin Keller",
    name: "Keller-Werkstatt",
    description: "Ruhige Werkstatt für Reparaturen",
    location: "Leopoldstraße 120, München",
    maxCapacity: 5,
    extras: [],
    equipmentItems: [],
    imageUrls: ["https://example.com/workshop.jpg"],
    toolIds: [],
    ...overrides
  };
}

function slot(overrides: Partial<WorkshopSlot>): WorkshopSlot {
  return {
    id: "slot-1",
    workshopId: "workshop-1",
    startIso: "2026-06-03T10:00",
    endIso: "2026-06-03T12:00",
    blockedByOwner: false,
    ...overrides
  };
}

function tool(overrides: Partial<Tool & { selectable: boolean }>): Tool & { selectable: boolean } {
  return {
    id: "tool-1",
    ownerId: "owner-1",
    ownerName: "Konstantin Keller",
    name: "Bandsäge",
    description: "Werkstatt-Werkzeug",
    category: "holz",
    imageUrl: "https://example.com/tool.jpg",
    status: "VERFUEGBAR",
    selectable: true,
    ...overrides
  };
}

describe("WorkshopsPage search filters", () => {
  it("filters approved workshops by radius and keeps the map slider capped at 5 km", async () => {
    getWorkshops.mockResolvedValueOnce([
      {
        workshop: workshop({ id: "near", name: "Schwabing-Werkstatt", location: "Leopoldstraße 120, München" }),
        slots: [slot({ workshopId: "near" })],
        tools: []
      },
      {
        workshop: workshop({ id: "far", name: "Neufreimann-Werkstatt", location: "Heidemannstraße 20, München" }),
        slots: [slot({ workshopId: "far" })],
        tools: []
      }
    ]);

    renderPage();

    expect(await screen.findByText("Schwabing-Werkstatt")).toBeInTheDocument();
    expect(screen.queryByText("Neufreimann-Werkstatt")).not.toBeInTheDocument();

    const radiusSlider = screen.getByLabelText(/Umkreis/i);
    expect(radiusSlider).toHaveAttribute("max", "5");

    fireEvent.change(radiusSlider, { target: { value: "1" } });
    await waitFor(() => expect(screen.queryByText("Schwabing-Werkstatt")).not.toBeInTheDocument());
    expect(screen.getByText("Keine Werkstatt gefunden")).toBeInTheDocument();
  });

  it("filters workshops by selectable tools, date range and capacity", async () => {
    getWorkshops.mockResolvedValueOnce([
      {
        workshop: workshop({ id: "matching", name: "Holzwerkstatt", maxCapacity: 4 }),
        slots: [slot({ workshopId: "matching", startIso: "2026-06-03T10:00", endIso: "2026-06-03T12:00" })],
        tools: [
          tool({ id: "saw", name: "Bandsäge", selectable: true }),
          tool({ id: "borrowed", name: "Schleifer", selectable: false, status: "AUSGELIEHEN" })
        ]
      },
      {
        workshop: workshop({ id: "large", name: "Große Werkstatt", maxCapacity: 8 }),
        slots: [slot({ workshopId: "large", startIso: "2026-06-03T10:00", endIso: "2026-06-03T12:00" })],
        tools: [tool({ id: "drill", name: "Bohrmaschine", selectable: true })]
      },
      {
        workshop: workshop({ id: "wrong-date", name: "Terminfreie Werkstatt", maxCapacity: 3 }),
        slots: [slot({ workshopId: "wrong-date", startIso: "2026-06-10T10:00", endIso: "2026-06-10T12:00" })],
        tools: [tool({ id: "saw-late", name: "Bandsäge", selectable: true })]
      }
    ]);

    renderPage();

    expect(await screen.findByText("Holzwerkstatt")).toBeInTheDocument();

    const toolFilter = screen.getByRole("combobox", { name: /Werkzeugfilter/i });
    expect(toolFilter).toHaveTextContent("Bandsäge");
    expect(toolFilter).not.toHaveTextContent("Schleifer");
    fireEvent.change(toolFilter, { target: { value: "saw" } });

    fireEvent.click(screen.getByText(/Erweiterte Filter anzeigen/i));
    fireEvent.change(screen.getByLabelText(/Ausleihe von/i), { target: { value: "2026-06-03" } });
    fireEvent.change(screen.getByLabelText(/Ausleihe bis/i), { target: { value: "2026-06-03" } });
    fireEvent.change(screen.getByLabelText(/Maximale Kapazität/i), { target: { value: "4" } });

    await waitFor(() => {
      expect(screen.getByText("Holzwerkstatt")).toBeInTheDocument();
      expect(screen.queryByText("Große Werkstatt")).not.toBeInTheDocument();
      expect(screen.queryByText("Terminfreie Werkstatt")).not.toBeInTheDocument();
    });
  });

  it("opens details, marks unavailable workshops with the design-system badge and starts bookings", async () => {
    createWorkshopBooking.mockResolvedValueOnce({});
    getWorkshops.mockResolvedValueOnce([
      {
        workshop: workshop({
          id: "available",
          name: "Nähstube",
          description: "Ausstattung: sewing, light",
          extras: ["sewing"],
          ownerName: "Nina Nadel"
        }),
        slots: [slot({ workshopId: "available" })],
        tools: [tool({ id: "needle", name: "Nähmaschine", selectable: true })]
      },
      {
        workshop: workshop({ id: "blocked", name: "Blockierte Werkstatt" }),
        slots: [slot({ workshopId: "blocked", blockedByOwner: true })],
        tools: []
      }
    ]);

    renderPage();

    const blockedCard = (await screen.findByText("Blockierte Werkstatt")).closest("article")!;
    expect(within(blockedCard).getByText("✕ Nicht verfügbar")).toHaveClass("unavailable");

    fireEvent.click(screen.getByText("Nähstube").closest("article")!);

    expect(await screen.findByRole("dialog", { name: "Nähstube" })).toBeInTheDocument();
    expect(screen.getByTestId("location-path")).toHaveTextContent("/workshops/available");
    expect(screen.getByText("Leopoldstraße 120, München")).toBeInTheDocument();
    expect(screen.getAllByText("Nähmaschine").length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: "Buchen" }));
    await waitFor(() =>
      expect(createWorkshopBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          workshopId: "available",
          workshopToolIds: ["needle"]
        }),
        "token-123"
      )
    );
    expect(screen.getByTestId("location-path")).toHaveTextContent("/workshops");
  });

  it("opens workshop details directly from the documented detail route", async () => {
    getWorkshops.mockResolvedValueOnce([
      {
        workshop: workshop({ id: "direct", name: "Direkte Werkstatt" }),
        slots: [slot({ workshopId: "direct" })],
        tools: []
      }
    ]);

    renderPage("/workshops/direct");

    expect(await screen.findByRole("dialog", { name: "Direkte Werkstatt" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "← Zurück" }));
    expect(screen.getByTestId("location-path")).toHaveTextContent("/workshops");
  });
});
