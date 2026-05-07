import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Layout } from "../../src/components/Layout";
import type { User } from "../../src/types/domain";

const users: User[] = [
  { id: "u1", name: "Lea", email: "lea@toolshare.local", role: "NUTZER", isSuspended: false },
  { id: "u2", name: "Tobias", email: "tobias@toolshare.local", role: "MODERATOR", isSuspended: false }
];

describe("Layout", () => {
  it("opens tool and workshop dropdowns and closes them on outside click", () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Werkzeuge/i }));
    expect(screen.getByText("Werkzeuge anschauen")).toBeInTheDocument();
    expect(screen.getByText("Werkzeug anbieten")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Werkzeug anbieten")).not.toBeInTheDocument();
  });
});
