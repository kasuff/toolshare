import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { InboxPage } from "../../src/pages/InboxPage";
import { inboxReadSeedKey } from "../../src/utils/inboxMessageRead";

const { getBookingsForUser, decideBooking, createPickupProposal, createTimeslotProposal, createReport } = vi.hoisted(() => ({
  getBookingsForUser: vi.fn(),
  decideBooking: vi.fn(),
  createPickupProposal: vi.fn(),
  createTimeslotProposal: vi.fn(),
  createReport: vi.fn(),
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getBookingsForUser,
    decideBooking,
    createPickupProposal,
    createTimeslotProposal,
    createReport,
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
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("shows messenger thread list, storybook request card and footer actions", async () => {
    getBookingsForUser.mockResolvedValueOnce([{ ...baseOpenBooking, pickupProposals: [] }]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByRole("heading", { name: "Nachrichten" })).toBeInTheDocument();
    expect(screen.queryByText(/Benachrichtigungen/)).not.toBeInTheDocument();
    const threadList = screen.getByLabelText("Konversationen");
    expect(within(threadList).getByText("Max Mustermann")).toBeInTheDocument();
    expect(within(threadList).getByText("Test-Bohrer")).toBeInTheDocument();
    expect(within(threadList).getByText(/möchte „Test-Bohrer“ ausleihen/)).toBeInTheDocument();
    expect(within(threadList).getByText("Test-Bohrer")).toHaveClass("messenger-thread-name");
    expect(within(threadList).getByText("Max Mustermann")).toHaveClass("messenger-thread-sub");
    expect(within(threadList).getByRole("button")).toHaveAttribute("aria-current", "true");
    expect(
      within(threadList).getByText("Max Mustermann").compareDocumentPosition(within(threadList).getByText("Test-Bohrer")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(document.querySelector(".messenger-chat-header .msg-avatar")).toHaveTextContent("MM");
    expect(screen.getByText("Ausleihanfrage")).toBeInTheDocument();
    expect(screen.getByText("Abholung")).toBeInTheDocument();
    expect(screen.getByText("Rückgabe")).toBeInTheDocument();
    expect(screen.getByText("construction")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Akzeptieren" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alternativvorschlag senden" })).toBeInTheDocument();
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
    const card = screen.getByText("Ausleihanfrage").closest(".request-message-card");
    expect(card).toBeTruthy();
    expect(card).toHaveClass("request-message-card--unread");

    fireEvent.click(card!);
    expect(card).not.toHaveClass("request-message-card--unread");
  });

  it("opens a conversation scrolled to its newest message", async () => {
    getBookingsForUser.mockResolvedValueOnce([{ ...baseOpenBooking, pickupProposals: [] }]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByRole("heading", { name: "Nachrichten" });
    const chat = document.querySelector(".messenger-chat-scroll") as HTMLDivElement;
    Object.defineProperty(chat, "scrollHeight", { configurable: true, value: 900 });

    fireEvent.click(screen.getByRole("button", { name: "Alternativvorschlag senden" }));

    expect(chat.scrollTop).toBe(900);
  });

  it("opens the counter form and displays the sent proposal as a chat card", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Alternativvorschlag senden" }));
    fireEvent.change(screen.getByLabelText("Alternativdatum für Gegenvorschlag"), {
      target: { value: "2026-05-06" },
    });
    fireEvent.change(screen.getByLabelText("Alternativuhrzeit für Gegenvorschlag"), {
      target: { value: "12:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Alternativvorschlag senden" }));

    await waitFor(() => {
      expect(createPickupProposal).toHaveBeenCalled();
    });

    expect(await screen.findByText("Alternativvorschlag · Warte auf Antwort")).toBeInTheDocument();
  });

  it("sends workshop counter proposals with explicit start and end date times", async () => {
    const workshopBooking = {
      ...baseOpenBooking,
      id: "w1",
      type: "WORKSHOP" as const,
      toolId: undefined,
      workshopId: "workshop-1",
      toolName: "Maker Space",
      startIso: "2026-05-06T08:00:00.000Z",
      endIso: "2026-05-06T12:00:00.000Z",
      pickupTimeIso: undefined,
      pickupProposals: [],
      timeslotProposals: []
    };
    getBookingsForUser.mockResolvedValueOnce([workshopBooking]).mockResolvedValueOnce([workshopBooking]);
    createTimeslotProposal.mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Alternativvorschlag senden" }));
    fireEvent.change(screen.getByLabelText("Alternativdatum für Werkstattvorschlag"), {
      target: { value: "2026-05-08" }
    });
    fireEvent.change(screen.getByLabelText("Alternativuhrzeit für Werkstattvorschlag"), {
      target: { value: "09:30" }
    });
    fireEvent.change(screen.getByLabelText("Alternativ-Enddatum für Werkstattvorschlag"), {
      target: { value: "2026-05-08" }
    });
    fireEvent.change(screen.getByLabelText("Alternativ-Enduhrzeit für Werkstattvorschlag"), {
      target: { value: "13:15" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Alternativvorschlag senden" }));

    await waitFor(() =>
      expect(createTimeslotProposal).toHaveBeenCalledWith(
        "w1",
        new Date(2026, 4, 8, 9, 30).toISOString(),
        new Date(2026, 4, 8, 13, 15).toISOString(),
        "token-123"
      )
    );
  });

  it("shows an accepted message card after the provider accepts", async () => {
    getBookingsForUser
      .mockResolvedValueOnce([{ ...baseOpenBooking, pickupProposals: [] }])
      .mockResolvedValueOnce([{ ...baseOpenBooking, status: "BESTAETIGT", pickupProposals: [] }]);
    decideBooking.mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Akzeptieren" }));

    expect(await screen.findByText("Anfrage angenommen")).toBeInTheDocument();
    expect(screen.getByText("check")).toBeInTheDocument();
    expect(decideBooking).toHaveBeenCalledWith("b1", "BESTAETIGT", "token-123");
  });

  it("shows a declined message card after the provider rejects", async () => {
    getBookingsForUser
      .mockResolvedValueOnce([{ ...baseOpenBooking, pickupProposals: [] }])
      .mockResolvedValueOnce([{ ...baseOpenBooking, status: "ABGELEHNT", pickupProposals: [] }]);
    decideBooking.mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Ablehnen" }));

    expect(await screen.findByText("Anfrage abgelehnt")).toBeInTheDocument();
    expect(screen.getByText("close")).toBeInTheDocument();
    expect(decideBooking).toHaveBeenCalledWith("b1", "ABGELEHNT", "token-123");
  });
});
