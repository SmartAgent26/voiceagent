import "server-only";
import sharp from "sharp";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 16_000_000;
const MAX_OUTPUT_SIDE = 2_048;

export function validateImageBytes(bytes: Uint8Array) {
  if (!bytes.length || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("La imagen debe pesar hasta 5 MB.");
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webp) throw new Error("El archivo no es una imagen JPG, PNG o WebP válida.");
}

/** Decodes and writes a new WebP, removing metadata and bounding decoded pixels. */
export async function sanitizeJournalImage(bytes: Uint8Array) {
  try {
    const source = sharp(bytes, { animated: false, failOn: "error", limitInputPixels: MAX_INPUT_PIXELS });
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height) throw new Error("No pudimos leer las dimensiones de la imagen.");
    if (metadata.width * metadata.height > MAX_INPUT_PIXELS) throw new Error("La imagen supera el máximo de 16 megapíxeles.");
    const output = await source.rotate().resize({ width: MAX_OUTPUT_SIDE, height: MAX_OUTPUT_SIDE, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
    if (!output.length || output.byteLength > MAX_IMAGE_BYTES) throw new Error("No pudimos optimizar la imagen dentro del límite de 5 MB.");
    return { bytes: new Uint8Array(output), extension: "webp", mimeType: "image/webp" };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("La imagen")) throw error;
    throw new Error("No pudimos procesar esta imagen. Elegí un archivo JPG, PNG o WebP válido.");
  }
}
