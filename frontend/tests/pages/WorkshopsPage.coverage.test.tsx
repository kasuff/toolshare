import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { WorkshopsPage } from "../../src/pages/WorkshopsPage";
import type { User } from "../../src/types/domain";

const { getWorkshops, createWorkshopBooking } = vi.hoisted(() => ({
  getWorkshops: vi.fn(),
  createWorkshopBooking: vi.fn()
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getWorkshops,
    createWorkshopBooking
  }
}));

const currentUser: User = {
  id: "owner-1",
  name: "Lea",
  email: "lea@example.com",
  role: "NUTZER",
  isSuspended: false
};

describe("WorkshopsPage coverage", () => {
  it("opens a workshop, shows owner controls and books an available slot", async () => {
    getWorkshops.mockResolvedValueOnce([
      {
        workshop: {
          id: "w1",
          ownerId: "owner-1",
          name: "Maker Space",
          description: "Ausstattung: WLAN, Starkstrom",
          location: "Muenchen",
          maxCapacity: 4,
          extras: ["wlan", "starkstrom"],
          imageUrls: ["https://example.com/workshop.png"],
          equipmentItems: [{ id: "tool-1", name: "Bohrmaschine", category: "holz" }],
          workshopTools: [],
          toolIds: []
        },
        slots: [
          {
            id: "s1",
            startIso: "2026-05-08T08:00:00.000Z",
            endIso: "2026-05-08T10:00:00.000Z",
            blockedByOwner: false
          }
        ]
      }
    ]);
    createWorkshopBooking.mockResolvedValueOnce({ id: "b1" });

    render(
      <ToastProvider>
        <MemoryRouter>
          <WorkshopsPage token="token-123" currentUser={currentUser} />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Maker Space")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Maker Space/i }));
    expect(await screen.findByRole("dialog", { name: "Maker Space" })).toBeInTheDocument();
    expect(screen.getByText("Eigene Werkstatt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Verfügbarkeit verwalten" }));
    fireEvent.click(screen.getByRole("button", { name: "Werkstatt bearbeiten" }));

    const publicWorkshop = {
      workshop: {
        id: "w2",
        ownerId: "provider-2",
        name: "Holzwerkstatt",
        description: "Mit Säge",
        location: "Berlin",
        maxCapacity: 6,
        extras: [],
        imageUrls: ["https://example.com/workshop-2.png"],
        equipmentItems: [],
        workshopTools: [],
        toolIds: []
      },
      slots: [
        {
          id: "s2",
          startIso: "2026-06-01T08:00:00.000Z",
          endIso: "2026-06-01T10:00:00.000Z",
          blockedByOwner: false
        }
      ]
    };

    getWorkshops.mockResolvedValueOnce([publicWorkshop]);
    render(
      <ToastProvider>
        <MemoryRouter>
          <WorkshopsPage token="token-123" currentUser={currentUser} />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Holzwerkstatt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Holzwerkstatt/i }));
    fireEvent.click(screen.getByRole("button", { name: "Buchen" }));

    await waitFor(() => {
      expect(createWorkshopBooking).toHaveBeenCalledWith({ slotId: "s2" }, "token-123");
    });
  });
});
