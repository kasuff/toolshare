import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { useAuthStore } from "../src/store/authStore";

const {
  loginApi,
  registerApi,
  getCurrentUser,
  suggestAddresses,
  validateAddress
} = vi.hoisted(() => ({
  loginApi: vi.fn(),
  registerApi: vi.fn(),
  getCurrentUser: vi.fn(),
  suggestAddresses: vi.fn(),
  validateAddress: vi.fn()
}));

function syncAuthStore(overrides: {
  token?: string | null;
  currentUser?: { id: string; name: string; role: string } | null;
  isLoading?: boolean;
  error?: string | null;
} = {}) {
  useAuthStore.setState({
    token: overrides.token ?? null,
    currentUser: overrides.currentUser ?? null,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null
  });
}

vi.mock("@toolshare/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@toolshare/shared")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      login: loginApi,
      register: registerApi,
      getCurrentUser,
      suggestAddresses,
      validateAddress
    }
  };
});

vi.mock("../src/components/Layout", () => ({
  Layout: () => <Outlet />
}));

vi.mock("../src/pages/DashboardPage", () => ({ DashboardPage: () => <div>Dashboard mock</div> }));
vi.mock("../src/pages/ToolsPage", () => ({ ToolsPage: () => <div>Tools mock</div> }));
vi.mock("../src/pages/ToolDetailPage", () => ({ ToolDetailPage: () => <div>Tool detail mock</div> }));
vi.mock("../src/pages/EditToolPage", () => ({ EditToolPage: () => <div>Edit tool mock</div> }));
vi.mock("../src/pages/NewToolPage", () => ({ NewToolPage: () => <div>New tool mock</div> }));
vi.mock("../src/pages/WorkshopsPage", () => ({ WorkshopsPage: () => <div>Workshops mock</div> }));
vi.mock("../src/pages/NewWorkshopPage", () => ({ NewWorkshopPage: () => <div>New workshop mock</div> }));
vi.mock("../src/pages/EditWorkshopPage", () => ({ EditWorkshopPage: () => <div>Edit workshop mock</div> }));
vi.mock("../src/pages/WorkshopAvailabilityPage", () => ({ WorkshopAvailabilityPage: () => <div>Availability mock</div> }));
vi.mock("../src/pages/InboxPage", () => ({ InboxPage: () => <div>Inbox mock</div> }));
vi.mock("../src/pages/AdminPage", () => ({ AdminPage: () => <div>Admin mock</div> }));
vi.mock("../src/pages/ModerationPage", () => ({ ModerationPage: () => <div>Moderation mock</div> }));
vi.mock("../src/pages/MyOffersPage", () => ({ MyOffersPage: () => <div>My offers mock</div> }));
vi.mock("../src/pages/ProfileSettingsPage", () => ({ ProfileSettingsPage: () => <div>Profile mock</div> }));

function resetSession() {
  loginApi.mockReset();
  registerApi.mockReset();
  getCurrentUser.mockReset();
  suggestAddresses.mockReset();
  validateAddress.mockReset();
  getCurrentUser.mockResolvedValue(null);
  syncAuthStore();
}

describe("App", () => {
  beforeEach(() => {
    resetSession();
  });

  it("shows the loading shell while the session is resolving", () => {
    getCurrentUser.mockImplementation(() => new Promise(() => {}));
    syncAuthStore({ token: "pending-token", isLoading: true });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Lade Session...")).toBeInTheDocument();
  });

  it("logs in from the auth screen and submits the login payload", async () => {
    loginApi.mockResolvedValue({ accessToken: "token-123" });
    getCurrentUser.mockResolvedValue({ id: "u1", name: "Lea", email: "lea@example.com", role: "NUTZER", isSuspended: false });

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <App />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("E-Mail"), { target: { value: "lea@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Passwort (mind. 8 Zeichen)"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Einloggen" }));

    await waitFor(() => {
      expect(loginApi).toHaveBeenCalledWith("lea@example.com", "password123");
    });
  });

  async function openRegisterForm() {
    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <App />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: /Neu bei Toolshare/i }));
  }

  it("shows live password match feedback during registration", async () => {
    await openRegisterForm();

    const passwordInput = screen.getByPlaceholderText("Passwort (mind. 8 Zeichen)");
    const repeatPasswordInput = screen.getByPlaceholderText("Passwort wiederholen");

    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.change(repeatPasswordInput, { target: { value: "password456" } });

    expect(screen.getByRole("alert")).toHaveTextContent("Passwörter stimmen nicht überein.");
    expect(repeatPasswordInput).toHaveClass("input-invalid");
    expect(screen.getByRole("button", { name: "Registrieren und starten" })).toBeDisabled();

    fireEvent.change(repeatPasswordInput, { target: { value: "password123" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Passwörter stimmen überein.");
    expect(repeatPasswordInput).not.toHaveClass("input-invalid");
    expect(screen.getByRole("button", { name: "Registrieren und starten" })).not.toBeDisabled();
  });

  it("does not register when passwords do not match", async () => {
    validateAddress.mockResolvedValueOnce({
      isValid: true,
      normalizedAddress: null,
      normalizedParts: null
    });

    await openRegisterForm();

    fireEvent.change(screen.getByPlaceholderText("E-Mail"), { target: { value: "nina@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Passwort (mind. 8 Zeichen)"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Passwort wiederholen"), { target: { value: "different123" } });
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Nina" } });
    fireEvent.click(screen.getByRole("button", { name: "Adresse manuell eingeben" }));
    fireEvent.change(screen.getByPlaceholderText("Straße"), { target: { value: "Musterstraße" } });
    fireEvent.change(screen.getByPlaceholderText("Hausnr."), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("PLZ"), { target: { value: "80331" } });
    fireEvent.change(screen.getByPlaceholderText("Ort"), { target: { value: "Muenchen" } });
    fireEvent.change(screen.getByPlaceholderText("Land"), { target: { value: "Deutschland" } });

    fireEvent.click(screen.getByRole("button", { name: "Registrieren und starten" }));

    await waitFor(() => {
      expect(registerApi).not.toHaveBeenCalled();
      expect(validateAddress).not.toHaveBeenCalled();
    });
  });

  it("registers a user with validated address data", async () => {
    registerApi.mockResolvedValue({ accessToken: "token-456" });
    getCurrentUser.mockResolvedValue({ id: "u2", name: "Nina", email: "nina@example.com", role: "NUTZER", isSuspended: false });
    validateAddress.mockResolvedValueOnce({
      isValid: true,
      normalizedAddress: null,
      normalizedParts: null
    });

    await openRegisterForm();
    fireEvent.change(screen.getByPlaceholderText("E-Mail"), { target: { value: "nina@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Passwort (mind. 8 Zeichen)"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Passwort wiederholen"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Nina" } });
    fireEvent.click(screen.getByRole("button", { name: "Adresse manuell eingeben" }));
    fireEvent.change(screen.getByPlaceholderText("Straße"), { target: { value: "Musterstraße" } });
    fireEvent.change(screen.getByPlaceholderText("Hausnr."), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("PLZ"), { target: { value: "80331" } });
    fireEvent.change(screen.getByPlaceholderText("Ort"), { target: { value: "Muenchen" } });
    fireEvent.change(screen.getByPlaceholderText("Land"), { target: { value: "Deutschland" } });

    fireEvent.click(screen.getByRole("button", { name: "Registrieren und starten" }));

    await waitFor(() => {
      expect(validateAddress).toHaveBeenCalledWith("Musterstraße 5, 80331 Muenchen, Deutschland");
      expect(registerApi).toHaveBeenCalledWith({
        email: "nina@example.com",
        password: "password123",
        name: "Nina",
        address: "Musterstraße 5, 80331 Muenchen, Deutschland"
      });
    });
  });

  it("redirects logged out users from protected routes", () => {
    render(
      <MemoryRouter initialEntries={["/tools/new"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Bitte melde dich an, um diese Funktion zu nutzen.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Willkommen zurück" })).toBeInTheDocument();
  });

  it("protects the offers overview and renders it for authenticated users", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/offers"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Bitte melde dich an, um diese Funktion zu nutzen.")).toBeInTheDocument();
    unmount();

    syncAuthStore({
      token: "token-123",
      currentUser: { id: "u5", name: "Sabine", role: "NUTZER" }
    });
    getCurrentUser.mockResolvedValue({ id: "u5", name: "Sabine", email: "s@example.com", role: "NUTZER", isSuspended: false });

    render(
      <MemoryRouter initialEntries={["/offers"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("My offers mock")).toBeInTheDocument();
  });

  it("renders the dashboard when an authenticated user lands on the app", async () => {
    syncAuthStore({
      token: "token-123",
      currentUser: { id: "u5", name: "Sabine", role: "ADMIN" }
    });
    getCurrentUser.mockResolvedValue({ id: "u5", name: "Sabine", email: "s@example.com", role: "ADMIN", isSuspended: false });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("Dashboard mock")).toBeInTheDocument();
  });

  it("renders the admin route when the session user is an admin", async () => {
    syncAuthStore({
      token: "token-123",
      currentUser: { id: "u5", name: "Sabine", role: "ADMIN" }
    });
    getCurrentUser.mockResolvedValue({ id: "u5", name: "Sabine", email: "s@example.com", role: "ADMIN", isSuspended: false });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("Admin mock")).toBeInTheDocument();
  });

  it("renders the moderation route when the session user is a moderator", async () => {
    syncAuthStore({
      token: "token-123",
      currentUser: { id: "u4", name: "Tobias", role: "MODERATOR" }
    });
    getCurrentUser.mockResolvedValue({ id: "u4", name: "Tobias", email: "t@example.com", role: "MODERATOR", isSuspended: false });

    render(
      <MemoryRouter initialEntries={["/moderation"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("Moderation mock")).toBeInTheDocument();
  });
});
