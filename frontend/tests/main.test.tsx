import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));

vi.mock("react-dom/client", () => ({
  default: {
    createRoot: createRootMock
  }
}));

vi.mock("../src/App", () => ({
  default: () => null
}));

describe("main entry", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="root"></div>`;
    createRootMock.mockClear();
    renderMock.mockClear();
  });

  it("mounts the app into the root element", async () => {
    await import("../src/main");

    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById("root"));
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
