import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../src/pages/DashboardPage";

const { getTools, getWorkshops } = vi.hoisted(() => ({
  getTools: vi.fn(),
  getWorkshops: vi.fn()
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getTools,
    getWorkshops
  }
}));

describe("DashboardPage", () => {
  it("renders clickable featured tools and workshops", async () => {
    getTools.mockResolvedValueOnce([
      {
        id: "t1",
        ownerId: "u1",
        name: "Akkuschrauber Bosch",
        description: "Leistungsstark",
        category: "Elektro",
        imageUrl: "https://example.com/tool.jpg",
        status: "VERFUEGBAR"
      }
    ]);
    getWorkshops.mockResolvedValueOnce([
      {
        workshop: {
          id: "w1",
          ownerId: "u2",
          name: "Holzwerkstatt",
          description: "Mit Sägen",
          location: "München",
          maxCapacity: 4,
          imageUrls: ["https://example.com/workshop.jpg"],
          toolIds: []
        },
        slots: []
      }
    ]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("link", { name: /Akkuschrauber Bosch/i })).toHaveAttribute("href", "/tools/t1");
    expect(screen.getByRole("link", { name: /Nachrichten & Anfragen/i })).toHaveAttribute("href", "/inbox");
    expect(screen.getByText("Werkzeuge")).toBeInTheDocument();
    expect(screen.getByText("Verfügbare Werkstätten")).toBeInTheDocument();
    expect(screen.getByText("Holzwerkstatt")).toBeInTheDocument();
    await waitFor(() => expect(getTools).toHaveBeenCalled());
  });
});
