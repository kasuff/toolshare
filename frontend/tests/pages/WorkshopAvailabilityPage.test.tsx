import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { WorkshopAvailabilityPage } from "../../src/pages/WorkshopAvailabilityPage";

const { getWorkshops, createWorkshopTimeslot, updateWorkshopTimeslot, deleteWorkshopTimeslot } = vi.hoisted(() => ({
  getWorkshops: vi.fn(),
  createWorkshopTimeslot: vi.fn(),
  updateWorkshopTimeslot: vi.fn(),
  deleteWorkshopTimeslot: vi.fn()
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getWorkshops,
    createWorkshopTimeslot,
    updateWorkshopTimeslot,
    deleteWorkshopTimeslot
  }
}));

describe("WorkshopAvailabilityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login and empty states", () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <WorkshopAvailabilityPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByRole("link", { name: "Einloggen" })).toHaveAttribute("href", "/auth");
  });

  it("creates, updates, toggles and deletes timeslots for owned workshops", async () => {
    getWorkshops.mockResolvedValue([
      {
        workshop: {
          id: "w1",
          ownerId: "u1",
          name: "Maker Space",
          description: "Werkstatt",
          location: "Muenchen",
          maxCapacity: 4,
          extras: [],
          imageUrls: [],
          workshopTools: [],
          toolIds: []
        },
        slots: [
          {
            id: "s1",
            startIso: "2026-05-08T08:00",
            endIso: "2026-05-08T10:00",
            blockedByOwner: false
          }
        ]
      }
    ]);
    createWorkshopTimeslot.mockResolvedValue({ id: "s2" });
    updateWorkshopTimeslot.mockResolvedValue({
      id: "s1",
      startIso: "2026-05-08T09:00",
      endIso: "2026-05-08T11:00",
      blockedByOwner: true
    });
    deleteWorkshopTimeslot.mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <MemoryRouter>
          <WorkshopAvailabilityPage
            token="token-123"
            currentUser={{
              id: "u1",
              name: "Lea",
              email: "lea@example.com",
              role: "NUTZER",
              isSuspended: false
            }}
          />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Maker Space")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Startzeit"), { target: { value: "2026-06-01T10:00" } });
    fireEvent.change(screen.getByLabelText("Endzeit"), { target: { value: "2026-06-01T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Zeitfenster anlegen" }));

    await waitFor(() => expect(createWorkshopTimeslot).toHaveBeenCalledWith(
      "w1",
      { startIso: "2026-06-01T10:00", endIso: "2026-06-01T12:00", blockedByOwner: false },
      "token-123"
    ));

    fireEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));
    fireEvent.change(screen.getAllByLabelText("Startzeit")[1], { target: { value: "2026-05-08T09:00" } });
    fireEvent.change(screen.getAllByLabelText("Endzeit")[1], { target: { value: "2026-05-08T11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(updateWorkshopTimeslot).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Freigeben" }));
    await waitFor(() => expect(updateWorkshopTimeslot).toHaveBeenCalledWith(
      "w1",
      "s1",
      { blockedByOwner: false },
      "token-123"
    ));

    fireEvent.click(screen.getByRole("button", { name: "Entfernen" }));
    await waitFor(() => expect(deleteWorkshopTimeslot).toHaveBeenCalledWith("w1", "s1", "token-123"));
  });

});
