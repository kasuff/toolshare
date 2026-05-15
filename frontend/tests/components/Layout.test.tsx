import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Layout } from "../../src/components/Layout";
import type { User } from "../../src/types/domain";

const users: User[] = [
  { id: "u1", name: "Lea", email: "lea@toolshare.local", role: "NUTZER", isSuspended: false },
  { id: "u2", name: "Tobias", email: "tobias@toolshare.local", role: "MODERATOR", isSuspended: false }
];

describe("Layout", () => {
  it("renders primary navigation links", () => {
    const onSwitchUser = vi.fn();
    const onLogout = vi.fn();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            element={<Layout users={users} currentUser={users[0]} onSwitchUser={onSwitchUser} onLogout={onLogout} />}
          >
            <Route index element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /Entdecken/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Werkzeuge/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Werkstätten/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Inbox/i })).toBeInTheDocument();
  });
});
