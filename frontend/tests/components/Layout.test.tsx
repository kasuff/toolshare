import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Layout } from "../../src/components/Layout";
import type { User } from "../../src/types/domain";

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
    expect(screen.getByText("Einstellungen")).toBeVisible();

    fireEvent.mouseDown(document.body);
    expect(screen.getByText("Einstellungen")).not.toBeVisible();

    expect(screen.getByRole("button", { name: "Ausloggen" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ausloggen" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
