/**
 * lib/question-image.ts — where question images live and how big they may be (KQ-17).
 * Pure helpers, used by the server, the browser and the unit tests.
 */
import { supabaseEnv } from "@/lib/supabase/env";

export const IMAGE_BUCKET = "question-images";
/** Longest side after resizing: sharp on a projector, small enough for a phone on mobile data. */
export const MAX_IMAGE_SIDE = 1600;

/**
 * Scales (width, height) down to fit inside a max×max square, keeping the proportions.
 * Never scales up: a small image stays as it is.
 */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Storage path for a new upload: a folder per quiz (the upload policy checks it) + a random name. */
export function newImagePath(quizId: string, randomId: string): string {
  return `${quizId}/${randomId}.jpg`;
}

/** Public URL of an image in the bucket. The bucket is public-read, so no login is needed. */
export function imageUrl(path: string): string {
  return `${supabaseEnv().url}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
}
