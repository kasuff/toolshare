import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImageUpload } from "../../src/components/ImageUpload";

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

    render(<ImageUpload onImageSelect={onImageSelect} label="Foto" hint="Maximal 5 MB" />);

    expect(screen.getByText("Foto")).toBeInTheDocument();
    expect(screen.getByText("Maximal 5 MB")).toBeInTheDocument();
    expect(screen.getByText("Klick zum Bild hochladen")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Bild hochladen$/i }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("accepts valid images and forwards the data URL", async () => {
    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);
    const onImageSelect = vi.fn();
    const user = userEvent.setup();

    const { container } = render(<ImageUpload onImageSelect={onImageSelect} label="Foto" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, new File(["image"], "sample.png", { type: "image/png" }));

    expect(onImageSelect).toHaveBeenCalledWith("data:image/png;base64,preview-data");
    expect(screen.getByText("sample.png")).toBeInTheDocument();
  });

  it("rejects invalid file types and oversized files", async () => {
    const onImageSelect = vi.fn();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const user = userEvent.setup();

    const { container } = render(<ImageUpload onImageSelect={onImageSelect} label="Foto" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File(["doc"], "note.txt", { type: "text/plain" })] } });
    expect(alertSpy).toHaveBeenCalledWith("Bitte wähle eine Bilddatei aus (JPG, PNG, etc.)");

    alertSpy.mockClear();
    fireEvent.change(input, {
      target: { files: [new File([new ArrayBuffer(6 * 1024 * 1024)], "large.png", { type: "image/png" })] }
    });
    expect(alertSpy).toHaveBeenCalledWith("Datei ist zu groß. Maximum 5MB.");
    expect(onImageSelect).not.toHaveBeenCalled();
  });

  it("clears the selected image", async () => {
    const onImageSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ImageUpload
        onImageSelect={onImageSelect}
        currentImage="https://example.com/image.jpg"
        placeholderImage="https://example.com/placeholder.jpg"
        label="Foto"
      />
    );

    expect(screen.getByRole("img", { name: /Preview/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Entfernen/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Bild wechseln/i }));
    expect(onImageSelect).not.toHaveBeenCalledWith(null);
  });
});
