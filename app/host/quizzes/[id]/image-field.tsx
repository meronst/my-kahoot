/**
 * app/host/quizzes/[id]/image-field.tsx — add, replace or remove a question's image (KQ-17).
 *
 * The upload goes straight from the browser to Supabase Storage (not through our Next.js server):
 * the host's login cookie travels with it, and the Storage policy checks they own the quiz folder.
 * Steps: pick file → resize in the browser → upload → tell the server the new path (setQuestionImage).
 */
"use client";

import { useState, useTransition } from "react";
import { QuestionImage } from "@/components/question-image";
import { IMAGE_BUCKET, newImagePath } from "@/lib/question-image";
import { resizeImage } from "@/lib/resize-image";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { t } from "@/strings/he";
import { setQuestionImage } from "./actions";

const button = "rounded-md border border-current/30 px-2 py-1 text-sm";

export function ImageField({ quizId, questionId, path }: { quizId: string; questionId: string; path: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t.editor.image.notImage);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await resizeImage(file);
      const newPath = newImagePath(quizId, crypto.randomUUID());
      const { error: uploadError } = await getSupabaseBrowserClient()
        .storage.from(IMAGE_BUCKET)
        .upload(newPath, blob, { contentType: "image/jpeg", cacheControl: "31536000" }); // name never changes
      if (uploadError) throw uploadError;
      const result = await setQuestionImage(questionId, newPath);
      if (result.error) throw new Error(result.error);
    } catch {
      setError(t.editor.image.failed);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    startTransition(async () => {
      const result = await setQuestionImage(questionId, null);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span>{t.editor.image.label}</span>
      {path && <QuestionImage path={path} testId="editor-image" className="max-h-40 self-start" />}
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${button} cursor-pointer`}>
          {path ? t.editor.image.replace : t.editor.image.add}
          <input
            type="file"
            accept="image/*"
            data-testid="image-input"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              void onFile(e.currentTarget.files?.[0]);
              e.currentTarget.value = ""; // allow picking the same file again
            }}
          />
        </label>
        {path && !busy && (
          <button type="button" data-testid="image-remove" onClick={remove} className={button}>{t.editor.image.remove}</button>
        )}
        {busy && <span data-testid="image-uploading">{t.editor.image.uploading}</span>}
        {error && <span role="alert" data-testid="image-error" className="text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </div>
  );
}
