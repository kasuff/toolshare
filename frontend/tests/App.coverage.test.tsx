import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

const {
  session,
  login,
  register,
  logout,
  updateProfile,
  suggestAddresses,
  validateAddress
} = vi.hoisted(() => ({
  session: {
    token: null as string | null,
    users: [] as Array<{ id: string; name: string; role: string }>,
    currentUser: null as null | { id: string; name: string; role: string },
    isLoading: false,
    error: null as string | null
  },
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  suggestAddresses: vi.fn(),
  validateAddress: vi.fn()
}));

vi.mock("../src/hooks/useSession", () => ({
  useSession: () => ({
    token: session.token,
    users: session.users,
    currentUser: session.currentUser,
    isLoading: session.isLoading,
    error: session.error,
    login,
    register,
    logout,
    updateProfile
  })
}));

vi.mock("../src/services/api", () => ({
  api: {
    suggestAddresses,
    validateAddress
  }
}));

vi.mock("../src/components/Layout", () => ({
  Layout: () => <Outlet />
}));

vi.mock("../src/pages/DashboardPage", () => ({ DashboardPage: () => <div>Dashboard mock</div> }));
vi.mock("../src/pages/ToolsPage", () => ({ ToolsPage: () => <div>Tools mock</div> }));
vi.mock("../src/pages/ToolDetailPage", () => ({ ToolDetailPage: () => <div>Tool detail mock</div> }));
vi.mock("../src/pages/NewToolPage", () => ({ NewToolPage: () => <div>New tool mock</div> }));
vi.mock("../src/pages/WorkshopsPage", () => ({ WorkshopsPage: () => <div>Workshops mock</div> }));
vi.mock("../src/pages/NewWorkshopPage", () => ({ NewWorkshopPage: () => <div>New workshop mock</div> }));
vi.mock("../src/pages/EditWorkshopPage", () => ({ EditWorkshopPage: () => <div>Edit workshop mock</div> }));
vi.mock("../src/pages/WorkshopAvailabilityPage", () => ({ WorkshopAvailabilityPage: () => <div>Availability mock</div> }));
vi.mock("../src/pages/InboxPage", () => ({ InboxPage: () => <div>Inbox mock</div> }));
vi.mock("../src/pages/AdminPage", () => ({ AdminPage: () => <div>Admin mock</div> }));
vi.mock("../src/pages/ModerationPage", () => ({ ModerationPage: () => <div>Moderation mock</div> }));
vi.mock("../src/pages/ProfileSettingsPage", () => ({ ProfileSettingsPage: () => <div>Profile mock</div> }));

function resetSession() {
  session.token = null;
  session.users = [];
  session.currentUser = null;
  session.isLoading = false;
  session.error = null;
  login.mockReset();
  register.mockReset();
  logout.mockReset();
  updateProfile.mockReset();
  suggestAddresses.mockReset();
  validateAddress.mockReset();
}

describe("App", () => {
  beforeEach(() => {
    resetSession();
  });

  it("shows the loading shell while the session is resolving", () => {
    session.isLoading = true;

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Lade Session...")).toBeInTheDocument();
  });

  it("logs in from the auth screen and submits the login payload", async () => {
    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <App />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("E-Mail"), { target: { value: "lea@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Passwort (mind. 8 Zeichen)"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Einloggen" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("lea@example.com", "password123");
    });
  });

  it("registers a user with validated address data", async () => {
    validateAddress.mockResolvedValueOnce({
      isValid: true,
      normalizedAddress: null,
      normalizedParts: null
    });

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <App />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Neu bei Toolshare/i }));
    fireEvent.change(screen.getByPlaceholderText("E-Mail"), { target: { value: "nina@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Passwort (mind. 8 Zeichen)"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Passwort wiederholen"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Nina" } });
    fireEvent.change(screen.getByPlaceholderText("Straße"), { target: { value: "Musterstraße" } });
    fireEvent.change(screen.getByPlaceholderText("Hausnr"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("PLZ"), { target: { value: "80331" } });
    fireEvent.change(screen.getByPlaceholderText("Ort"), { target: { value: "Muenchen" } });
    fireEvent.change(screen.getByPlaceholderText("Land"), { target: { value: "Deutschland" } });

    fireEvent.click(screen.getByRole("button", { name: "Registrieren und starten" }));

    await waitFor(() => {
      expect(validateAddress).toHaveBeenCalledWith("Musterstraße 5, 80331 Muenchen, Deutschland");
      expect(register).toHaveBeenCalledWith({
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

  it("renders the dashboard when an authenticated user lands on the app", () => {
    session.token = "token-123";
    session.currentUser = { id: "u5", name: "Sabine", role: "ADMIN" };
    session.users = [{ id: "u5", name: "Sabine", role: "ADMIN" }];

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Dashboard mock")).toBeInTheDocument();
  });

  it("renders the admin route when the session user is an admin", () => {
    session.token = "token-123";
    session.currentUser = { id: "u5", name: "Sabine", role: "ADMIN" };
    session.users = [{ id: "u5", name: "Sabine", role: "ADMIN" }];

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Admin mock")).toBeInTheDocument();
  });

  it("renders the moderation route when the session user is a moderator", () => {
    session.token = "token-123";
    session.currentUser = { id: "u4", name: "Tobias", role: "MODERATOR" };
    session.users = [{ id: "u4", name: "Tobias", role: "MODERATOR" }];

    render(
      <MemoryRouter initialEntries={["/moderation"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Moderation mock")).toBeInTheDocument();
  });
});