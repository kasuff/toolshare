import type { ImageStorageService } from "../../ports/image-storage.service";

const MAX_DATA_URL_BYTES = 5 * 1024 * 1024;

export class DataUrlImageStorage implements ImageStorageService {
  async uploadImage(file: Buffer, mimeType: string): Promise<string> {
    if (file.byteLength > MAX_DATA_URL_BYTES) {
      throw new Error("Image exceeds maximum size for data-url storage");
    }
    return `data:${mimeType};base64,${file.toString("base64")}`;
  }

  async deleteImage(_url: string): Promise<void> {
    // Data URLs are embedded in DB rows — deletion is handled by entity lifecycle.
  }
}