export interface ImageStorageService {
  uploadImage(file: Buffer, mimeType: string): Promise<string>;
  deleteImage(url: string): Promise<void>;
}

export function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

export async function resolveImageReference(
  storage: ImageStorageService,
  imageUrl?: string
): Promise<string | undefined> {
  if (!imageUrl) {
    return undefined;
  }
  const parsed = parseDataUrl(imageUrl);
  if (parsed) {
    return storage.uploadImage(parsed.buffer, parsed.mimeType);
  }
  return imageUrl;
}

export async function resolveImageUrls(
  storage: ImageStorageService,
  imageUrls?: string[]
): Promise<string[] | undefined> {
  if (!imageUrls) {
    return undefined;
  }
  const resolved = await Promise.all(
    imageUrls.map((url) => resolveImageReference(storage, url))
  );
  return resolved.filter((url): url is string => Boolean(url));
}
