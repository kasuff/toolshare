import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RatingsSection } from "../../src/components/RatingsSection";
import { ToastProvider } from "../../src/hooks/useToast";

const { createReport } = vi.hoisted(() => ({
  createReport: vi.fn()
}));

vi.mock("@toolshare/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@toolshare/shared")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      createReport
    }
  };
});

const sampleRatings = [
  {
    id: "rating-1",
    score: 5,
    comment: "Sehr freundlich",
    fromUserName: "Anna",
    createdIso: "2026-05-01T10:00:00.000Z"
  },
  {
    id: "rating-2",
    score: 3,
    comment: "Okay",
    fromUserName: "Tom",
    createdIso: "2026-05-02T12:00:00.000Z"
  }
];

function renderSection(props: Partial<ComponentProps<typeof RatingsSection>> = {}) {
  return render(
    <ToastProvider>
      <RatingsSection ratings={[]} token="token-123" {...props} />
    </ToastProvider>
  );
}

describe("RatingsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createReport.mockResolvedValue({ id: "report-1" });
  });

  it("shows empty state when there are no ratings", () => {
    renderSection({ emptyText: "Noch keine Bewertungen für dieses Angebot." });

    expect(screen.getByRole("heading", { name: "Bewertungen" })).toBeInTheDocument();
    expect(screen.getByText("Noch keine Bewertungen für dieses Angebot.")).toBeInTheDocument();
  });

  it("renders average score and rating list", () => {
    renderSection({ ratings: sampleRatings });

    expect(screen.getByText("2 Bewertungen")).toBeInTheDocument();
    expect(screen.getByText("4 / 5")).toBeInTheDocument();
    expect(screen.getByText("Sehr freundlich")).toBeInTheDocument();
    expect(screen.getByText("Okay")).toBeInTheDocument();
  });

  it("submits a rating report through the report dialog", async () => {
    renderSection({ ratings: sampleRatings });

    fireEvent.click(screen.getAllByRole("button", { name: "Bewertung melden" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Bewertung melden" });
    expect(dialog).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Grund"), { target: { value: "Beleid" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Bewertung melden" }));

    await waitFor(() => {
      expect(createReport).toHaveBeenCalledWith(
        {
          targetType: "RATING",
          targetId: "rating-1",
          reason: "Beleid",
          details: undefined
        },
        "token-123"
      );
    });
    expect(screen.queryByRole("dialog", { name: "Bewertung melden" })).not.toBeInTheDocument();
  });

  it("hides report buttons when reporting is disabled", () => {
    renderSection({ ratings: sampleRatings, canReport: false });

    expect(screen.queryByRole("button", { name: "Bewertung melden" })).not.toBeInTheDocument();
  });
});
