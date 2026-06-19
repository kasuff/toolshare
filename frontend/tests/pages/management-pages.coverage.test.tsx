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
  listClosedReports,
  updateReportStatus,
  listSuspensionRequests,
  decideSuspensionRequest,
  createWorkshop,
  getSystemSettings,
  updateSystemSetting
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
  listClosedReports: vi.fn(),
  updateReportStatus: vi.fn(),
  listSuspensionRequests: vi.fn(),
  decideSuspensionRequest: vi.fn(),
  createWorkshop: vi.fn(),
  getSystemSettings: vi.fn(),
  updateSystemSetting: vi.fn()
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
    listClosedReports,
    updateReportStatus,
    listSuspensionRequests,
    decideSuspensionRequest,
    createWorkshop,
    getSystemSettings,
    updateSystemSetting
  }
}));

const { getMonitoringOverview, getMonitoringLogs } = vi.hoisted(() => ({
  getMonitoringOverview: vi.fn(),
  getMonitoringLogs: vi.fn()
}));

vi.mock("../../src/services/monitoringApi", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/monitoringApi")>(
    "../../src/services/monitoringApi"
  );
  return {
    ...actual,
    monitoringApi: {
      getOverview: getMonitoringOverview,
      getLogs: getMonitoringLogs,
      downloadExport: vi.fn()
    }
  };
});

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
    getSystemSettings.mockResolvedValue([]);
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
    getMetrics.mockResolvedValue({
      users: 3,
      tools: 4,
      workshops: 2,
      openBookings: 1,
      openReports: 0,
      openSuspensionRequests: 1
    });
    listSuspensionRequests.mockResolvedValue([
      {
        id: "sr1",
        userId: "u2",
        requestedById: "u4",
        reportId: "r9",
        reason: "Wiederholte Verstoesse",
        status: "PENDING",
        createdAt: "2026-05-05T11:00:00.000Z",
        user: { id: "u2", name: "Murat", email: "murat@toolshare.local", isSuspended: false },
        requestedBy: { id: "u4", name: "Tobias" },
        report: { id: "r9", reason: "Beleidigung", targetType: "USER", targetId: "u2" }
      }
    ]);
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
    expect(screen.getByText(/Wiederholte Verstoesse/)).toBeInTheDocument();
    expect(screen.getAllByText("Murat").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tobias").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Nutzer suchen"), { target: { value: "nichts" } });
    fireEvent.click(screen.getByRole("button", { name: "Suchen" }));

    expect(await screen.findByText("Keine Nutzer gefunden")).toBeInTheDocument();
    expect(screen.getByText("Zu deiner Suche gibt es keine Treffer.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nutzer suchen"), { target: { value: "mur" } });
    fireEvent.click(screen.getByRole("button", { name: "Suchen" }));

    decideSuspensionRequest.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Sperrung annehmen" }));
    await waitFor(() => {
      expect(decideSuspensionRequest).toHaveBeenCalledWith("sr1", { approve: true }, "token-123");
    });
    fireEvent.click(screen.getByRole("button", { name: "Ablehnen" }));
    await waitFor(() => {
      expect(decideSuspensionRequest).toHaveBeenCalledWith("sr1", { approve: false }, "token-123");
    });
    fireEvent.click(screen.getByRole("button", { name: "Zurücksetzen" }));

    expect(await screen.findByText("Tobias")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Moderator entfernen" }));
    fireEvent.click(screen.getByRole("button", { name: "Entsperren" }));

    expect(updateUserRole).toHaveBeenCalledWith("u4", "NUTZER", "token-123");
    expect(updateUserSuspension).toHaveBeenCalledWith("u2", false, "token-123");
  });

  it("loads reports and rejects a moderation item", async () => {
    listClosedReports.mockResolvedValue([]);
    listReports.mockResolvedValueOnce([
      {
        id: "r1",
        reporterId: "u3",
        reporterName: "Lea",
        targetType: "USER",
        targetId: "u2",
        targetLabel: "Murat",
        targetHref: null,
        subjectUserId: "u2",
        subjectUserName: "Murat",
        reason: "Defekt",
        details: "Gehäuse gebrochen",
        status: "OPEN",
        createdAt: "2026-05-05T10:00:00.000Z"
      }
    ]).mockResolvedValueOnce([]);
    updateReportStatus.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ModerationPage token="token-123" />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Gehäuse gebrochen/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Begründung beim Verwerfen/), {
      target: { value: "Kein Verstoss erkennbar" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));

    await waitFor(() => {
      expect(updateReportStatus).toHaveBeenCalledWith(
        "r1",
        {
          status: "REJECTED",
          decisionNote: "Kein Verstoss erkennbar"
        },
        "token-123"
      );
    });
    expect(await screen.findByText("Keine offenen Meldungen")).toBeInTheDocument();
  });

  it("renders rating preview for RATING reports", async () => {
    listReports.mockResolvedValueOnce([
      {
        id: "r-rating",
        reporterId: "u3",
        reporterName: "Lea",
        targetType: "RATING",
        targetId: "rating-1",
        targetLabel: "Bewertung von Anna",
        targetHref: null,
        subjectUserId: "u2",
        subjectUserName: "Max",
        reason: "Beleidigend",
        details: "Unangemessener Kommentar",
        status: "OPEN",
        createdAt: "2026-05-05T10:00:00.000Z",
        ratingPreview: {
          score: 2,
          comment: "Schlechter Service",
          fromUserName: "Anna",
          listingLabel: "Bohrer"
        }
      }
    ]);
    listClosedReports.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <ModerationPage token="token-123" />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Bewertung:/)).toBeInTheDocument();
    const preview = screen.getByText(/Bei Bestätigung wird die Bewertung ausgeblendet/).closest(".moderation-rating-preview");
    expect(preview).not.toBeNull();
    expect(preview).toHaveTextContent("Anna");
    expect(preview).toHaveTextContent("2 von 5 Sternen");
    expect(preview).toHaveTextContent("Bohrer");
    expect(preview).toHaveTextContent("„Schlechter Service“");
  });

  it("renders closed reports with limit selection", async () => {
    listReports.mockResolvedValue([]);
    listClosedReports.mockResolvedValue([
      {
        id: "rc1",
        reporterId: "u3",
        reporterName: "Lea",
        targetType: "USER",
        targetId: "u2",
        targetLabel: "Murat",
        targetHref: null,
        subjectUserId: "u2",
        subjectUserName: "Murat",
        reason: "Defekt",
        details: "Double",
        status: "RESOLVED",
        createdAt: "2026-05-05T10:00:00.000Z",
        decisionNote: "Entscheidung 1",
        decisionAt: "2026-05-05T11:00:00.000Z"
      },
      {
        id: "rc2",
        reporterId: "u3",
        reporterName: "Lea",
        targetType: "USER",
        targetId: "u2",
        targetLabel: "Murat",
        targetHref: null,
        subjectUserId: "u2",
        subjectUserName: "Murat",
        reason: "Defekt",
        details: "Double",
        status: "RESOLVED",
        createdAt: "2026-05-05T10:00:00.000Z",
        decisionNote: "Entscheidung 2",
        decisionAt: "2026-05-05T11:00:00.000Z"
      },
      {
        id: "rc3",
        reporterId: "u3",
        reporterName: "Lea",
        targetType: "USER",
        targetId: "u2",
        targetLabel: "Murat",
        targetHref: null,
        subjectUserId: "u2",
        subjectUserName: "Murat",
        reason: "Defekt",
        details: "Double",
        status: "RESOLVED",
        createdAt: "2026-05-05T10:00:00.000Z",
        decisionNote: "Entscheidung 3",
        decisionAt: "2026-05-05T11:00:00.000Z"
      },
      {
        id: "rc4",
        reporterId: "u3",
        reporterName: "Lea",
        targetType: "USER",
        targetId: "u2",
        targetLabel: "Murat",
        targetHref: null,
        subjectUserId: "u2",
        subjectUserName: "Murat",
        reason: "Defekt",
        details: "Double",
        status: "RESOLVED",
        createdAt: "2026-05-05T10:00:00.000Z",
        decisionNote: "Entscheidung 4",
        decisionAt: "2026-05-05T11:00:00.000Z"
      },
      {
        id: "rc5",
        reporterId: "u3",
        reporterName: "Lea",
        targetType: "USER",
        targetId: "u2",
        targetLabel: "Murat",
        targetHref: null,
        subjectUserId: "u2",
        subjectUserName: "Murat",
        reason: "Defekt",
        details: "Double",
        status: "RESOLVED",
        createdAt: "2026-05-05T10:00:00.000Z",
        decisionNote: "Entscheidung 5",
        decisionAt: "2026-05-05T11:00:00.000Z"
      },
      {
        id: "rc6",
        reporterId: "u3",
        reporterName: "Lea",
        targetType: "USER",
        targetId: "u2",
        targetLabel: "Murat",
        targetHref: null,
        subjectUserId: "u2",
        subjectUserName: "Murat",
        reason: "Defekt",
        details: "Double",
        status: "RESOLVED",
        createdAt: "2026-05-05T10:00:00.000Z",
        decisionNote: "Entscheidung 6",
        decisionAt: "2026-05-05T11:00:00.000Z"
      }
    ]);

    render(
      <MemoryRouter>
        <ModerationPage token="token-123" />
      </MemoryRouter>
    );

    // Click open details
    const summary = await screen.findByText(/Abgeschlossene Meldungen anzeigen/);
    fireEvent.click(summary);

    // Initial limit is 10, so all 6 should be visible
    expect(screen.getByText("Entscheidung 1")).toBeInTheDocument();
    expect(screen.getByText("Entscheidung 6")).toBeInTheDocument();

    // Select limit of 5
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "5" } });

    // decision 6 should no longer be visible because limit is 5
    expect(screen.getByText("Entscheidung 1")).toBeInTheDocument();
    expect(screen.queryByText("Entscheidung 6")).not.toBeInTheDocument();
  });

  it("renders delete tool option and submits deletion", async () => {
    listClosedReports.mockResolvedValue([]);
    listReports.mockResolvedValueOnce([
      {
        id: "r2",
        reporterId: "u3",
        reporterName: "Lea",
        targetType: "TOOL",
        targetId: "tool-1",
        targetLabel: "Spammy Tool",
        targetHref: "/tools/tool-1",
        subjectUserId: "u2",
        subjectUserName: "Murat",
        reason: "Spam",
        details: "Double post",
        status: "OPEN",
        createdAt: "2026-05-05T10:00:00.000Z"
      }
    ]).mockResolvedValueOnce([]);
    updateReportStatus.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ModerationPage token="token-123" />
      </MemoryRouter>
    );

    expect(await screen.findByText("Spammy Tool")).toBeInTheDocument();
    const deleteBtn = screen.getByRole("button", { name: "Angebot löschen" });
    fireEvent.click(deleteBtn);

    expect(screen.getByRole("heading", { name: "Angebot löschen" })).toBeInTheDocument();
    
    fireEvent.change(screen.getByPlaceholderText("Warum wird dieses Angebot/diese Werkstatt gelöscht?"), {
      target: { value: "Verstoß gegen Richtlinien" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Angebot unwiderruflich löschen" }));

    await waitFor(() => {
      expect(updateReportStatus).toHaveBeenCalledWith(
        "r2",
        {
          status: "RESOLVED",
          deleteTool: true,
          deleteWorkshop: false,
          warningReason: "Verstoß gegen Richtlinien",
          decisionNote: undefined
        },
        "token-123"
      );
    });
  });

  it("requires login and submits a new tool with pickup data", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));
    expect(await screen.findByText("Bitte gib einen Namen für das Werkzeug ein.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("z.B. Akku-Bohrmaschine"), {
      target: { value: "Akkuschrauber" }
    });
    fireEvent.change(screen.getByPlaceholderText("z.B.: Zustand: wie neu, selten benutzt. Lieferumfang: 1x Bohrmaschine, 2x Akkus, 1x Ladegerät. Besonderheiten: sehr leise, eingebaute LED"), {
      target: { value: "Sehr gut erhalten" }
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "holz" } });

    fireEvent.click(screen.getByRole("button", { name: "Adresse manuell eingeben" }));
    fireEvent.change(screen.getByPlaceholderText("Straße"), { target: { value: "Musterstraße" } });
    fireEvent.change(screen.getByPlaceholderText("Hausnummer"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("PLZ"), { target: { value: "80331" } });
    fireEvent.change(screen.getByPlaceholderText("Ort"), { target: { value: "München" } });
    fireEvent.change(screen.getByPlaceholderText("Land"), { target: { value: "Deutschland" } });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(["image"], "tool.png", { type: "image/png" })] }
    });

    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));

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

  it("builds a workshop payload from the combined form", async () => {
    createWorkshop.mockResolvedValueOnce({ id: "workshop-1" });
    validateAddress.mockResolvedValueOnce({
      isValid: true,
      normalizedAddress: "Musterstraße 5, 80331 München, Deutschland",
      normalizedParts: null
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/workshops/new"]}>
        <Routes>
          <Route path="/workshops/new" element={<NewWorkshopPage currentUser={adminUser} token="token-123" />} />
          <Route path="/workshops" element={<div>Workshops Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.submit(screen.getByRole("button", { name: "Werkstatt einstellen" }).closest("form")!);
    expect(await screen.findByText("Bitte gib einen Namen für die Werkstatt ein.")).toBeInTheDocument();
    expect(pushToast).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("z.B. Garagen-Werkstatt"), { target: { value: "Maker Space" } });
    fireEvent.change(screen.getByPlaceholderText(/helle Werkstatt/i), {
      target: { value: "Eine gut ausgestattete Werkstatt." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Adresse manuell eingeben" }));
    fireEvent.change(screen.getByPlaceholderText("Straße"), { target: { value: "Musterstraße" } });
    fireEvent.change(screen.getByPlaceholderText("Hausnummer"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("PLZ"), { target: { value: "80331" } });
    fireEvent.change(screen.getByPlaceholderText("Ort"), { target: { value: "München" } });
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

    // Zeitfenster sind jetzt optional: ein blockierter Zeitraum kann optional angelegt werden.
    fireEvent.change(screen.getByLabelText("Startdatum"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Startzeit"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText("Enddatum"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Endzeit"), { target: { value: "12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Zeitraum blockieren" }));
    fireEvent.click(screen.getByRole("button", { name: "Werkstatt einstellen" }));

    await waitFor(() => {
      expect(createWorkshop).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Maker Space",
          description: "Eine gut ausgestattete Werkstatt.",
          location: "Musterstraße 5, 80331 München, Deutschland",
          maxCapacity: 3,
          extras: ["wlan"],
          equipmentItems: [{ name: "Bohrmaschine", category: "holz" }],
          imageUrls: ["data:image/png;base64,mock-file"],
          slots: [{ startIso: "2026-07-01T09:00", endIso: "2026-07-01T12:00", blockedByOwner: true }]
        }),
        "token-123"
      );
    });
    expect(await screen.findByText("Workshops Home")).toBeInTheDocument();
  });

  it("shows login required on the new tool page without token", () => {
    render(
      <MemoryRouter>
        <NewToolPage token={undefined} />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Einloggen" })).toHaveAttribute("href", "/auth");
  });

  it("blocks tool creation when address validation fails", async () => {
    validateAddress.mockResolvedValueOnce({
      isValid: false,
      normalizedAddress: null,
      normalizedParts: null
    });

    render(
      <MemoryRouter>
        <NewToolPage token="token-123" />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("z.B. Akku-Bohrmaschine"), {
      target: { value: "Akkuschrauber" }
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        "z.B.: Zustand: wie neu, selten benutzt. Lieferumfang: 1x Bohrmaschine, 2x Akkus, 1x Ladegerät. Besonderheiten: sehr leise, eingebaute LED"
      ),
      { target: { value: "Sehr gut erhalten" } }
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "holz" } });
    fireEvent.click(screen.getByRole("button", { name: "Adresse manuell eingeben" }));
    fireEvent.change(screen.getByPlaceholderText("Straße"), { target: { value: "Musterstraße" } });
    fireEvent.change(screen.getByPlaceholderText("Hausnummer"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("PLZ"), { target: { value: "80331" } });
    fireEvent.change(screen.getByPlaceholderText("Ort"), { target: { value: "München" } });

    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));

    await waitFor(() => {
      expect(validateAddress).toHaveBeenCalled();
      expect(createTool).not.toHaveBeenCalled();
      expect(pushToast).toHaveBeenCalledWith(
        "Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.",
        "error"
      );
    });
  });

  it("switches admin tabs and saves system rules", async () => {
    getMetrics.mockResolvedValue({
      users: 1,
      tools: 2,
      workshops: 1,
      openBookings: 0,
      openReports: 0,
      openSuspensionRequests: 0
    });
    listUsers.mockResolvedValue([]);
    listSuspensionRequests.mockResolvedValue([]);
    getSystemSettings.mockResolvedValue([
      {
        key: "maxLoanDurationDays",
        label: "Maximale Ausleihdauer",
        value: 14,
        min: 1,
        max: 90,
        unit: "Tage",
        enforced: true
      }
    ]);
    updateSystemSetting.mockResolvedValue({
      key: "maxLoanDurationDays",
      label: "Maximale Ausleihdauer",
      value: 21,
      min: 1,
      max: 90,
      unit: "Tage",
      enforced: true
    });
    getMonitoringOverview.mockResolvedValue({
      collectedAt: "2026-06-01T12:00:00.000Z",
      system: { cpuPercent: 10, ramPercent: 20, diskPercent: 30 },
      http: { requestsPerSec: 1, errorRatePercent: 0, p95LatencySeconds: 0.1 },
      business: {
        activeUsers: 1,
        registrationsTotal: 2,
        bookingsTotal: 3,
        loginsSuccess: 4,
        loginsFailed: 0
      }
    });
    getMonitoringLogs.mockResolvedValue({ logs: [], count: 0, query: "" });

    render(
      <MemoryRouter>
        <AdminPage currentUser={adminUser} token="token-123" />
      </MemoryRouter>
    );

    expect(await screen.findByText("Nutzer: 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Systemregeln" }));
    const settingInput = await screen.findByLabelText("Maximale Ausleihdauer");
    fireEvent.change(settingInput, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(pushToast).toHaveBeenCalledWith("Bitte eine ganze Zahl eingeben.", "error");

    fireEvent.change(settingInput, { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(pushToast).toHaveBeenCalledWith("Wert muss zwischen 1 und 90 liegen.", "error");

    fireEvent.change(settingInput, { target: { value: "21" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() =>
      expect(updateSystemSetting).toHaveBeenCalledWith("maxLoanDurationDays", 21, "token-123")
    );

    fireEvent.click(screen.getByRole("button", { name: "Monitoring" }));
    expect(await screen.findByRole("button", { name: "Übersicht" })).toBeInTheDocument();
    expect(getMonitoringOverview).toHaveBeenCalledWith("token-123");
  });
});
