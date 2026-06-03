import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { InboxPage } from "../../src/pages/InboxPage";
import { inboxReadSeedKey } from "../../src/utils/inboxMessageRead";

const { getBookingsForUser, decideBooking, createPickupProposal } = vi.hoisted(() => ({
  getBookingsForUser: vi.fn(),
  decideBooking: vi.fn(),
  createPickupProposal: vi.fn(),
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getBookingsForUser,
    decideBooking,
    createPickupProposal,
  },
}));

const currentUser = {
  id: "provider-1",
  name: "Lea",
  email: "lea@toolshare.local",
  role: "NUTZER" as const,
  isSuspended: false,
};

const baseOpenBooking = {
  id: "b1",
  type: "TOOL" as const,
  requesterId: "requester-1",
  providerId: "provider-1",
  toolId: "tool-1",
  requesterName: "Max Mustermann",
  providerName: "Lea",
  toolName: "Test-Bohrer",
  startIso: "2026-05-06T10:00:00.000Z",
  endIso: "2026-05-07T10:00:00.000Z",
  pickupTimeIso: "2026-05-06T09:00:00.000Z",
  status: "OFFEN" as const,
  createdIso: "2026-05-05T08:00:00.000Z",
};

describe("InboxPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows messenger thread list with counterpart name, preview and actions inside request bubble", async () => {
    getBookingsForUser.mockResolvedValueOnce([{ ...baseOpenBooking, pickupProposals: [] }]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByRole("heading", { name: "Nachrichten" })).toBeInTheDocument();
    const threadList = screen.getByLabelText("Konversationen");
    expect(within(threadList).getByText("Max Mustermann")).toBeInTheDocument();
    expect(within(threadList).getByText("Test-Bohrer")).toBeInTheDocument();
    expect(within(threadList).getByText(/möchte „Test-Bohrer“ ausleihen/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Akzeptieren" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ablehnen" })).toBeInTheDocument();
  });

  it("marks incoming request bubble unread until clicked", async () => {
    localStorage.setItem(inboxReadSeedKey(currentUser.id), "1");
    getBookingsForUser.mockResolvedValueOnce([{ ...baseOpenBooking, pickupProposals: [] }]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByRole("heading", { name: "Nachrichten" });
    const zeitraum = screen.getByText(/Zeitraum:/);
    const bubble = zeitraum.closest(".chat-bubble");
    expect(bubble).toBeTruthy();
    expect(bubble).toHaveClass("chat-bubble--unread");

    fireEvent.click(bubble!);
    expect(bubble).not.toHaveClass("chat-bubble--unread");
  });

  it("strikes original request lines after a counter proposal is sent via API", async () => {
    getBookingsForUser
      .mockResolvedValueOnce([{ ...baseOpenBooking, pickupProposals: [] }])
      .mockResolvedValueOnce([
        {
          ...baseOpenBooking,
          pickupProposals: [
            {
              id: "pp-1",
              proposedById: "provider-1",
              proposedPickupIso: "2026-05-06T12:00:00.000Z",
              previousPickupIso: "2026-05-06T09:00:00.000Z",
              status: "PENDING" as const,
              createdIso: "2026-05-05T09:00:00.000Z",
            },
          ],
        },
      ]);
    createPickupProposal.mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByRole("heading", { name: "Nachrichten" });
    fireEvent.change(screen.getByLabelText("Alternativdatum für Gegenvorschlag"), {
      target: { value: "2026-05-06" },
    });
    fireEvent.change(screen.getByLabelText("Alternativuhrzeit für Gegenvorschlag"), {
      target: { value: "12:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Senden" }));

    await waitFor(() => {
      expect(createPickupProposal).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Alternativvorschlag: Abholung/)).toBeInTheDocument();
    expect(screen.getByText(/Zeitraum:/)).toHaveClass("is-struck");
  });

  it("lets the provider complete a confirmed tool booking and shows the completed status after reload", async () => {
    getBookingsForUser
      .mockResolvedValueOnce([
        {
          ...baseOpenBooking,
          status: "BESTAETIGT" as const,
          pickupProposals: []
        }
      ])
      .mockResolvedValueOnce([
        {
          ...baseOpenBooking,
          status: "ABGESCHLOSSEN" as const,
          pickupProposals: []
        }
      ]);
    decideBooking.mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    expect((await screen.findAllByText(/Best.tigt/)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Als abgeschlossen markieren" }));

    await waitFor(() => {
      expect(decideBooking).toHaveBeenCalledWith("b1", "ABGESCHLOSSEN", "token-123");
    });
    expect((await screen.findAllByText("Abgeschlossen")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Status:/).closest(".request-bubble-card")).toHaveTextContent("Abgeschlossen");
  });

  it("lets the workshop provider complete a confirmed workshop booking", async () => {
    getBookingsForUser
      .mockResolvedValueOnce([
        {
          ...baseOpenBooking,
          id: "w-booking-1",
          type: "WORKSHOP" as const,
          requesterId: "requester-1",
          providerId: "provider-1",
          workshopId: "workshop-1",
          toolId: undefined,
          toolName: "Holzwerkstatt",
          status: "BESTAETIGT" as const,
          pickupTimeIso: undefined,
          pickupProposals: []
        }
      ])
      .mockResolvedValueOnce([
        {
          ...baseOpenBooking,
          id: "w-booking-1",
          type: "WORKSHOP" as const,
          requesterId: "requester-1",
          providerId: "provider-1",
          workshopId: "workshop-1",
          toolId: undefined,
          toolName: "Holzwerkstatt",
          status: "ABGESCHLOSSEN" as const,
          pickupTimeIso: undefined,
          pickupProposals: []
        }
      ]);
    decideBooking.mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    expect((await screen.findAllByText(/Best.tigt/)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Als abgeschlossen markieren" }));

    await waitFor(() => {
      expect(decideBooking).toHaveBeenCalledWith("w-booking-1", "ABGESCHLOSSEN", "token-123");
    });
    expect((await screen.findAllByText("Abgeschlossen")).length).toBeGreaterThan(0);
  });

  it("shows confirmed workshop bookings to requesters without provider-only completion action", async () => {
    getBookingsForUser.mockResolvedValueOnce([
      {
        ...baseOpenBooking,
        id: "w-booking-1",
        type: "WORKSHOP" as const,
        requesterId: "requester-1",
        providerId: "provider-1",
        workshopId: "workshop-1",
        toolId: undefined,
        toolName: "Holzwerkstatt",
        status: "BESTAETIGT" as const,
        pickupTimeIso: undefined,
        pickupProposals: []
      }
    ]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={{ ...currentUser, id: "requester-1" }} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    expect((await screen.findAllByText(/Best.tigt/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Als abgeschlossen markieren" })).not.toBeInTheDocument();
  });
});
