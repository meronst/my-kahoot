/**
 * tests/integration/question-images.test.ts — who may upload question images (KQ-17).
 * Storage access is RLS on storage.objects: hosts write only into folders of quizzes they own;
 * everyone can read (public bucket).
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { admin, anonymousPlayer, DEMO_HOST, DEMO_QUIZ_ID, signedIn } from "./clients";
import { localSupabase } from "./supabase-env";

const BUCKET = "question-images";
// A 1×1 JPEG is enough: the database doesn't look inside the file.
const tinyJpeg = () =>
  new Blob([Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64")], { type: "image/jpeg" });

describe("question images (storage)", () => {
  it("the host uploads into their quiz's folder, anyone can read it, and a question can use it", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const path = `${DEMO_QUIZ_ID}/${randomUUID()}.jpg`;
    const { error } = await host.storage.from(BUCKET).upload(path, tinyJpeg(), { contentType: "image/jpeg" });
    expect(error).toBeNull();

    const res = await fetch(`${localSupabase().url}/storage/v1/object/public/${BUCKET}/${path}`);
    expect(res.status).toBe(200);

    expect((await host.storage.from(BUCKET).remove([path])).error).toBeNull();
    const gone = await fetch(`${localSupabase().url}/storage/v1/object/public/${BUCKET}/${path}`);
    expect(gone.status).not.toBe(200);
  });

  it("refuses uploads outside a quiz the host owns, and from players", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const notMine = await host.storage.from(BUCKET).upload(`${randomUUID()}/${randomUUID()}.jpg`, tinyJpeg(), { contentType: "image/jpeg" });
    expect(notMine.error).not.toBeNull();

    const { client: player } = await anonymousPlayer();
    const fromPlayer = await player.storage.from(BUCKET).upload(`${DEMO_QUIZ_ID}/${randomUUID()}.jpg`, tinyJpeg(), { contentType: "image/jpeg" });
    expect(fromPlayer.error).not.toBeNull();

    const email = `host-img-${Date.now()}@my-kahoot.local`;
    await admin().auth.admin.createUser({ email, password: "host-img-pw", email_confirm: true, app_metadata: { role: "host" } });
    const other = await signedIn(email, "host-img-pw");
    const otherHost = await other.storage.from(BUCKET).upload(`${DEMO_QUIZ_ID}/${randomUUID()}.jpg`, tinyJpeg(), { contentType: "image/jpeg" });
    expect(otherHost.error).not.toBeNull();
  });

  it("refuses files that aren't images", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { error } = await host.storage.from(BUCKET)
      .upload(`${DEMO_QUIZ_ID}/${randomUUID()}.jpg`, new Blob(["hello"], { type: "text/plain" }), { contentType: "text/plain" });
    expect(error).not.toBeNull();
  });

  it("the question shown to players carries the image path", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: copy } = await host.rpc("duplicate_quiz", { p_quiz_id: DEMO_QUIZ_ID });
    const { data: first } = await host.from("rounds").select("questions(id, position)").eq("quiz_id", copy!.id).eq("position", 0).single();
    const qid = first!.questions.sort((a, b) => a.position - b.position)[0].id;
    await host.from("questions").update({ image_path: `${copy!.id}/pic.jpg` }).eq("id", qid);

    const { data: session } = await host.rpc("create_session", { p_quiz_id: copy!.id });
    const { data: started, error } = await host.rpc("start_session", { p_session_id: session!.id });
    expect(error).toBeNull();
    expect((started!.question_payload as { image_path: string }).image_path).toBe(`${copy!.id}/pic.jpg`);
  });
});
