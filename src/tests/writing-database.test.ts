// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  writingSnapshotSchema,
  type WritingAction,
  type WritingSnapshot,
} from "../types/writing";
import { issuePrompts } from "../data/writing";
let db: PGlite, s: WritingSnapshot;
const A = "71000000-0000-4000-8000-000000000001",
  B = "71000000-0000-4000-8000-000000000002",
  id = crypto.randomUUID();
async function login(user: string) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
}
async function action(a: WritingAction) {
  const r = await db.query<{ s: unknown }>(
    "select public.writing_action($1::jsonb) s",
    [JSON.stringify(a)],
  );
  return writingSnapshotSchema.parse(r.rows[0].s);
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to public;`,
  );
  for (const file of [
    "202611020001_foundation.sql",
    "202611020002_daily_learning.sql",
    "202611020003_vocabulary.sql",
    "202611020004_practice.sql",
    "202611030005_writing.sql",
  ])
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  for (const file of ["seed.sql", "questions-seed.sql", "writing-seed.sql"])
    await db.exec(await readFile("supabase/" + file, "utf8"));
  await db.exec(
    `insert into auth.users(id,email) values('${A}','a@example.invalid'),('${B}','b@example.invalid');insert into public.user_settings(user_id,display_name) values('${A}','A'),('${B}','B');`,
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("Phase 5 PostgreSQL writing boundary", () => {
  it("seeds original prompts exactly and starts with authoritative timer/date", async () => {
    await login(A);
    const prompts = await db.query<{ id: string; prompt: string }>(
      "select id,prompt from public.writing_prompts",
    );
    expect(prompts.rows).toHaveLength(4);
    for (const p of issuePrompts)
      expect(prompts.rows.find((r) => r.id === p.id)?.prompt).toBe(p.prompt);
    s = await action({ kind: "start", id, promptId: "public-spaces" });
    const d = s.documents[0];
    expect(d.body).toBe("");
    expect(Date.parse(d.deadline_at) - Date.parse(d.started_at)).toBe(1800000);
    expect(
      (await action({ kind: "start", id, promptId: "public-spaces" }))
        .documents,
    ).toEqual(s.documents);
    await expect(
      action({ kind: "start", id, promptId: "learning-failure" }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("saves and replays identical requests, detects competing revisions and text limits", async () => {
    const a = {
      kind: "save" as const,
      id,
      requestId: crypto.randomUUID(),
      revision: 0,
      body: "Public libraries improve access to information.",
      notes: "Find an example.",
    };
    s = await action(a);
    expect(s.documents[0].revision).toBe(1);
    expect((await action(a)).documents).toEqual(s.documents);
    await expect(action({ ...a, body: "Other tab" })).rejects.toThrow(
      "STALE_REVISION",
    );
    await expect(
      action({ ...a, revision: 1, body: "x".repeat(60001) }),
    ).rejects.toThrow("INVALID_TEXT");
  });
  it("allows saving after deadline and on a later calendar day without losing the draft", async () => {
    await db.exec("reset role");
    await db.query(
      "update public.writing_submissions set deadline_at=clock_timestamp()-interval '1 hour',local_date='2026-01-01' where id=$1",
      [id],
    );
    await login(A);
    s = await action({
      kind: "save",
      id,
      requestId: crypto.randomUUID(),
      revision: 1,
      body: "Overtime conclusion.",
      notes: "Self review",
    });
    expect(s.documents[0].body).toBe("Overtime conclusion.");
    expect(s.documents[0].local_date).toBe("2026-01-01");
  });
  it("finishes only nonempty English essays and keeps completed text immutable, notes editable", async () => {
    await expect(
      action({
        kind: "finish",
        id,
        requestId: crypto.randomUUID(),
        revision: 2,
        body: "!!!",
        notes: "",
      }),
    ).rejects.toThrow("EMPTY_ESSAY");
    const a = {
      kind: "finish" as const,
      id,
      requestId: crypto.randomUUID(),
      revision: 2,
      body: "A supported conclusion.",
      notes: "Revisit counterargument.",
    };
    s = await action(a);
    expect(s.documents[0].completed_at).not.toBeNull();
    expect((await action(a)).documents).toEqual(s.documents);
    await expect(
      action({ ...a, kind: "save", revision: 3, body: "Rewrite history" }),
    ).rejects.toThrow("DOCUMENT_COMPLETED");
    s = await action({
      ...a,
      kind: "save",
      revision: 3,
      notes: "New revision note.",
    });
    expect(s.documents[0].notes).toBe("New revision note.");
  });
  it("isolates essays and rejects direct writes/private helpers/anonymous RPC", async () => {
    await login(B);
    expect((await action({ kind: "ensure" })).documents).toHaveLength(0);
    expect(
      (await db.query("select * from public.writing_submissions")).rows,
    ).toHaveLength(0);
    await expect(
      action({
        kind: "save",
        id,
        requestId: crypto.randomUUID(),
        revision: 4,
        body: "Steal",
        notes: "",
      }),
    ).rejects.toThrow("DOCUMENT_NOT_FOUND");
    await expect(
      db.query("select public.writing_document($1)", [id]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("update public.writing_submissions set body=$1 where id=$2", [
        "hack",
        id,
      ]),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role;set role anon");
    await expect(action({ kind: "ensure" })).rejects.toThrow(
      /permission denied/,
    );
  });
  it("reserves AI allowance only for own completed essay and rate-limits retries", async () => {
    await login(B);
    await expect(
      db.query("select public.writing_feedback_reserve($1,4)", [id]),
    ).rejects.toThrow("COMPLETED_ESSAY_REQUIRED");
    await login(A);
    const r = await db.query<{ d: unknown }>(
      "select public.writing_feedback_reserve($1,4) d",
      [id],
    );
    expect(r.rows[0].d).toMatchObject({
      body: "A supported conclusion.",
      revision: 4,
    });
    await expect(
      db.query("select public.writing_feedback_reserve($1,4)", [id]),
    ).rejects.toThrow("FEEDBACK_RATE_LIMIT");
    await expect(
      db.exec("select * from public.writing_feedback_usage"),
    ).rejects.toThrow(/permission denied/);
    for (let n = 0; n < 2; n++) {
      await db.exec(
        "reset role;update public.writing_feedback_usage set last_requested_at=clock_timestamp()-interval '61 seconds'",
      );
      await login(A);
      await db.query("select public.writing_feedback_reserve($1,4)", [id]);
    }
    await db.exec(
      "reset role;update public.writing_feedback_usage set last_requested_at=clock_timestamp()-interval '61 seconds'",
    );
    await login(A);
    await expect(
      db.query("select public.writing_feedback_reserve($1,4)", [id]),
    ).rejects.toThrow("FEEDBACK_RATE_LIMIT");
  });
  it("only the server role can store bounded feedback without a score", async () => {
    const feedback = {
      structure: "Claim",
      logic: "Reasons",
      language: "Clarity",
      grammar: "Tense",
      revision: "Example rewrite.",
    };
    await expect(
      db.query("select public.writing_feedback_store($1,$2,4,$3::jsonb)", [
        A,
        id,
        JSON.stringify(feedback),
      ]),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role;set role service_role");
    await expect(
      db.query("select public.writing_feedback_store($1,$2,4,$3::jsonb)", [
        A,
        id,
        JSON.stringify({ ...feedback, score: 6 }),
      ]),
    ).rejects.toThrow("INVALID_FEEDBACK");
    await expect(
      db.query("select public.writing_feedback_store($1,$2,5,$3::jsonb)", [
        A,
        id,
        JSON.stringify(feedback),
      ]),
    ).rejects.toThrow("STALE_REVISION");
    await db.query("select public.writing_feedback_store($1,$2,4,$3::jsonb)", [
      A,
      id,
      JSON.stringify(feedback),
    ]);
    await login(A);
    expect((await action({ kind: "ensure" })).documents[0].ai_feedback).toEqual(
      feedback,
    );
    await login(B);
    expect((await action({ kind: "ensure" })).documents).toHaveLength(0);
  });
  it("new writing leaves practice, vocabulary and daily records available through existing RPCs", async () => {
    await login(A);
    for (const name of ["study_action", "practice_action", "vocab_action"]) {
      const r = await db.query<{ s: unknown }>(
        `select public.${name}('{"kind":"ensure"}') s`,
      );
      expect(r.rows[0].s).toBeTruthy();
    }
    expect((await action({ kind: "ensure" })).documents[0].body).toBe(
      "A supported conclusion.",
    );
  });
});
