/**
 * lib/resize-image.ts — shrink a photo in the BROWSER before uploading it (KQ-17).
 *
 * Why in the browser: a phone photo is often 4000×3000 and 5–8 MB. Uploading that from a lecture
 * hall's Wi-Fi is slow, and 150 phones downloading it would be worse. Resizing here costs nothing on
 * the server (and the free tier has no image processing).
 *
 * How: decode the file (createImageBitmap), draw it smaller on a <canvas>, export as JPEG.
 * `imageOrientation: "from-image"` keeps portrait phone photos upright (EXIF rotation).
 */
import { fitWithin } from "@/lib/question-image";

const TARGET_BYTES = 450 * 1024; // acceptance criterion: well under 500 KB

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
}

export async function resizeImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.fillStyle = "#fff"; // transparent PNGs get a white background instead of black
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Try good quality first; busy photos (lots of detail) may need a second, lower pass.
  for (const quality of [0.82, 0.7, 0.55]) {
    const blob = await toJpeg(canvas, quality);
    if (blob.size <= TARGET_BYTES || quality === 0.55) return blob;
  }
  throw new Error("unreachable");
}
