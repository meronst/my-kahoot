/**
 * components/question-image.tsx — shows a question's image on the projector, the phone and in the editor.
 *
 * A plain <img>, not next/image: next/image would send every image through Vercel's optimizer (which
 * counts against the free plan) and the file is already resized when uploaded.
 */
import { imageUrl } from "@/lib/question-image";
import { t } from "@/strings/he";

export function QuestionImage({ path, className = "", testId }: { path: string; className?: string; testId?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- already resized at upload; see header comment
    <img src={imageUrl(path)} alt={t.editor.image.alt} data-testid={testId} className={`rounded-lg object-contain ${className}`} />
  );
}
