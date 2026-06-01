import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../hooks/useToast";
import { api } from "../../services/api";
import { ToolsPage } from "../../pages/ToolsPage";
import { WorkshopsPage } from "../../pages/WorkshopsPage";

vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getTools: vi.fn(),
      getWorkshops: vi.fn()
    }
  };
});

function AuthStateProbe() {
  const location = useLocation();
  return <p data-testid="redirect-hint">{(location.state as { redirectHint?: string } | null)?.redirectHint ?? "no-hint"}</p>;
}

function renderWithRoutes(element: ReactElement, path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="/auth" element={<AuthStateProbe />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("Guest protected actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects guests to auth when requesting a tool", async () => {
    vi.mocked(api.getTools).mockResolvedValue([
      {
        id: "tool-1",
        ownerId: "owner-1",
        name: "Bohrmaschine",
        description: "Leistungsstark",
        category: "Elektro",
        status: "VERFUEGBAR",
        imageUrl: "https://example.com/tool.jpg"
      }
    ]);

    renderWithRoutes(<ToolsPage />, "/tools");

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Einloggen zum Anfragen" }));

    expect(await screen.findByTestId("redirect-hint")).toHaveTextContent(
      "Bitte melde dich an, um eine Ausleihe anzufragen."
    );
  });

  it("redirects guests to auth when booking a workshop slot", async () => {
    vi.mocked(api.getWorkshops).mockResolvedValue([
      {
        workshop: {
          id: "workshop-1",
          ownerId: "owner-1",
          name: "Holzwerkstatt",
          description: "Mit Betreuung",
          location: "München",
          maxCapacity: 5,
          imageUrls: [],
          toolIds: []
        },
        slots: [
          {
            id: "slot-1",
            workshopId: "workshop-1",
            startIso: "2026-05-06T10:00",
            endIso: "2026-05-06T12:00",
            blockedByOwner: false
          }
        ]
      }
    ]);

    renderWithRoutes(<WorkshopsPage />, "/workshops");

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Login" }));

    expect(await screen.findByTestId("redirect-hint")).toHaveTextContent(
      "Bitte melde dich an, um eine Werkstatt zu buchen."
    );
  });
});
