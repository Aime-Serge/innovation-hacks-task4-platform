/**
 * Rules for a profile photo, shared by the registration wizard (instant feedback and the client
 * read of a chosen file) and the mock auth adapter (S-D parity with the real backend's own rule
 * in backend/app/schemas/base.py, ADR-426). Both sides must agree or the mock would accept what
 * the real API refuses.
 */
export const AVATAR_MAX_BYTES = 500_000;
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const AVATAR_ACCEPT = AVATAR_TYPES.join(",");
// The 500 KB file cap plus base64's ~4/3 inflation and the "data:image/...;base64," header,
// rounded up: the same number backend/app/schemas/base.py enforces.
export const AVATAR_DATA_MAX = 700_000;

const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isHttpsImageUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** `null` when the string is a photo the backend will accept: an https link or an inline upload. */
export function avatarUrlProblem(value: string): "protocol" | "format" | "size" | null {
  if (value.startsWith("data:")) {
    if (value.length > AVATAR_DATA_MAX) return "size";
    return DATA_URL.test(value) ? null : "format";
  }
  return isHttpsImageUrl(value) ? null : "protocol";
}

/** `null` when the file is fine to read and upload. */
export function avatarFileProblem(file: File): "type" | "size" | null {
  if (!AVATAR_TYPES.includes(file.type as (typeof AVATAR_TYPES)[number])) return "type";
  if (file.size > AVATAR_MAX_BYTES) return "size";
  return null;
}

/**
 * Reads a file straight to the `data:` URL the backend stores as-is: what is previewed while
 * choosing a photo is byte-for-byte what gets submitted, so there is nothing to reconcile
 * afterwards and no `blob:` object URL ever needs a place in the app's CSP.
 */
export function readAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read the image."));
    };
    reader.onerror = () => reject(new Error("Failed to read the image."));
    reader.readAsDataURL(file);
  });
}
