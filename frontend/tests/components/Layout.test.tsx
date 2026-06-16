import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "../../src/components/Layout";
import type { User } from "../../src/types/domain";
import {
  INBOX_READ_CHANGED_EVENT,
  requestMessageKey,
  saveReadMessageIds
} from "../../src/utils/inboxMessageRead";

const { getBookingsForUser } = vi.hoisted(() => ({
  getBookingsForUser: vi.fn()
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getBookingsForUser
  }
}));

const users: User[] = [
  { id: "u1", name: "Lea", email: "lea@toolshare.local", role: "NUTZER", isSuspended: false },
  { id: "u2", name: "Tobias", email: "tobias@toolshare.local", role: "MODERATOR", isSuspended: false }
];

describe("Layout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("shows bell, nav actions and closes profile menu on outside click", async () => {
    const onSwitchUser = vi.fn();
    const onLogout = vi.fn();
    getBookingsForUser.mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            element={
              <Layout users={users} currentUser={users[0]} token="tok-1" onSwitchUser={onSwitchUser} onLogout={onLogout} />
            }
          >
            <Route index element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Werkzeuge" })).toHaveAttribute("href", "/tools");
    expect(screen.getByRole("link", { name: "Werkstätten" })).toHaveAttribute("href", "/workshops");
    expect(await screen.findByRole("link", { name: "Nachrichten und Benachrichtigungen" })).toHaveAttribute(
      "href",
      "/inbox"
    );

    fireEvent.click(screen.getByLabelText("Profil-Menü öffnen"));
    const offersLink = screen.getByRole("link", { name: "Meine Angebote" });
    const settingsLink = screen.getByRole("link", { name: "Einstellungen" });
    expect(offersLink).toHaveAttribute("href", "/offers");
    expect(offersLink.compareDocumentPosition(settingsLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Einstellungen")).toBeVisible();

    fireEvent.mouseDown(document.body);
    expect(screen.getByText("Einstellungen")).not.toBeVisible();

    expect(screen.getByRole("button", { name: "Ausloggen" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ausloggen" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("updates the bell unread count when an inbox thread is marked read", async () => {
    const onSwitchUser = vi.fn();
    const onLogout = vi.fn();
    const bookings = [
      {
        id: "b1",
        type: "TOOL" as const,
        requesterId: "requester-1",
        providerId: "u1",
        requesterName: "Max",
        providerName: "Lea",
        toolName: "Bohrer",
        startIso: "2026-05-06T10:00:00.000Z",
        endIso: "2026-05-07T10:00:00.000Z",
        status: "OFFEN" as const,
        createdIso: "2026-05-05T08:00:00.000Z",
        pickupProposals: [],
        timeslotProposals: []
      },
      {
        id: "b2",
        type: "TOOL" as const,
        requesterId: "requester-2",
        providerId: "u1",
        requesterName: "Anna",
        providerName: "Lea",
        toolName: "Säge",
        startIso: "2026-05-08T10:00:00.000Z",
        endIso: "2026-05-09T10:00:00.000Z",
        status: "OFFEN" as const,
        createdIso: "2026-05-08T08:00:00.000Z",
        pickupProposals: [],
        timeslotProposals: []
      }
    ];
    getBookingsForUser.mockResolvedValue(bookings);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            element={
              <Layout users={users} currentUser={users[0]} token="tok-1" onSwitchUser={onSwitchUser} onLogout={onLogout} />
            }
          >
            <Route index element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("link", { name: "Nachrichten und Benachrichtigungen, 2 ungelesene Konversationen" })
    ).toBeInTheDocument();

    saveReadMessageIds(users[0].id, new Set([requestMessageKey("b1")]));
    window.dispatchEvent(new Event(INBOX_READ_CHANGED_EVENT));

    expect(
      await screen.findByRole("link", { name: "Nachrichten und Benachrichtigungen, 1 ungelesene Konversationen" })
    ).toBeInTheDocument();
  });

  it("opens and closes the accessible mobile navigation", async () => {
    getBookingsForUser.mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            element={
              <Layout
                users={users.slice(0, 1)}
                currentUser={users[0]}
                token="tok-1"
                onSwitchUser={vi.fn()}
                onLogout={vi.fn()}
              />
            }
          >
            <Route index element={<div>Home</div>} />
            <Route path="tools" element={<div>Tools</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const toggle = screen.getByRole("button", { name: "Navigation öffnen" });
    expect(toggle).toHaveAttribute("aria-controls", "primary-navigation");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Navigation schließen" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation")).toHaveClass("nav-open");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Navigation öffnen" })).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Navigation öffnen" }));
    fireEvent.click(screen.getByRole("link", { name: "Werkzeuge" }));
    expect(await screen.findByText("Tools")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).not.toHaveClass("nav-open");
  });
});
