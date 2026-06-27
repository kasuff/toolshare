import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataUrlImageStorage } from "../src/infrastructure/storage/data-url-image-storage";
import { parseDataUrl, resolveImageReference } from "../src/ports/image-storage.service";

describe("DataUrlImageStorage", () => {
  it("encodes uploaded buffers as data URLs", async () => {
    const storage = new DataUrlImageStorage();
    const url = await storage.uploadImage(Buffer.from("abc"), "image/png");
    expect(url).toBe("data:image/png;base64,YWJj");
  });
});

describe("resolveImageReference", () => {
  it("passes through external URLs", async () => {
    const storage = {
      uploadImage: vi.fn(),
      deleteImage: vi.fn()
    };
    await expect(resolveImageReference(storage, "https://example.com/a.png")).resolves.toBe(
      "https://example.com/a.png"
    );
    expect(storage.uploadImage).not.toHaveBeenCalled();
  });

  it("uploads parsed data URLs through storage", async () => {
    const storage = {
      uploadImage: vi.fn().mockResolvedValue("stored-url"),
      deleteImage: vi.fn()
    };
    const parsed = parseDataUrl("data:image/jpeg;base64,YWJj");
    expect(parsed?.mimeType).toBe("image/jpeg");
    await expect(resolveImageReference(storage, "data:image/jpeg;base64,YWJj")).resolves.toBe(
      "stored-url"
    );
    expect(storage.uploadImage).toHaveBeenCalled();
  });
});