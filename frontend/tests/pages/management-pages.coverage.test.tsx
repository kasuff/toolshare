import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "../../src/pages/AdminPage";
import { ModerationPage } from "../../src/pages/ModerationPage";
import { NewToolPage } from "../../src/pages/NewToolPage";
import { NewWorkshopPage } from "../../src/pages/NewWorkshopPage";
import type { User } from "../../src/types/domain";

const {
  pushToast,
  getCurrentUser,
  createTool,
  validateAddress,
  listUsers,
  getMetrics,
  updateUserRole,
  updateUserSuspension,
  listReports,
  getRatingsReceived,
  updateReportStatus,
  createWorkshop
} = vi.hoisted(() => ({
  pushToast: vi.fn(),
  getCurrentUser: vi.fn(),
  createTool: vi.fn(),
  validateAddress: vi.fn(),
  listUsers: vi.fn(),
  getMetrics: vi.fn(),
  updateUserRole: vi.fn(),
  updateUserSuspension: vi.fn(),
  listReports: vi.fn(),
  getRatingsReceived: vi.fn(),
  updateReportStatus: vi.fn(),
  createWorkshop: vi.fn()
}));

vi.mock("../../src/hooks/useToast", () => ({
  useToast: () => ({
    pushToast
  })
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getCurrentUser,
    createTool,
    validateAddress,
    listUsers,
    getMetrics,
    updateUserRole,
    updateUserSuspension,
    listReports,
    getRatingsReceived,
    updateReportStatus,
    createWorkshop
  }
}));

class FileReaderMock {
  public onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsDataURL() {
    this.onload?.({
      target: {
        result: "data:image/png;base64,mock-file"
      }
    });
  }
}

const adminUser: User = {
  id: "u5",
  name: "Sabine",
  email: "sabine@toolshare.local",
  role: "ADMIN",
  isSuspended: false
};

const moderatorUser: User = {
  id: "u4",
  name: "Tobias",
  email: "tobias@toolshare.local",
  role: "MODERATOR",
  isSuspended: false
};

const suspendedUser: User = {
  id: "u2",
  name: "Murat",
  email: "murat@toolshare.local",
  role: "NUTZER",
  isSuspended: true
};

describe("management pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("FileReader", FileReaderMock as unknown as typeof FileReader);
  });

  it("guards admin access when no token is available", () => {
    render(
      <MemoryRouter>
        <AdminPage currentUser={adminUser} token={undefined} />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Einloggen" })).toHaveAttribute("href", "/auth");
  });

  it("loads, searches and updates admin users", async () => {
    getMetrics.mockResolvedValue({ users: 3, tools: 4, workshops: 2, openBookings: 1, openReports: 0 });
    listUsers.mockImplementation(async (_token, filters) => {
      if (filters?.search === "nichts") {
        return [];
      }
      return [moderatorUser, suspendedUser];
    });
    updateUserRole.mockResolvedValue(undefined);
    updateUserSuspension.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <AdminPage currentUser={adminUser} token="token-123" />
      </MemoryRouter>
    );

    expect(await screen.findByText("Nutzer: 3")).toBeInTheDocument();
    expect(screen.getByText("Murat")).toBeInTheDocument();
    expect(screen.getByText("Tobias")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nutzer suchen"), { target: { value: "nichts" } });
    fireEvent.click(screen.getByRole("button", { name: "Suchen" }));

    expect(await screen.findByText("Keine Nutzer gefunden")).toBeInTheDocument();
    expect(screen.getByText("Zu deiner Suche gibt es keine Treffer.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nutzer suchen"), { target: { value: "mur" } });
    fireEvent.click(screen.getByRole("button", { name: "Suchen" }));

    expect(await screen.findByText("Murat")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zurücksetzen" }));

    expect(await screen.findByText("Tobias")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Moderator entfernen" }));
    fireEvent.click(screen.getByRole("button", { name: "Entsperren" }));

    expect(updateUserRole).toHaveBeenCalledWith("u4", "NUTZER", "token-123");
    expect(updateUserSuspension).toHaveBeenCalledWith("u2", false, "token-123");
  });

  it("loads reports and ratings and resolves a moderation item", async () => {
    listReports.mockResolvedValueOnce([
      { id: "r1", reason: "Defekt", details: "Gehäuse gebrochen", status: "OPEN" }
    ]).mockResolvedValueOnce([
      { id: "r1", reason: "Defekt", details: "Gehäuse gebrochen", status: "RESOLVED" }
    ]);
    getRatingsReceived.mockResolvedValue([
      { id: "rt1", score: 5, comment: "Top", createdAt: "2026-05-05T10:00:00.000Z", fromUser: { name: "Lea" } }
    ]);
    updateReportStatus.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ModerationPage token="token-123" />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Gehäuse gebrochen/)).toBeInTheDocument();
    expect(screen.getByText(/Score 5/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Als bearbeitet markieren" }));

    await waitFor(() => {
      expect(updateReportStatus).toHaveBeenCalledWith("r1", "RESOLVED", "token-123");
    });
    expect(await screen.findByText(/Top/)).toBeInTheDocument();
  });

  it("requires login and submits a new tool with owner data", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      name: "Lea",
      email: "lea@toolshare.local",
      role: "NUTZER",
      isSuspended: false
    });
    validateAddress.mockResolvedValueOnce({
      isValid: true,
      normalizedAddress: "Musterstraße 5, 80331 München, Deutschland",
      normalizedParts: null
    });
    createTool.mockResolvedValueOnce({ id: "tool-1" });

    const { container } = render(
      <MemoryRouter initialEntries={["/tools/new"]}>
        <Routes>
          <Route path="/tools/new" element={<NewToolPage currentUser={undefined} token="token-123" />} />
          <Route path="/tools" element={<div>Tools Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Deine Kontaktdaten")).toBeInTheDocument();
    expect(screen.getByText("lea@toolshare.local")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "✓ Werkzeug einstellen" }));
    expect(await screen.findByText("Bitte gib einen Namen für das Werkzeug ein.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("z.B. Akku-Bohrmaschine 18V"), {
      target: { value: "Akkuschrauber" }
    });
    fireEvent.change(screen.getByPlaceholderText("z.B.: Zustand: wie neu, selten benutzt. Lieferumfang: 1x Bohrmaschine, 2x Akkus, Ladegerät. Besonderheiten: sehr leise, eingebaute LED"), {
      target: { value: "Sehr gut erhalten" }
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "holz" } });

    fireEvent.change(screen.getByPlaceholderText("Straße"), { target: { value: "Musterstraße" } });
    fireEvent.change(screen.getByPlaceholderText("Hausnummer"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("PLZ"), { target: { value: "80331" } });
    fireEvent.change(screen.getByPlaceholderText("Ort"), { target: { value: "München" } });
    fireEvent.change(screen.getByPlaceholderText("Land"), { target: { value: "Deutschland" } });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(["image"], "tool.png", { type: "image/png" })] }
    });

    fireEvent.click(screen.getByRole("button", { name: "✓ Werkzeug einstellen" }));

    await waitFor(() => {
      expect(createTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Akkuschrauber",
          description: "Sehr gut erhalten",
          category: "holz",
          pickupLocation: "Musterstraße 5, 80331 München, Deutschland",
          imageUrl: "data:image/png;base64,mock-file"
        }),
        "token-123"
      );
    });
    expect(await screen.findByText("Tools Home")).toBeInTheDocument();
  });

  it("builds a workshop payload from the step flow", async () => {
    createWorkshop.mockResolvedValueOnce({ id: "workshop-1" });

    const { container } = render(
      <MemoryRouter initialEntries={["/workshops/new"]}>
        <Routes>
          <Route path="/workshops/new" element={<NewWorkshopPage currentUser={adminUser} token="token-123" />} />
          <Route path="/workshops" element={<div>Workshops Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.submit(screen.getByRole("button", { name: "Schritt 1 von 3" }).closest("form")!);
    await waitFor(() => {
      expect(pushToast).toHaveBeenCalledWith("Bitte geben Sie einen Werkstatt-Namen ein.", "error");
    });

    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Maker Space" } });
    fireEvent.change(screen.getByPlaceholderText("Adresse oder Gebiet"), { target: { value: "Muenchen Nord" } });
    fireEvent.click(screen.getByRole("button", { name: "Personenzahl erhöhen" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "holz" } });
    fireEvent.change(screen.getByPlaceholderText("Werkzeugname (z.B. Bosch Akkuschrauber)"), {
      target: { value: "Bohrmaschine" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Werkzeug hinzufügen" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /WLAN/i }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(["photo"], "workshop.png", { type: "image/png" })] }
    });

    fireEvent.submit(screen.getByRole("button", { name: "Schritt 1 von 3" }).closest("form")!);
    expect(await screen.findByText("Verfügbarkeit & Zeitfenster")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Werkstatt veröffentlichen" }));
    expect(pushToast).toHaveBeenCalledWith("Bitte fügen Sie mindestens einen Zeitfenster hinzu.", "error");

    fireEvent.change(screen.getByLabelText("Startzeit"), { target: { value: "2026-07-01T09:00" } });
    fireEvent.change(screen.getByLabelText("Endzeit"), { target: { value: "2026-07-01T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Zeitfenster hinzufügen" }));
    fireEvent.click(screen.getByRole("button", { name: "Werkstatt veröffentlichen" }));

    await waitFor(() => {
      expect(createWorkshop).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Maker Space",
          location: "Muenchen Nord",
          maxCapacity: 3,
          extras: ["wlan"],
          equipmentItems: [{ name: "Bohrmaschine", category: "holz" }],
          imageUrls: ["data:image/png;base64,mock-file"],
          slots: [{ startIso: "2026-07-01T09:00", endIso: "2026-07-01T12:00", blockedByOwner: false }]
        }),
        "token-123"
      );
    });
    expect(await screen.findByText("Workshops Home")).toBeInTheDocument();
  });
});
