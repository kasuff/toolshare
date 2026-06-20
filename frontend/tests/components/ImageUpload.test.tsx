import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImageUpload } from "../../src/components/ImageUpload";
import { DEFAULT_PLACEHOLDER_IMAGE } from "@toolshare/shared";

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

  readAsDataURL() {
    this.result = "data:image/png;base64,preview-data";
    this.onload?.({ target: this as unknown as FileReader } as ProgressEvent<FileReader>);
  }
}

describe("ImageUpload", () => {
  it("renders a placeholder and opens the file picker", async () => {
    const onImageSelect = vi.fn();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(
      <ImageUpload
        onImageSelect={onImageSelect}
        placeholderImage={DEFAULT_PLACEHOLDER_IMAGE}
        label="Foto"
        hint="Maximal 5 MB"
      />
    );

    expect(screen.getByText("Foto")).toBeInTheDocument();
    expect(screen.getByText("Maximal 5 MB")).toBeInTheDocument();
    expect(screen.getByText("Bilddatei hochladen")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Bild hochladen/i }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("accepts valid images and forwards the data URL", async () => {
    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);
    const onImageSelect = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <ImageUpload
        onImageSelect={onImageSelect}
        placeholderImage={DEFAULT_PLACEHOLDER_IMAGE}
        label="Foto"
      />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, new File(["image"], "sample.png", { type: "image/png" }));

    expect(onImageSelect).toHaveBeenCalledWith("data:image/png;base64,preview-data");
    expect(screen.getByText("sample.png")).toBeInTheDocument();
  });

  it("rejects invalid file types and oversized files", () => {
    const onImageSelect = vi.fn();

    const { container } = render(
      <ImageUpload
        onImageSelect={onImageSelect}
        placeholderImage={DEFAULT_PLACEHOLDER_IMAGE}
        label="Foto"
      />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const invalidFile = new File(["doc"], "note.txt", { type: "text/plain" });
    const invalidFileList = {
      0: invalidFile,
      length: 1,
      item: (index: number) => (index === 0 ? invalidFile : null)
    } as FileList;
    fireEvent.change(input, { target: { files: invalidFileList } });
    expect(screen.getByText(/Bitte wähle eine Bilddatei aus/i)).toBeInTheDocument();

    const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], "large.png", { type: "image/png" });
    const largeFileList = {
      0: largeFile,
      length: 1,
      item: (index: number) => (index === 0 ? largeFile : null)
    } as FileList;
    fireEvent.change(input, { target: { files: largeFileList } });
    expect(screen.getByText(/Datei ist zu groß/i)).toBeInTheDocument();
    expect(onImageSelect).not.toHaveBeenCalled();
  });
});
