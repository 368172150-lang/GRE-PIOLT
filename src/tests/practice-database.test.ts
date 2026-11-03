// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  practiceSnapshotSchema,
  type PracticeAction,
  type PracticeSnapshot,
} from "../types/practice";
import { originalQuestions, originalSolutions } from "../data/questions";
import { gradeAnswer } from "../algorithms/grading";
import { snapshotSchema } from "../types/study";
let db: PGlite;
const A = "60000000-0000-4000-8000-000000000001",
  B = "60000000-0000-4000-8000-000000000002";
const q = (n: number) =>
  originalQuestions.find((q) => q.id.endsWith(String(n).padStart(12, "0")))!;
let snapshot: PracticeSnapshot;
async function login(id: string) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function action(input: PracticeAction) {
  const r = await db.query<{ state: unknown }>(
    "select public.practice_action($1::jsonb) as state",
    [JSON.stringify(input)],
  );
  return practiceSnapshotSchema.parse(r.rows[0].state);
}
async function start(id = q(13).id, minutes: number | null = null) {
  const v = await action({ kind: "ensure" });
  return action({
    kind: "start",
    id: crypto.randomUUID(),
    date: v.today,
    module: q(Number(id.slice(-12))).module,
    count: 1,
    minutes,
    filter: { questionId: id },
  });
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
    "202611020004_practice.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.exec(await readFile("supabase/seed.sql", "utf8"));
  await db.exec(await readFile("supabase/questions-seed.sql", "utf8"));
  await db.exec(
    `insert into auth.users(id,email) values('${A}','a@example.invalid'),('${B}','b@example.invalid');insert into public.user_settings(user_id,display_name) values('${A}','A'),('${B}','B');`,
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("Phase 4 PostgreSQL grading and ownership", () => {
  it("seeds 28 questions with separate solutions and returns no unattempted feedback", async () => {
    await db.exec(await readFile("supabase/questions-seed.sql", "utf8"));
    await login(A);
    snapshot = await action({ kind: "ensure" });
    expect(snapshot.questions).toEqual(originalQuestions);
    expect(snapshot.attempts).toHaveLength(0);
    await expect(
      db.exec("select * from public.question_solutions"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.practice_question($1)", [q(1).id]),
    ).rejects.toThrow(/permission denied/);
  });
  it("matches TypeScript grading for every original correct answer and valid wrong answers", async () => {
    await db.exec("reset role");
    for (const question of originalQuestions) {
      const solution = originalSolutions[question.id];
      const inputs = [solution.answer];
      if (question.format === "numeric") inputs.push({ numeric: "-999" });
      else if (question.format === "blanks")
        inputs.push({
          blanks: question.options
            .filter((o) => o.blank_index === 0)
            .slice(0, 1)
            .map((o) => o.key)
            .concat((solution.answer.blanks ?? []).slice(1)),
        });
      else
        inputs.push({
          choices: question.options
            .slice(0, question.selection_count)
            .map((o) => o.key),
        });
      for (const answer of inputs) {
        const r = await db.query<{ correct: boolean }>(
          "select public.practice_grade($1::jsonb,$2::jsonb,$3::jsonb) correct",
          [
            JSON.stringify(question),
            JSON.stringify(solution),
            JSON.stringify(answer),
          ],
        );
        expect(r.rows[0].correct).toBe(gradeAnswer(question, solution, answer));
      }
    }
    const question = q(14),
      solution = originalSolutions[question.id];
    for (const value of ["0.1", "1/10", "2/20", "+.10", "\t0.1\n"]) {
      const r = await db.query<{ correct: boolean }>(
        "select public.practice_grade($1::jsonb,$2::jsonb,$3::jsonb) correct",
        [
          JSON.stringify(question),
          JSON.stringify(solution),
          JSON.stringify({ numeric: value }),
        ],
      );
      expect(r.rows[0].correct).toBe(true);
    }
    for (const value of ["1/0", "v1", "1e3", "1+1"])
      await expect(
        db.query("select public.practice_number($1)", [value]),
      ).rejects.toThrow("INVALID_NUMBER");
  });
  it("server-grades submissions, records wrong answers once and ignores fake correctness fields", async () => {
    await login(A);
    snapshot = await start();
    const session = snapshot.sessions.at(-1)!;
    const request: PracticeAction = {
      kind: "submit",
      id: crypto.randomUUID(),
      date: snapshot.today,
      sessionId: session.id,
      questionId: q(13).id,
      revision: 1,
      answer: { choices: ["A"] },
    };
    const raw = { ...request, is_correct: true, elapsed_seconds: 999999 };
    let r = await db.query<{ state: unknown }>(
      "select public.practice_action($1::jsonb) state",
      [JSON.stringify(raw)],
    );
    snapshot = practiceSnapshotSchema.parse(r.rows[0].state);
    expect(snapshot.attempts[0]).toMatchObject({
      is_correct: false,
      answer: { choices: ["A"] },
    });
    expect(snapshot.attempts[0].elapsed_seconds).toBeLessThan(60);
    r = await db.query<{ state: unknown }>(
      "select public.practice_action($1::jsonb) state",
      [JSON.stringify(raw)],
    );
    expect(practiceSnapshotSchema.parse(r.rows[0].state).attempts).toHaveLength(
      1,
    );
    expect(snapshot.mistakes).toHaveLength(1);
    expect(snapshot.mistakes[0].frequency).toBe(1);
  });
  it("reuses one mistake row, preserves initial answers, and updates notes under a revision guard", async () => {
    await login(A);
    snapshot = await start();
    snapshot = await action({
      kind: "submit",
      id: crypto.randomUUID(),
      date: snapshot.today,
      sessionId: snapshot.sessions.at(-1)!.id,
      questionId: q(13).id,
      revision: 1,
      answer: { choices: ["B"] },
    });
    expect(snapshot.mistakes).toHaveLength(1);
    const mistake = snapshot.mistakes[0];
    expect(mistake).toMatchObject({
      frequency: 2,
      wrong_answer: { choices: ["A"] },
      last_wrong_answer: { choices: ["B"] },
    });
    snapshot = await action({
      kind: "mistake",
      date: snapshot.today,
      mistakeId: mistake.id,
      revision: mistake.revision,
      reason: "I omitted sales tax.",
      mastered: true,
    });
    expect(snapshot.mistakes[0].reviewed_on).toBe(snapshot.today);
    await expect(
      action({
        kind: "mistake",
        date: snapshot.today,
        mistakeId: mistake.id,
        revision: mistake.revision,
        reason: "old",
        mastered: false,
      }),
    ).rejects.toThrow("STALE_MISTAKE");
    const r = await db.query<{ state: unknown }>(
      `select public.study_action('{"kind":"ensure"}') state`,
    );
    expect(
      snapshotSchema
        .parse(r.rows[0].state)
        .tasks.find((t) => t.task_key === "mistakes")?.completion_source,
    ).toBe("automatic");
  });
  it("enforces deadlines, question order and date boundaries in the server", async () => {
    await login(A);
    snapshot = await start(q(14).id, 1);
    const session = snapshot.sessions.at(-1)!;
    await expect(
      action({
        kind: "submit",
        id: crypto.randomUUID(),
        date: snapshot.today,
        sessionId: session.id,
        questionId: q(16).id,
        revision: 1,
        answer: { numeric: "5" },
      }),
    ).rejects.toThrow("QUESTION_ORDER");
    await expect(
      action({
        kind: "submit",
        id: crypto.randomUUID(),
        date: "2001-01-01",
        sessionId: session.id,
        questionId: q(14).id,
        revision: 1,
        answer: { numeric: "0.1" },
      }),
    ).rejects.toThrow("DAY_CHANGED");
    await db.exec("reset role");
    await db.query(
      "update public.practice_sessions set deadline_at=clock_timestamp()-interval '1 second' where id=$1",
      [session.id],
    );
    await login(A);
    await expect(
      action({
        kind: "submit",
        id: crypto.randomUUID(),
        date: snapshot.today,
        sessionId: session.id,
        questionId: q(14).id,
        revision: 1,
        answer: { numeric: "0.1" },
      }),
    ).rejects.toThrow("SESSION_EXPIRED");
  });
  it("isolates accounts, rejects forged sessions/mistakes and keeps bookmarks private", async () => {
    await login(A);
    snapshot = await action({
      kind: "favorite",
      questionId: q(13).id,
      value: true,
    });
    const aSession = snapshot.sessions[0],
      mistake = snapshot.mistakes[0];
    await login(B);
    const b = await action({ kind: "ensure" });
    expect(b.sessions).toHaveLength(0);
    expect(b.attempts).toHaveLength(0);
    expect(b.mistakes).toHaveLength(0);
    expect(b.bookmarks).toHaveLength(0);
    await expect(
      action({ kind: "end", sessionId: aSession.id }),
    ).rejects.toThrow("SESSION_NOT_FOUND");
    await expect(
      action({
        kind: "submit",
        id: crypto.randomUUID(),
        date: b.today,
        sessionId: aSession.id,
        questionId: q(13).id,
        revision: 1,
        answer: { choices: ["C"] },
      }),
    ).rejects.toThrow("SESSION_NOT_FOUND");
    await expect(
      action({
        kind: "mistake",
        date: b.today,
        mistakeId: mistake.id,
        revision: mistake.revision,
        reason: "steal",
        mastered: true,
      }),
    ).rejects.toThrow("MISTAKE_NOT_FOUND");
    expect(
      (
        await db.query(
          "select * from public.practice_attempts where user_id=$1",
          [A],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.exec("update public.practice_attempts set is_correct=true"),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role;set role anon");
    await expect(action({ kind: "ensure" })).rejects.toThrow(
      /permission denied/,
    );
  });
  it("counts distinct practice questions, updates both module statistics and preserves checked plans", async () => {
    await login(A);
    snapshot = await action({ kind: "ensure" });
    for (const module of ["quant", "verbal"] as const) {
      snapshot = await action({
        kind: "start",
        id: crypto.randomUUID(),
        date: snapshot.today,
        module,
        count: 20,
        minutes: null,
        filter: {},
      });
      const session = snapshot.sessions.at(-1)!;
      for (const id of session.question_ids)
        snapshot = await action({
          kind: "submit",
          id: crypto.randomUUID(),
          date: snapshot.today,
          sessionId: session.id,
          questionId: id,
          revision: 1,
          answer: originalSolutions[id].answer,
        });
    }
    const r = await db.query<{ state: unknown }>(
      `select public.study_action('{"kind":"ensure"}') state`,
    );
    const study = snapshotSchema.parse(r.rows[0].state);
    expect(
      study.tasks.find((t) => t.task_key === "quant")?.completion_source,
    ).toBe("automatic");
    expect(
      study.tasks.find((t) => t.task_key === "verbal")?.completion_source,
    ).toBe("automatic");
    expect(study.signals.quant).toMatchObject({
      attempts: 18,
      correct: 16,
      weakType: "single_choice",
    });
    expect(study.signals.verbal).toMatchObject({ attempts: 12, correct: 12 });
    expect(study.events).toHaveLength(0);
    let checked = study;
    for (const task of checked.tasks.filter(
      (t) =>
        t.local_date === checked.today &&
        !t.completed_at &&
        t.task_key !== "focus",
    )) {
      const r = await db.query<{ state: unknown }>(
        "select public.study_action($1::jsonb) state",
        [
          JSON.stringify({
            kind: "toggle",
            date: checked.today,
            taskId: task.id,
            completed: true,
          }),
        ],
      );
      checked = snapshotSchema.parse(r.rows[0].state);
    }
    let r2 = await db.query<{ state: unknown }>(
      "select public.study_action($1::jsonb) state",
      [
        JSON.stringify({
          kind: "log",
          date: checked.today,
          id: crypto.randomUUID(),
          minutes: 60,
          note: "test fixture",
        }),
      ],
    );
    checked = snapshotSchema.parse(r2.rows[0].state);
    r2 = await db.query<{ state: unknown }>(
      "select public.study_action($1::jsonb) state",
      [JSON.stringify({ kind: "checkin", date: checked.today })],
    );
    checked = snapshotSchema.parse(r2.rows[0].state);
    expect(checked.checkins).toHaveLength(1);
    const previous = checked.tasks;
    snapshot = await start();
    snapshot = await action({
      kind: "submit",
      id: crypto.randomUUID(),
      date: snapshot.today,
      sessionId: snapshot.sessions.at(-1)!.id,
      questionId: q(13).id,
      revision: 1,
      answer: { choices: ["A"] },
    });
    r2 = await db.query<{ state: unknown }>(
      `select public.study_action('{"kind":"ensure"}') state`,
    );
    expect(snapshotSchema.parse(r2.rows[0].state).tasks).toEqual(previous);
  });
  it("keeps draft AI-assisted questions out of the visible bank and blocks private grader calls", async () => {
    await db.exec("reset role");
    const draft = {
      ...q(13),
      id: crypto.randomUUID(),
      review_status: "draft",
      source: "ai-import:pending",
    };
    await db.query(
      "insert into public.questions(id,module,question_type,difficulty,prompt,source,review_status,content) values($1,'quant','single_choice',2,$2,$3,'draft',$4::jsonb)",
      [draft.id, draft.prompt, draft.source, JSON.stringify(draft)],
    );
    await db.query(
      "insert into public.question_solutions(question_id,solution) values($1,$2::jsonb)",
      [draft.id, JSON.stringify(originalSolutions[q(13).id])],
    );
    await login(B);
    snapshot = await action({ kind: "ensure" });
    expect(snapshot.questions.some((q) => q.id === draft.id)).toBe(false);
    expect(
      (await db.query("select * from public.questions where id=$1", [draft.id]))
        .rows,
    ).toHaveLength(0);
    await expect(
      action({
        kind: "start",
        id: crypto.randomUUID(),
        date: snapshot.today,
        module: "quant",
        count: 1,
        minutes: null,
        filter: { questionId: draft.id },
      }),
    ).rejects.toThrow("NO_QUESTIONS");
    await expect(
      db.query("select public.practice_grade($1::jsonb,$2::jsonb,$3::jsonb)", [
        JSON.stringify(q(13)),
        JSON.stringify(originalSolutions[q(13).id]),
        JSON.stringify({ choices: ["C"] }),
      ]),
    ).rejects.toThrow(/permission denied/);
  });
});
