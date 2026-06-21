import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RatingFormPanel } from "../../src/components/RatingFormPanel";

describe("RatingFormPanel", () => {
  const baseProps = {
    title: "Anbieter bewerten",
    hint: "Nur einmal möglich.",
    targetLabel: "Bohrer",
    score: 0,
    comment: "",
    isSubmitting: false,
    onScoreChange: vi.fn(),
    onCommentChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn()
  };

  it("renders target label and disables submit until a star is selected", () => {
    render(<RatingFormPanel {...baseProps} />);

    expect(screen.getByRole("dialog", { name: "Anbieter bewerten" })).toBeInTheDocument();
    expect(screen.getByText("Bohrer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bewertung speichern" })).toBeDisabled();
  });

  it("calls score and comment handlers and submits when valid", () => {
    const onScoreChange = vi.fn();
    const onCommentChange = vi.fn();
    const onSubmit = vi.fn();

    const { rerender } = render(
      <RatingFormPanel
        {...baseProps}
        onScoreChange={onScoreChange}
        onCommentChange={onCommentChange}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "4 von 5 Sternen" }));
    expect(onScoreChange).toHaveBeenCalledWith(4);

    rerender(
      <RatingFormPanel
        {...baseProps}
        score={4}
        onScoreChange={onScoreChange}
        onCommentChange={onCommentChange}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText("Kommentar (optional)"), { target: { value: "Top Gerät" } });
    expect(onCommentChange).toHaveBeenCalledWith("Top Gerät");

    fireEvent.click(screen.getByRole("button", { name: "Bewertung speichern" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("closes via Escape and Später button", () => {
    const onCancel = vi.fn();
    render(<RatingFormPanel {...baseProps} onCancel={onCancel} />);

    expect(screen.getByRole("button", { name: "Schließen" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Später" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
