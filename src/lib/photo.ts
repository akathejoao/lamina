const PHOTO = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_CHARS = 480_000;

export function safePhoto(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 32 || value.length > MAX_CHARS) return null;
  if (/[\s()"'\\]/.test(value)) return null;
  if (!PHOTO.test(value)) return null;
  return value;
}
