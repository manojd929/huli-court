import sharp from "sharp";

/** Stored Blob objects must not exceed this size (2.5 MB). */
export const LEAGUE_IMAGE_OUTPUT_MAX_BYTES = Math.floor(2.5 * 1024 * 1024);

export type NormalizeLeagueImageResult =
  { ok: true; buffer: Buffer } | { ok: false; reason: "decode_error" | "still_too_large" };

/**
 * Decodes common raster formats, applies EXIF rotation, resizes if needed,
 * and re-encodes as WebP until the output is at most {@link LEAGUE_IMAGE_OUTPUT_MAX_BYTES}.
 */
export async function normalizeLeagueImageForBlob(
  input: Buffer,
): Promise<NormalizeLeagueImageResult> {
  try {
    await sharp(input).rotate().metadata();
  } catch {
    return { ok: false, reason: "decode_error" };
  }

  let maxSide = 2560;
  let quality = 88;

  async function encode(): Promise<Buffer> {
    return sharp(input)
      .rotate()
      .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  }

  try {
    let buf = await encode();

    while (buf.byteLength > LEAGUE_IMAGE_OUTPUT_MAX_BYTES && quality > 38) {
      quality -= 6;
      buf = await encode();
    }

    while (buf.byteLength > LEAGUE_IMAGE_OUTPUT_MAX_BYTES && maxSide > 640) {
      maxSide = Math.floor(maxSide * 0.82);
      quality = Math.min(quality + 4, 88);
      buf = await encode();
    }

    while (buf.byteLength > LEAGUE_IMAGE_OUTPUT_MAX_BYTES && quality > 28) {
      quality -= 5;
      buf = await encode();
    }

    if (buf.byteLength > LEAGUE_IMAGE_OUTPUT_MAX_BYTES) {
      return { ok: false, reason: "still_too_large" };
    }

    return { ok: true, buffer: buf };
  } catch {
    return { ok: false, reason: "decode_error" };
  }
}
