import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HammerIcon } from "../../src/components/HammerIcon";

describe("HammerIcon", () => {
  it("renders a decorative svg", () => {
    const { container } = render(<HammerIcon />);
    const svg = container.querySelector("svg");

    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
