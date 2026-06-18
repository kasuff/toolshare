import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { WorkshopsPage } from "../../src/pages/WorkshopsPage";
import { ToastViewport } from "../../src/components/ui";
import { DEFAULT_PLACEHOLDER_IMAGE } from "../../src/utils/categories";
import type { Tool, Workshop, WorkshopSlot } from "../../src/types/domain";

const { createWorkshopBooking, createWorkshopTimeslot, deleteWorkshop, getWorkshopById, getWorkshops, getRatingsForWorkshop } = vi.hoisted(() => ({
  createWorkshopBooking: vi.fn(),
  createWorkshopTimeslot: vi.fn(),
  deleteWorkshop: vi.fn(),
  getWorkshopById: vi.fn(),
  getWorkshops: vi.fn(),
  getRatingsForWorkshop: vi.fn().mockResolvedValue([])
}));

vi.mock("../../src/services/api", () => ({
  api: {
    createWorkshopBooking,
    createWorkshopTimeslot,
    deleteWorkshop,
    getWorkshopById,
    getWorkshops,
    getRatingsForWorkshop,
    getSystemSettings: vi.fn().mockResolvedValue([])
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
      <ToastViewport />
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
  it("shows the guest login notice at the top of the workshop search page", async () => {
    getWorkshops.mockResolvedValueOnce([]);

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/workshops"]}>
          <Routes>
            <Route path="/workshops" element={<WorkshopsPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    const guestBanner = screen.getByRole("complementary");
    expect(screen.getByRole("heading", { name: "Bitte anmelden" })).toBeInTheDocument();
    expect(screen.queryByText("Easy verleihen. Schnell Nachbarn helfen.")).not.toBeInTheDocument();
    expect(guestBanner.closest(".search-page")?.firstElementChild).toBe(guestBanner);
    await waitFor(() => expect(getWorkshops).toHaveBeenCalled());
  });

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
    createWorkshopBooking.mockResolvedValueOnce({ id: "booking-new" });
    getWorkshops.mockResolvedValueOnce([
      {
        workshop: workshop({
          id: "available",
          name: "Nähstube",
          description: "Ausstattung: sewing, light",
          extras: ["sewing"],
          ownerName: "Nina Nadel",
          imageUrls: ["https://example.com/workshop-1.jpg", "https://example.com/workshop-2.jpg"]
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
    expect(within(blockedCard).getByText("0 Slots")).toHaveClass("unavailable");

    fireEvent.click(screen.getByText("Nähstube").closest("article")!);

    expect(await screen.findByRole("region", { name: "Nähstube" })).toBeInTheDocument();
    expect(screen.getByTestId("location-path")).toHaveTextContent("/workshops/available");
    expect(screen.getByText("Leopoldstraße 120, München")).toBeInTheDocument();
    expect(screen.getAllByText("Nähmaschine").length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: "Nähstube vergrößern" }));
    const imageViewer = screen.getByRole("dialog", { name: "Bilder von Nähstube" });
    expect(within(imageViewer).getByRole("img")).toHaveAttribute("src", "https://example.com/workshop-1.jpg");
    fireEvent.click(within(imageViewer).getByRole("button", { name: "Nächstes Bild" }));
    expect(within(imageViewer).getByRole("img")).toHaveAttribute("src", "https://example.com/workshop-2.jpg");
    fireEvent.click(within(imageViewer).getByRole("button", { name: "Bildansicht schließen" }));
    expect(screen.queryByRole("dialog", { name: "Bilder von Nähstube" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Anfrage senden" }));
    await waitFor(() =>
      expect(createWorkshopBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          workshopId: "available",
          workshopToolIds: ["needle"]
        }),
        "token-123"
      )
    );
    expect(screen.getByTestId("location-path")).toHaveTextContent("/inbox");
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

    expect(await screen.findByRole("region", { name: "Direkte Werkstatt" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    expect(screen.getByTestId("location-path")).toHaveTextContent("/workshops");
  });

  it("shows a notice instead of opening the default workshop image", async () => {
    getWorkshops.mockResolvedValueOnce([
      {
        workshop: workshop({
          id: "without-image",
          name: "Werkstatt ohne Bilder",
          imageUrls: [DEFAULT_PLACEHOLDER_IMAGE]
        }),
        slots: [slot({ workshopId: "without-image" })],
        tools: []
      }
    ]);

    renderPage("/workshops/without-image");

    fireEvent.click(await screen.findByRole("button", { name: "Keine Bilder vorhanden" }));

    expect(await screen.findByText("Keine Bilder vorhanden.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Bilder von/i })).not.toBeInTheDocument();
  });

  it("shows owner blocking everywhere but management actions only in manage mode", async () => {
    getWorkshops.mockResolvedValue([
      {
        workshop: workshop({ id: "own", ownerId: "requester-1", name: "Eigene Werkstatt" }),
        slots: [
          slot({
            id: "slot-own",
            workshopId: "own",
            startIso: "2026-07-01T00:00:00.000Z",
            endIso: "2026-08-01T00:00:00.000Z"
          })
        ],
        tools: []
      }
    ]);
    createWorkshopTimeslot.mockResolvedValueOnce(
      slot({ id: "blocked-own", workshopId: "own", blockedByOwner: true })
    );
    getWorkshopById.mockResolvedValueOnce({
      workshop: workshop({ id: "own", ownerId: "requester-1", name: "Eigene Werkstatt" }),
      slots: [
        slot({
          id: "slot-before",
          workshopId: "own",
          startIso: "2026-07-01T00:00:00.000Z",
          endIso: "2026-07-08T09:00:00.000Z"
        }),
        slot({
          id: "blocked-own",
          workshopId: "own",
          startIso: "2026-07-08T09:00:00.000Z",
          endIso: "2026-07-08T12:00:00.000Z",
          blockedByOwner: true
        }),
        slot({
          id: "slot-after",
          workshopId: "own",
          startIso: "2026-07-08T12:00:00.000Z",
          endIso: "2026-08-01T00:00:00.000Z"
        })
      ],
      tools: []
    });
    deleteWorkshop.mockResolvedValueOnce(undefined);

    const { unmount } = renderPage("/workshops/own");
    expect(await screen.findByText("Werkstatt für Eigenbedarf blockieren")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Werkstatt bearbeiten" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Startdatum Eigenbedarf"), { target: { value: "2026-07-08" } });
    fireEvent.change(screen.getByLabelText("Startzeit Eigenbedarf"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText("Enddatum Eigenbedarf"), { target: { value: "2026-07-08" } });
    fireEvent.change(screen.getByLabelText("Endzeit Eigenbedarf"), { target: { value: "12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Zeitraum blockieren" }));
    await waitFor(() =>
      expect(createWorkshopTimeslot).toHaveBeenCalledWith(
        "own",
        {
          startIso: expect.any(String),
          endIso: expect.any(String),
          blockedByOwner: true
        },
        "token-123"
      )
    );
    const julyCalendar = screen.getByLabelText(/Verf.gbare Tage im Juli 2026/i);
    expect(within(julyCalendar).getByRole("button", { name: "7" })).toBeEnabled();
    expect(within(julyCalendar).getByRole("button", { name: "8" })).toBeDisabled();
    unmount();

    renderPage("/workshops/own?manage=1");
    expect(await screen.findByRole("link", { name: "Werkstatt bearbeiten" })).toHaveAttribute(
      "href",
      "/workshops/own/edit"
    );
    fireEvent.click(screen.getByRole("button", { name: "Werkstatt löschen" }));
    expect(screen.getByRole("dialog", { name: "Werkstatt endgültig löschen?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Werkstatt endgültig löschen" }));
    await waitFor(() => expect(deleteWorkshop).toHaveBeenCalledWith("own", "token-123"));
  });
});
