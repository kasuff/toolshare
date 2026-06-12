import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  address: "München Zentrum",
  role: "NUTZER",
  isSuspended: false
};

function renderWorkshopsPage(user = currentUser) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/workshops"]}>
        <Routes>
          <Route path="/workshops" element={<WorkshopsPage token="token-123" currentUser={user} />} />
          <Route path="/workshops/:id" element={<WorkshopsPage token="token-123" currentUser={user} />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("WorkshopsPage coverage", () => {
  it("opens a workshop detail route and books an available public slot", async () => {
    getWorkshops.mockResolvedValueOnce([
      {
        workshop: {
          id: "w1",
          ownerId: "owner-1",
          ownerName: "Lea",
          name: "Maker Space",
          description: "Ausstattung: WLAN, Starkstrom",
          location: "München",
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
            workshopId: "w1",
            startIso: "2026-05-08T08:00:00.000Z",
            endIso: "2026-05-08T10:00:00.000Z",
            blockedByOwner: false
          }
        ]
      }
    ]);

    renderWorkshopsPage();

    expect(await screen.findByText("Maker Space")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Maker Space").closest("article")!);
    expect(await screen.findByRole("region", { name: "Maker Space" })).toBeInTheDocument();
    expect(screen.getByText("Eigene Werkstatt")).toBeInTheDocument();
    expect(screen.getByText("Bohrmaschine")).toBeInTheDocument();

    getWorkshops.mockResolvedValueOnce([
      {
        workshop: {
          id: "w2",
          ownerId: "provider-2",
          ownerName: "Konstantin",
          name: "Holzwerkstatt",
          description: "Mit Säge",
          location: "München",
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
            workshopId: "w2",
            startIso: "2026-06-01T08:00:00.000Z",
            endIso: "2026-06-01T10:00:00.000Z",
            blockedByOwner: false
          }
        ]
      }
    ]);
    createWorkshopBooking.mockResolvedValueOnce({ id: "b1" });

    renderWorkshopsPage();

    expect(await screen.findByText("Holzwerkstatt")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Holzwerkstatt").closest("article")!);
    fireEvent.click(await screen.findByRole("button", { name: "Anfrage senden" }));

    await waitFor(() => {
      expect(createWorkshopBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          workshopId: "w2",
          workshopToolIds: []
        }),
        "token-123"
      );
    });
  });
});
