import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastViewport } from "../../src/components/ui";
import { ToastProvider } from "../../src/hooks/useToast";
import { InboxPage } from "../../src/pages/InboxPage";
import { INBOX_READ_CHANGED_EVENT, inboxReadSeedKey } from "../../src/utils/inboxMessageRead";

const { getBookingsForUser, decideBooking, createPickupProposal, createTimeslotProposal, createReport, createRating, getRatingsGiven, getRatingsReceived, getNotifications, markNotificationAsRead } = vi.hoisted(() => ({
  getBookingsForUser: vi.fn(),
  decideBooking: vi.fn(),
  createPickupProposal: vi.fn(),
  createTimeslotProposal: vi.fn(),
  createReport: vi.fn(),
  createRating: vi.fn(),
  getRatingsGiven: vi.fn().mockResolvedValue([]),
  getRatingsReceived: vi.fn().mockResolvedValue([]),
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationAsRead: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getBookingsForUser,
    decideBooking,
    createPickupProposal,
    createTimeslotProposal,
    createReport,
    createRating,
    getRatingsGiven,
    getRatingsReceived,
    getNotifications,
    markNotificationAsRead,
  },
}));

const currentUser = {
  id: "provider-1",
  name: "Lea",
  email: "lea@toolshare.local",
  role: "NUTZER" as const,
  isSuspended: false,
};

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

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
    vi.clearAllMocks();
    getRatingsGiven.mockResolvedValue([]);
    getRatingsReceived.mockResolvedValue([]);
    mockMatchMedia(false);
    getNotifications.mockResolvedValue([]);
    markNotificationAsRead.mockResolvedValue(undefined);
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

  it("sorts newest activity first and opens the chat requested by navigation", async () => {
    const newerBooking = {
      ...baseOpenBooking,
      id: "b2",
      toolId: "tool-2",
      toolName: "Neue Anfrage",
      createdIso: "2026-05-08T08:00:00.000Z",
      pickupProposals: [],
      timeslotProposals: []
    };
    const requestedBooking = {
      ...baseOpenBooking,
      id: "b1",
      toolName: "Gezielt geöffnete Anfrage",
      createdIso: "2026-05-05T08:00:00.000Z",
      pickupProposals: [],
      timeslotProposals: []
    };
    getBookingsForUser.mockResolvedValueOnce([requestedBooking, newerBooking]);

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={[{ pathname: "/inbox", state: { bookingId: "b1" } }]}>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    const threadList = await screen.findByLabelText("Konversationen");
    const threadButtons = within(threadList).getAllByRole("button");

    expect(threadButtons[0]).toHaveTextContent("Neue Anfrage");
    expect(threadButtons[1]).toHaveTextContent("Gezielt geöffnete Anfrage");
    expect(threadButtons[1]).toHaveAttribute("aria-current", "true");
    expect(document.querySelector(".messenger-chat-header-text strong")).toHaveTextContent(
      "Gezielt geöffnete Anfrage"
    );
  });

  it("shows only the thread list on small screens until a chat is opened", async () => {
    const user = userEvent.setup();
    mockMatchMedia(true);
    getBookingsForUser.mockResolvedValueOnce([{ ...baseOpenBooking, pickupProposals: [] }]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    const threadList = await screen.findByLabelText("Konversationen");
    expect(within(threadList).getByText("Test-Bohrer")).toBeInTheDocument();
    expect(screen.queryByText("Ausleihanfrage")).not.toBeInTheDocument();
    expect(document.querySelector(".messenger-shell")).not.toHaveClass("messenger-shell--chat-open");

    await user.click(within(threadList).getByRole("button", { name: /Test-Bohrer/i }));

    expect(document.querySelector(".messenger-shell")).toHaveClass("messenger-shell--chat-open");
    expect(screen.getByText("Ausleihanfrage")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nachrichten" })).not.toBeInTheDocument();
    expect(document.querySelector(".messenger-chat-header-text strong")).toHaveTextContent("Max Mustermann");
    expect(document.querySelector(".messenger-chat-header-sub")).toHaveTextContent("Ausleihe · Offen");
    expect(screen.queryByText("Offen", { selector: ".status-pill" })).not.toBeInTheDocument();
    const backButton = screen.getByRole("button", { name: "Zurück zur Chatliste" });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveFocus();
    expect(backButton.closest(".messenger-chat-header")).toBeTruthy();
    expect(backButton.closest(".inbox-messenger-title-row")).toBeNull();
  });

  it("returns to the thread list on small screens when back is pressed", async () => {
    const user = userEvent.setup();
    mockMatchMedia(true);
    const secondBooking = {
      ...baseOpenBooking,
      id: "b2",
      toolId: "tool-2",
      toolName: "Zweiter Chat",
      requesterName: "Anna Beispiel",
      createdIso: "2026-05-04T08:00:00.000Z",
      pickupProposals: [],
      timeslotProposals: []
    };
    getBookingsForUser.mockResolvedValueOnce([
      { ...baseOpenBooking, pickupProposals: [], timeslotProposals: [] },
      secondBooking
    ]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    const threadList = await screen.findByLabelText("Konversationen");
    const threadButton = within(threadList).getByRole("button", { name: /Test-Bohrer/i });
    await user.click(threadButton);
    expect(screen.getByText("Ausleihanfrage")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zurück zur Chatliste" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Zurück zur Chatliste" }));

    expect(screen.queryByText("Ausleihanfrage")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nachrichten" })).toBeInTheDocument();
    expect(document.querySelector(".messenger-shell")).not.toHaveClass("messenger-shell--chat-open");
    expect(within(threadList).getByText("Test-Bohrer")).toBeInTheDocument();
    expect(threadButton).toHaveFocus();

    await user.tab();
    const secondThread = within(threadList).getByRole("button", { name: /Zweiter Chat/i });
    expect(secondThread).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Zurück zur Chatliste" })).toHaveFocus();
    expect(secondThread).toHaveAttribute("aria-current", "true");
    expect(document.querySelector(".messenger-chat-header-text strong")).toHaveTextContent("Anna Beispiel");
  });

  it("keeps desktop focus on the selected thread", async () => {
    const user = userEvent.setup();
    const secondBooking = {
      ...baseOpenBooking,
      id: "b2",
      toolId: "tool-2",
      toolName: "Zweiter Chat",
      createdIso: "2026-05-06T08:00:00.000Z",
      pickupProposals: [],
      timeslotProposals: []
    };
    getBookingsForUser.mockResolvedValueOnce([
      { ...baseOpenBooking, pickupProposals: [], timeslotProposals: [] },
      secondBooking
    ]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    const threadList = await screen.findByLabelText("Konversationen");
    const secondThread = within(threadList).getByRole("button", { name: /Zweiter Chat/i });
    await user.click(secondThread);

    expect(secondThread).toHaveFocus();
    expect(secondThread).toHaveAttribute("aria-current", "true");
  });

  it("shows unread chats with a small count badge instead of a colored thread", async () => {
    localStorage.setItem(inboxReadSeedKey(currentUser.id), "1");
    getBookingsForUser.mockResolvedValueOnce([{ ...baseOpenBooking, pickupProposals: [] }]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    const threadList = await screen.findByLabelText("Konversationen");
    expect(within(threadList).getByLabelText("1 neue Nachricht")).toHaveTextContent("1");
  });

  it("removes the thread unread badge when the conversation is opened", async () => {
    localStorage.setItem(inboxReadSeedKey(currentUser.id), "1");
    const firstBooking = { ...baseOpenBooking, id: "b1", toolName: "Erster Chat", pickupProposals: [] };
    const secondBooking = {
      ...baseOpenBooking,
      id: "b2",
      toolId: "tool-2",
      toolName: "Zweiter Chat",
      createdIso: "2026-05-06T08:00:00.000Z",
      pickupProposals: [],
      timeslotProposals: []
    };
    const onReadChanged = vi.fn();
    window.addEventListener(INBOX_READ_CHANGED_EVENT, onReadChanged);
    getBookingsForUser.mockResolvedValueOnce([firstBooking, secondBooking]);

    try {
      render(
        <ToastProvider>
          <MemoryRouter>
            <InboxPage currentUser={currentUser} token="token-123" />
          </MemoryRouter>
        </ToastProvider>
      );

      const threadList = await screen.findByLabelText("Konversationen");
      const firstThread = within(threadList).getByRole("button", { name: /Erster Chat/ });
      expect(within(firstThread).getByLabelText("1 neue Nachricht")).toBeInTheDocument();

      fireEvent.click(firstThread);

      expect(within(firstThread).queryByLabelText("1 neue Nachricht")).not.toBeInTheDocument();
      expect(onReadChanged).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(INBOX_READ_CHANGED_EVENT, onReadChanged);
    }
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

    fireEvent.click(screen.getByRole("button", { name: "Nachricht als gelesen markieren" }));
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
              proposedReturnIso: "2026-05-07T14:00:00.000Z",
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

    await screen.findByRole("button", { name: /Test-Bohrer/, current: true }, { timeout: 5_000 });
    fireEvent.click(screen.getByRole("button", { name: "Alternativvorschlag senden" }));
    fireEvent.change(await screen.findByLabelText("Alternatives Abholdatum", {}, { timeout: 5_000 }), {
      target: { value: "2026-05-06" },
    });
    fireEvent.change(screen.getByLabelText("Alternative Abholzeit"), {
      target: { value: "12:00" },
    });
    fireEvent.change(screen.getByLabelText("Alternatives Rückgabedatum"), {
      target: { value: "2026-05-07" },
    });
    fireEvent.change(screen.getByLabelText("Alternative Rückgabezeit"), {
      target: { value: "14:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Alternativvorschlag senden" }));

    await waitFor(() => {
      expect(createPickupProposal).toHaveBeenCalledWith(
        "b1",
        new Date(2026, 4, 6, 12, 0).toISOString(),
        new Date(2026, 4, 7, 14, 0).toISOString(),
        "token-123"
      );
    });

    const proposalLabel = await screen.findByText("Alternativvorschlag · Warte auf Antwort");
    const proposalCard = proposalLabel.closest(".request-message-card");
    expect(proposalCard).toBeTruthy();
    expect(within(proposalCard!).getByText(/06\.05\.2026/)).toBeInTheDocument();
    expect(within(proposalCard!).getByText(/07\.05\.2026/)).toBeInTheDocument();
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
    getBookingsForUser.mockResolvedValueOnce([workshopBooking]).mockResolvedValueOnce([
      {
        ...workshopBooking,
        timeslotProposals: [
          {
            id: "tp-1",
            proposedById: "provider-1",
            proposedStartIso: "2026-05-08T09:30:00.000Z",
            proposedEndIso: "2026-05-08T13:15:00.000Z",
            status: "PENDING" as const,
            createdIso: "2026-05-05T09:00:00.000Z"
          }
        ]
      }
    ]);
    createTimeslotProposal.mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByRole("button", { name: /Maker Space/, current: true }, { timeout: 5_000 });
    fireEvent.click(screen.getByRole("button", { name: "Alternativvorschlag senden" }));
    fireEvent.change(await screen.findByLabelText("Alternativdatum für Werkstattvorschlag", {}, { timeout: 5_000 }), {
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

    const workshopProposalLabels = await screen.findAllByText("Alternativvorschlag · Warte auf Antwort");
    const workshopProposalCard = workshopProposalLabels.at(-1)?.closest(".request-message-card");
    expect(workshopProposalCard).toBeTruthy();
    const workshopProposalValues = workshopProposalCard!.querySelectorAll(".request-message-card-metadata strong");
    expect(workshopProposalValues).toHaveLength(2);
    expect(workshopProposalValues[0].textContent).not.toBe(workshopProposalValues[1].textContent);
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

  it("submits a rating from requester and shows it as chat message", async () => {
    const requesterUser = { ...currentUser, id: "requester-1", name: "Max Mustermann" };
    const completedBooking = {
      ...baseOpenBooking,
      status: "ABGESCHLOSSEN" as const,
      pickupProposals: [],
      timeslotProposals: []
    };
    getBookingsForUser.mockResolvedValue([completedBooking]);
    getRatingsGiven
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "rating-1",
          bookingId: "b1",
          fromUserId: requesterUser.id,
          toUserId: "provider-1",
          score: 4,
          comment: "Sehr gut",
          status: "SICHTBAR" as const,
          createdIso: "2026-05-08T10:00:00.000Z",
          fromUserName: requesterUser.name
        }
      ]);
    createRating.mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={requesterUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Bewertung abgeben" }));
    fireEvent.click(screen.getByRole("button", { name: "4 von 5 Sternen" }));
    fireEvent.change(screen.getByLabelText("Kommentar (optional)"), { target: { value: "Sehr gut" } });
    fireEvent.click(screen.getByRole("button", { name: "Bewertung speichern" }));

    await waitFor(() => {
      expect(createRating).toHaveBeenCalledWith(
        {
          bookingId: "b1",
          score: 4,
          comment: "Sehr gut"
        },
        "token-123"
      );
    });
    expect(await screen.findByText("4 von 5 Sternen")).toBeInTheDocument();
    expect(screen.getByText("Sehr gut")).toBeInTheDocument();
  });

  it("marks incoming rating message as unread until clicked", async () => {
    localStorage.setItem(inboxReadSeedKey(currentUser.id), "1");
    const completedBooking = {
      ...baseOpenBooking,
      status: "ABGESCHLOSSEN" as const,
      pickupProposals: [],
      timeslotProposals: []
    };
    getBookingsForUser.mockResolvedValueOnce([completedBooking]);
    getRatingsReceived.mockResolvedValueOnce([
      {
        id: "rating-2",
        bookingId: "b1",
        fromUserId: "requester-1",
        toUserId: currentUser.id,
        score: 5,
        comment: "Top!",
        status: "SICHTBAR" as const,
        createdIso: "2026-05-09T11:00:00.000Z",
        fromUserName: "Max Mustermann"
      }
    ]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    const ratingCard = (await screen.findByText("Bewertung")).closest(".request-message-card");
    expect(ratingCard).toHaveClass("request-message-card--unread");

    fireEvent.click(ratingCard!.querySelector("button")!);
    expect(ratingCard).not.toHaveClass("request-message-card--unread");
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
    expect(screen.getByText("Buchung abgeschlossen").closest(".request-message-card")).toBeInTheDocument();
  });

  it("shows the API error when completing a booking fails", async () => {
    getBookingsForUser.mockResolvedValueOnce([
      {
        ...baseOpenBooking,
        status: "BESTAETIGT" as const,
        pickupProposals: []
      }
    ]);
    decideBooking.mockRejectedValueOnce(new Error("Abschluss konnte nicht gespeichert werden."));

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
        <ToastViewport />
      </ToastProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Als abgeschlossen markieren" }));

    expect(await screen.findByText("Abschluss konnte nicht gespeichert werden.")).toBeInTheDocument();
    expect(getBookingsForUser).toHaveBeenCalledTimes(1);
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

  it("does not offer workshop completion before the confirmed usage period ended", async () => {
    getBookingsForUser.mockResolvedValueOnce([
      {
        ...baseOpenBooking,
        id: "future-workshop-booking",
        type: "WORKSHOP" as const,
        providerId: currentUser.id,
        workshopId: "workshop-1",
        toolId: undefined,
        toolName: "Holzwerkstatt",
        status: "BESTAETIGT" as const,
        endIso: new Date(Date.now() + 60_000).toISOString(),
        pickupTimeIso: undefined,
        pickupProposals: [],
        timeslotProposals: []
      }
    ]);

    render(
      <ToastProvider>
        <MemoryRouter>
          <InboxPage currentUser={currentUser} token="token-123" />
        </MemoryRouter>
      </ToastProvider>
    );

    expect((await screen.findAllByText(/Best.tigt/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Als abgeschlossen markieren" })).not.toBeInTheDocument();
  });
});
