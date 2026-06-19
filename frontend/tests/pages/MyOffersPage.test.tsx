import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { MyOffersPage } from "../../src/pages/MyOffersPage";
import type { User } from "@toolshare/shared";

const { getTools, getWorkshops } = vi.hoisted(() => ({
  getTools: vi.fn(),
  getWorkshops: vi.fn()
}));

vi.mock("@toolshare/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@toolshare/shared")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getTools, getWorkshops
    }
  };
});

const currentUser: User = {
  id: "owner-1",
  name: "Lea",
  email: "lea@example.com",
  address: "München",
  role: "NUTZER",
  isSuspended: false
};

function renderPage(props: { token?: string; currentUser?: User } = { token: "token-123", currentUser }) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <MyOffersPage {...props} />
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("MyOffersPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lists only the signed-in user's offers with their statuses and detail links", async () => {
    getTools.mockResolvedValueOnce([
      {
        id: "tool-own",
        ownerId: "owner-1",
        ownerName: "Lea",
        name: "Eigener Akkuschrauber",
        description: "Mit zwei Akkus",
        category: "Elektro",
        imageUrl: "tool.png",
        pickupLocation: "München",
        status: "VERFUEGBAR"
      },
      {
        id: "tool-foreign",
        ownerId: "owner-2",
        name: "Fremder Hammer",
        description: "Soll nicht erscheinen",
        category: "Handwerkzeug",
        imageUrl: "",
        status: "AUSGELIEHEN"
      }
    ]);
    getWorkshops.mockResolvedValueOnce([
      {
        workshop: {
          id: "workshop-own",
          ownerId: "owner-1",
          ownerName: "Lea",
          name: "Eigene Werkstatt",
          description: "Voll ausgestattet",
          location: "München",
          maxCapacity: 4,
          extras: [],
          equipmentItems: [],
          imageUrls: ["workshop.png"],
          toolIds: []
        },
        slots: [
          {
            id: "slot-1",
            workshopId: "workshop-own",
            startIso: "2026-06-15T08:00:00.000Z",
            endIso: "2026-06-15T12:00:00.000Z",
            blockedByOwner: false
          }
        ],
        tools: []
      },
      {
        workshop: {
          id: "workshop-foreign",
          ownerId: "owner-2",
          name: "Fremde Werkstatt",
          description: "Soll nicht erscheinen",
          location: "Berlin",
          maxCapacity: 2,
          extras: [],
          equipmentItems: [],
          imageUrls: [],
          toolIds: []
        },
        slots: [],
        tools: []
      }
    ]);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Werkstätten" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Werkzeuge" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Eigene Werkstatt/i })).toHaveAttribute(
      "href",
      "/workshops/workshop-own?manage=1"
    );
    expect(screen.getByRole("link", { name: /Eigener Akkuschrauber/i })).toHaveAttribute(
      "href",
      "/tools/tool-own?manage=1"
    );
    expect(screen.getByText("1 Slot")).toBeInTheDocument();
    expect(screen.getByText("✓ Verfügbar")).toBeInTheDocument();
    expect(screen.queryByText("Fremder Hammer")).not.toBeInTheDocument();
    expect(screen.queryByText("Fremde Werkstatt")).not.toBeInTheDocument();
    expect(getTools).toHaveBeenCalledWith({ ownerId: "owner-1" }, "token-123");
    expect(getWorkshops).toHaveBeenCalledWith({ managerId: "owner-1" }, "token-123");
  });

  it("shows the documented empty state when the user has no offers", async () => {
    getTools.mockResolvedValueOnce([]);
    getWorkshops.mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Keine Angebote vorhanden" })).toBeInTheDocument();
    expect(screen.getByText("Du hast noch keine Werkzeuge oder Werkstätten angeboten.")).toBeInTheDocument();
  });

  it("shows a partial empty state and unavailable status when only tools exist", async () => {
    getTools.mockResolvedValueOnce([
      {
        id: "tool-own",
        ownerId: "owner-1",
        name: "Bohrmaschine",
        description: "Kräftig",
        category: "Elektro",
        imageUrl: "",
        status: "AUSGELIEHEN"
      }
    ]);
    getWorkshops.mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText("Du hast noch keine Werkstatt angeboten.")).toBeInTheDocument();
    expect(screen.getByText("✕ Nicht verfügbar")).toBeInTheDocument();
  });

  it("prompts for login without loading data when rendered without a session", () => {
    renderPage({});

    expect(screen.getByRole("heading", { name: "Bitte anmelden" })).toBeInTheDocument();
    expect(getTools).not.toHaveBeenCalled();
    expect(getWorkshops).not.toHaveBeenCalled();
  });

  it("shows a recoverable error state when loading fails", async () => {
    getTools.mockRejectedValueOnce(new Error("Netzwerkfehler"));
    getWorkshops.mockResolvedValueOnce([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Angebote konnten nicht geladen werden" })).toBeInTheDocument();
    });
    expect(screen.getByText("Bitte versuche es später erneut.")).toBeInTheDocument();
  });
});
