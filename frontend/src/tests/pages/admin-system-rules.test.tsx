import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../hooks/useToast";
import { api } from "../../services/api";
import { AdminPage } from "../../pages/AdminPage";
import type { User } from "../../types/domain";

vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      listUsers: vi.fn(),
      getMetrics: vi.fn(),
      listSuspensionRequests: vi.fn(),
      listSystemRules: vi.fn(),
      createSystemRule: vi.fn(),
      updateSystemRule: vi.fn(),
      deleteSystemRule: vi.fn()
    }
  };
});

const adminUser: User = {
  id: "admin-1",
  name: "Admin",
  email: "admin@example.com",
  role: "ADMIN",
  isSuspended: false
};

function renderAdminPage(user: User | undefined = adminUser, token?: string) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <AdminPage currentUser={user} token={token ?? "test-token"} />
      </MemoryRouter>
    </ToastProvider>
  );
}

function renderAdminPageNoToken(user: User | undefined = adminUser) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <AdminPage currentUser={user} token={undefined} />
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("AdminPage – Systemregeln", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listUsers).mockResolvedValue([]);
    vi.mocked(api.getMetrics).mockResolvedValue({
      users: 0,
      tools: 0,
      workshops: 0,
      openBookings: 0,
      openReports: 0,
      openSuspensionRequests: 0
    });
    vi.mocked(api.listSuspensionRequests).mockResolvedValue([]);
    vi.mocked(api.listSystemRules).mockResolvedValue([]);
  });

  it("Given: ich bin Admin – zeigt den Tab Systemregeln an", async () => {
    renderAdminPage();

    expect(await screen.findByRole("button", { name: "Systemregeln" })).toBeInTheDocument();
  });

  it("Given: ich bin Admin – When: Systemregeln-Tab öffne, Then: sehe ich Kennzahlen und Regelbereich", async () => {
    vi.mocked(api.listSystemRules).mockResolvedValue([
      { id: "rule-1", text: "Werkzeuge pfleglich behandeln." }
    ]);

    renderAdminPage();

    fireEvent.click(await screen.findByRole("button", { name: "Systemregeln" }));

    expect(await screen.findByText("Werkzeuge pfleglich behandeln.")).toBeInTheDocument();
    expect(screen.getByLabelText("Neue Systemregel")).toBeInTheDocument();
  });

  it("Given: ich bin Admin – When: neue Regel speichern, Then: wird sie im System angewendet", async () => {
    const created = { id: "rule-new", text: "Rückgabe innerhalb von 7 Tagen." };
    vi.mocked(api.createSystemRule).mockResolvedValue(created);

    renderAdminPage();

    fireEvent.click(await screen.findByRole("button", { name: "Systemregeln" }));

    const textarea = await screen.findByLabelText("Neue Systemregel");
    fireEvent.change(textarea, { target: { value: "Rückgabe innerhalb von 7 Tagen." } });
    fireEvent.click(screen.getByRole("button", { name: "Regel hinzufügen" }));

    await waitFor(() => {
      expect(api.createSystemRule).toHaveBeenCalledWith("Rückgabe innerhalb von 7 Tagen.", "test-token");
    });
    expect(await screen.findByText("Rückgabe innerhalb von 7 Tagen.")).toBeInTheDocument();
  });

  it("Given: ich bin nicht Admin (kein Token) – Then: wird kein Systemregeln-Tab angeboten", async () => {
    renderAdminPageNoToken(adminUser);

    // When token is absent the component renders the login prompt, not the tab nav
    expect(await screen.findByText("Einloggen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Systemregeln" })).not.toBeInTheDocument();
  });
});
