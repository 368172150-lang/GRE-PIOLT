// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  vocabSnapshotSchema,
  initialProgress,
  type VocabSnapshot,
  type VocabAction,
} from "../types/vocabulary";
import { snapshotSchema } from "../types/study";
import { scheduleReview } from "../algorithms/sm2";
import { originalWords } from "../data/vocabulary";
import { importCsv } from "../algorithms/csv";
let db: PGlite;
const A = "40000000-0000-4000-8000-000000000001",
  B = "40000000-0000-4000-8000-000000000002";
let current: VocabSnapshot;
async function login(id: string) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function action(input: VocabAction) {
  const r = await db.query<{ state: unknown }>(
    "select public.vocab_action($1::jsonb) as state",
    [JSON.stringify(input)],
  );
  return vocabSnapshotSchema.parse(r.rows[0].state);
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to public;`,
  );
  for (const file of [
    "202611020001_foundation.sql",
    "202611020002_daily_learning.sql",
    "202611020003_vocabulary.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.exec(await readFile("supabase/seed.sql", "utf8"));
  await db.exec(
    `insert into auth.users(id,email) values('${A}','a@example.invalid'),('${B}','b@example.invalid');insert into public.user_settings(user_id,display_name,new_words) values('${A}','A',1),('${B}','B',1);`,
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("Phase 3 PostgreSQL vocabulary integration", () => {
  it("loads actual seed and is safe to reseed without learning activity", async () => {
    await db.exec(await readFile("supabase/seed.sql", "utf8"));
    await login(A);
    current = await action({ kind: "ensure" });
    expect(current.words).toHaveLength(24);
    expect(current.progress).toHaveLength(0);
    expect(current.reviews).toHaveLength(0);
    for (const word of current.words) {
      const original = originalWords.find((w) => w.id === word.id);
      expect(word).toEqual(original);
    }
  });
  it("exposes the frozen daily word target rather than exceeding the time budget", async () => {
    await login(B);
    await db.query(
      "update public.user_settings set daily_minutes=30,new_words=100 where user_id=$1",
      [B],
    );
    let v = await action({ kind: "ensure" });
    expect(v.new_word_target).toBe(9);
    await db.query("select public.study_action($1::jsonb)", [
      JSON.stringify({ kind: "ensure" }),
    ]);
    await db.query(
      "update public.user_settings set daily_minutes=60,new_words=1 where user_id=$1",
      [B],
    );
    v = await action({ kind: "ensure" });
    expect(v.new_word_target).toBe(9);
    await db.query("select public.study_action($1::jsonb)", [
      JSON.stringify({ kind: "replan", date: v.today }),
    ]);
    expect((await action({ kind: "ensure" })).new_word_target).toBe(1);
  });
  it("matches TypeScript SM-2 for all grades and critical rounding cases", async () => {
    await db.exec("reset role");
    for (const reps of [0, 1, 2, 3, 10])
      for (const interval of [0, 6, 25, 365])
        for (const ease of [1.3, 2.2, 2.5])
          for (let q = 0; q <= 5; q++) {
            const p = {
              ...initialProgress(originalWords[0].id),
              repetitions: reps,
              interval_days: interval,
              ease_factor: ease,
            };
            const { lapses, ...expected } = scheduleReview(p, q, "2026-11-02");
            expect(lapses).toBe(q < 3 ? 1 : 0);
            const r = await db.query<{ step: unknown }>(
              "select public.vocab_sm2($1,$2,$3,$4,$5::date) as step",
              [reps, interval, ease, q, "2026-11-02"],
            );
            expect(r.rows[0].step).toEqual(expected);
          }
  });
  it("sets favorites without falsely marking learning", async () => {
    await login(A);
    current = await action({
      kind: "favorite",
      wordId: originalWords[0].id,
      value: true,
    });
    expect(current.progress[0]).toMatchObject({
      status: "new",
      favorite: true,
      revision: 0,
    });
  });
  it("server-grades spelling, deduplicates retries and completes the daily new-word task", async () => {
    await login(A);
    current = await action({ kind: "ensure" });
    const word = originalWords[0];
    const input: VocabAction = {
      kind: "review",
      id: crypto.randomUUID(),
      date: current.today,
      wordId: word.id,
      revision: 0,
      mode: "spelling",
      answer: ` ${word.word.toUpperCase()} `,
    };
    current = await action(input);
    expect(current.reviews[0]).toMatchObject({
      correct: true,
      quality: 4,
      kind: "new",
    });
    expect(current.progress[0]).toMatchObject({ repetitions: 1, revision: 1 });
    expect((await action(input)).reviews).toHaveLength(1);
    await expect(action({ ...input, answer: "other" })).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
    const result = await db.query<{ state: unknown }>(
      `select public.study_action('{"kind":"ensure"}') as state`,
    );
    const study = snapshotSchema.parse(result.rows[0].state);
    expect(
      study.tasks.find((t) => t.task_key === "new_words")?.completion_source,
    ).toBe("automatic");
    expect(study.events).toHaveLength(0);
  });
  it("rejects stale revisions and prevents correct extra practice from inflating intervals", async () => {
    await login(A);
    const word = originalWords[0];
    current = await action({ kind: "ensure" });
    await expect(
      action({
        kind: "review",
        id: crypto.randomUUID(),
        date: current.today,
        wordId: word.id,
        revision: 0,
        mode: "card",
        answer: "self-rating:5",
        quality: 5,
      }),
    ).rejects.toThrow("STALE_REVIEW");
    current = await action({
      kind: "review",
      id: crypto.randomUUID(),
      date: current.today,
      wordId: word.id,
      revision: 1,
      mode: "card",
      answer: "self-rating:5",
      quality: 5,
    });
    expect(
      current.progress.find((p) => p.vocabulary_id === word.id),
    ).toMatchObject({ repetitions: 1, revision: 2, interval_days: 1 });
    expect(current.reviews.at(-1)).toMatchObject({
      kind: "extra",
      scheduled: false,
    });
  });
  it("marks wrong choices and retains original answers regardless of supplied quiz quality", async () => {
    await login(A);
    current = await action({
      kind: "review",
      id: crypto.randomUUID(),
      date: current.today,
      wordId: originalWords[1].id,
      revision: 0,
      mode: "choice",
      answer: originalWords[2].id,
      quality: 5,
    });
    expect(current.reviews.at(-1)).toMatchObject({
      answer: originalWords[2].id,
      quality: 1,
      correct: false,
    });
    expect(
      current.progress.find((p) => p.vocabulary_id === originalWords[1].id)
        ?.status,
    ).toBe("learning");
  });
  it("imports private content, skips duplicates and isolates it from another account", async () => {
    await login(A);
    const content = importCsv(
      await readFile("public/vocabulary-template.csv", "utf8"),
    )[0];
    current = await action({
      kind: "import",
      words: [content, content],
      reviewed: true,
    });
    expect(current.imported).toBe(1);
    const personal = current.words.find((w) => w.word === "lucid")!;
    expect(personal.owner_id).toBe(A);
    expect(
      (await action({ kind: "import", words: [content], reviewed: true }))
        .imported,
    ).toBe(0);
    await login(B);
    const b = await action({ kind: "ensure" });
    expect(b.words).toHaveLength(24);
    expect(b.progress).toHaveLength(0);
    expect(b.reviews).toHaveLength(0);
    expect(
      (
        await db.query("select * from public.vocabulary where id=$1", [
          personal.id,
        ])
      ).rows,
    ).toHaveLength(0);
    await expect(
      action({ kind: "favorite", wordId: personal.id, value: true }),
    ).rejects.toThrow("WORD_NOT_FOUND");
    expect(
      (
        await db.query(
          "select * from public.vocabulary_reviews where user_id=$1",
          [A],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.exec("update public.vocabulary_progress set status='mastered'"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.study_action_phase2($1::jsonb)", [
        JSON.stringify({ kind: "ensure" }),
      ]),
    ).rejects.toThrow(/permission denied/);
  });
  it("allows two users to import the same spelling without sharing private rows", async () => {
    const content = importCsv(
      await readFile("public/vocabulary-template.csv", "utf8"),
    )[0];
    await login(A);
    const a = (await action({ kind: "ensure" })).words.find(
      (w) => w.word === "lucid",
    )!;
    await login(B);
    const b = (
      await action({ kind: "import", words: [content], reviewed: true })
    ).words.find((w) => w.word === "lucid")!;
    expect(b.owner_id).toBe(B);
    expect(a.id).not.toBe(b.id);
    await login(A);
    expect(
      (await action({ kind: "ensure" })).words.some((w) => w.id === b.id),
    ).toBe(false);
  });
  it("blocks malformed imports, unreviewed content, stale dates and anonymous writes", async () => {
    await login(B);
    const content = importCsv(
      await readFile("public/vocabulary-template.csv", "utf8"),
    )[0];
    await expect(
      db.query("select public.vocab_action($1::jsonb)", [
        JSON.stringify({ kind: "import", words: [content], reviewed: false }),
      ]),
    ).rejects.toThrow("IMPORT_REVIEW_REQUIRED");
    await expect(
      action({
        kind: "import",
        words: [{ ...content, word: "<script>" }],
        reviewed: true,
      }),
    ).rejects.toThrow("INVALID_CONTENT");
    await expect(
      action({
        kind: "review",
        id: crypto.randomUUID(),
        date: "2001-01-01",
        wordId: originalWords[0].id,
        revision: 0,
        mode: "card",
        answer: "self-rating:4",
        quality: 4,
      }),
    ).rejects.toThrow("DAY_CHANGED");
    await db.exec("reset role");
    await db.query(
      "insert into public.vocabulary(word,content,source,review_status) values('draft-fixture','{}','ai-generated','draft')",
    );
    await login(B);
    expect(
      (await action({ kind: "ensure" })).words.some(
        (w) => w.word === "draft-fixture",
      ),
    ).toBe(false);
    await db.exec("reset role;set role anon");
    await expect(action({ kind: "ensure" })).rejects.toThrow(
      /permission denied/,
    );
  });
  it("uses local due dates for review counts and task completion after lapse", async () => {
    await db.exec("reset role");
    await db.query(
      "update public.vocabulary_progress set due_date=(clock_timestamp() at time zone 'Asia/Kuala_Lumpur')::date-1 where user_id=$1 and vocabulary_id=$2",
      [B, originalWords[0].id],
    );
    await login(B);
    current = await action({ kind: "ensure" });
    if (!current.progress.length) {
      current = await action({
        kind: "review",
        id: crypto.randomUUID(),
        date: current.today,
        wordId: originalWords[0].id,
        revision: 0,
        mode: "card",
        answer: "self-rating:4",
        quality: 4,
      });
      await db.exec("reset role");
      await db.query(
        "update public.vocabulary_progress set due_date=$1::date-1 where user_id=$2",
        [current.today, B],
      );
      await login(B);
      current = await action({ kind: "ensure" });
    }
    let r = await db.query<{ state: unknown }>(
      `select public.study_action('{"kind":"replan","date":"${current.today}"}') as state`,
    );
    expect(snapshotSchema.parse(r.rows[0].state).signals.dueReviews).toBe(1);
    current = await action({
      kind: "review",
      id: crypto.randomUUID(),
      date: current.today,
      wordId: originalWords[0].id,
      revision: current.progress.find(
        (p) => p.vocabulary_id === originalWords[0].id,
      )!.revision,
      mode: "spelling",
      answer: "wrong",
    });
    expect(current.reviews.at(-1)?.kind).toBe("review");
    r = await db.query<{ state: unknown }>(
      `select public.study_action('{"kind":"ensure"}') as state`,
    );
    const study = snapshotSchema.parse(r.rows[0].state);
    expect(study.signals.dueReviews).toBe(0);
    expect(
      study.tasks.find((t) => t.task_key === "review_words")?.completion_source,
    ).toBe("automatic");
  });
  it("keeps Phase 2 check-in transactions and checked plans stable through the new wrapper", async () => {
    await login(B);
    const read = async (input: object) => {
      const result = await db.query<{ state: unknown }>(
        "select public.study_action($1::jsonb) as state",
        [JSON.stringify(input)],
      );
      return snapshotSchema.parse(result.rows[0].state);
    };
    let study = await read({ kind: "ensure" });
    for (const task of study.tasks.filter(
      (t) =>
        t.local_date === study.today &&
        t.task_key !== "focus" &&
        !t.completed_at,
    ))
      study = await read({
        kind: "toggle",
        date: study.today,
        taskId: task.id,
        completed: true,
      });
    study = await read({
      kind: "log",
      date: study.today,
      id: crypto.randomUUID(),
      minutes: 60,
      note: "integration test",
    });
    study = await read({ kind: "checkin", date: study.today });
    study = await read({ kind: "checkin", date: study.today });
    expect(study.checkins).toHaveLength(1);
    const before = study.tasks;
    const v = await action({ kind: "ensure" });
    await action({
      kind: "review",
      id: crypto.randomUUID(),
      date: v.today,
      wordId: originalWords[3].id,
      revision: 0,
      mode: "card",
      answer: "self-rating:4",
      quality: 4,
    });
    expect((await read({ kind: "ensure" })).tasks).toEqual(before);
    await expect(read({ kind: "replan", date: study.today })).rejects.toThrow(
      "DAY_LOCKED",
    );
  });
});
