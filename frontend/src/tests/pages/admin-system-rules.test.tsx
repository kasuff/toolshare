import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../hooks/useToast";
import { api, type SystemSetting } from "../../services/api";
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
      getSystemSettings: vi.fn(),
      updateSystemSetting: vi.fn()
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

const loanSetting: SystemSetting = {
  key: "maxLoanDurationDays",
  label: "Maximale Ausleihdauer eines Werkzeugs",
  unit: "Tage",
  value: 14,
  min: 1,
  max: 365
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
    vi.mocked(api.getSystemSettings).mockResolvedValue([loanSetting]);
  });

  it("Given: ich bin Admin – zeigt den Tab Systemregeln an", async () => {
    renderAdminPage();

    expect(await screen.findByRole("button", { name: "Systemregeln" })).toBeInTheDocument();
  });

  it("Given: ich bin Admin – When: Systemregeln-Tab öffne, Then: sehe ich Label und editierbares Zahlenfeld", async () => {
    renderAdminPage();

    fireEvent.click(await screen.findByRole("button", { name: "Systemregeln" }));

    expect(await screen.findByText("Maximale Ausleihdauer eines Werkzeugs:")).toBeInTheDocument();
    const input = screen.getByLabelText("Maximale Ausleihdauer eines Werkzeugs") as HTMLInputElement;
    expect(input).toHaveValue(14);
    expect(screen.getByText("Tage")).toBeInTheDocument();
  });

  it("Given: ich bin Admin – When: Wert ändern und speichern, Then: wird er übernommen", async () => {
    vi.mocked(api.updateSystemSetting).mockResolvedValue({ ...loanSetting, value: 21 });

    renderAdminPage();

    fireEvent.click(await screen.findByRole("button", { name: "Systemregeln" }));

    const input = await screen.findByLabelText("Maximale Ausleihdauer eines Werkzeugs");
    fireEvent.change(input, { target: { value: "21" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => {
      expect(api.updateSystemSetting).toHaveBeenCalledWith("maxLoanDurationDays", 21, "test-token");
    });
    expect(await screen.findByDisplayValue("21")).toBeInTheDocument();
  });

  it("Given: ich bin nicht eingeloggt (kein Token) – Then: wird kein Systemregeln-Tab angeboten", async () => {
    renderAdminPageNoToken(adminUser);

    expect(await screen.findByText("Einloggen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Systemregeln" })).not.toBeInTheDocument();
  });
});
