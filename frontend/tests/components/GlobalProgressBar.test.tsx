import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalProgressBar } from "../../src/components/GlobalProgressBar";
import { beginRequestActivity } from "../../src/services/requestActivity";

describe("GlobalProgressBar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("appears for longer requests and stays visible until parallel requests finish", () => {
    vi.useFakeTimers();
    render(<GlobalProgressBar />);

    const progress = screen.getByRole("progressbar", { hidden: true });
    let finishFirst = () => undefined;
    let finishSecond = () => undefined;

    act(() => {
      finishFirst = beginRequestActivity();
      finishSecond = beginRequestActivity();
      vi.advanceTimersByTime(180);
    });
    expect(progress).toHaveClass("visible");

    act(() => {
      finishFirst();
      vi.advanceTimersByTime(500);
    });
    expect(progress).toHaveClass("visible");

    act(() => {
      finishSecond();
      vi.advanceTimersByTime(420);
    });
    expect(progress).not.toHaveClass("visible");
  });

  it("does not flash for requests that finish before the delay", () => {
    vi.useFakeTimers();
    render(<GlobalProgressBar />);

    const progress = screen.getByRole("progressbar", { hidden: true });
    act(() => {
      const finish = beginRequestActivity();
      vi.advanceTimersByTime(100);
      finish();
      vi.advanceTimersByTime(200);
    });

    expect(progress).not.toHaveClass("visible");
  });
});
