// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { generatePlan } from "../algorithms/planner";
import {
  snapshotSchema,
  emptySignals,
  type StudySnapshot,
} from "../types/study";
import { defaults } from "../features/settings/schema";
let db: PGlite;
const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002";
async function login(id: string) {
  await db.exec(`reset role;set role authenticated;`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function action(value: object): Promise<StudySnapshot> {
  const result = await db.query<{ state: unknown }>(
    "select public.study_action($1::jsonb) as state",
    [JSON.stringify(value)],
  );
  return snapshotSchema.parse(result.rows[0].state);
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;
  // Minimal Supabase identity/roles shim; migration SQL is executed without modification.
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to public;`,
  );
  await db.exec(
    await readFile("supabase/migrations/202611020001_foundation.sql", "utf8"),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202611020002_daily_learning.sql",
      "utf8",
    ),
  );
  await db.exec(
    `insert into auth.users(id,email) values('${A}','a@example.invalid'),('${B}','b@example.invalid');insert into public.user_settings(user_id,display_name) values('${A}','A'),('${B}','B');`,
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL migrations, RPC and RLS (local PGlite)", () => {
  it("passes the standalone ownership regression script without modifying migration SQL", async () => {
    await db.exec("reset role");
    const sql = (
      await readFile("supabase/tests/ownership.sql", "utf8")
    ).replaceAll("10000000-", "20000000-");
    await db.exec(sql);
  });
  it("initializes an isolated daily plan and is idempotent", async () => {
    await login(A);
    const first = await action({ kind: "ensure" });
    const again = await action({ kind: "ensure" });
    expect(again).toEqual(first);
    expect(first.days).toHaveLength(1);
    expect(first.tasks.length).toBeGreaterThan(0);
    expect(first.events).toHaveLength(0);
    expect(first.signals.verbal.attempts).toBe(0);
  });
  it("matches TypeScript planning rules for time budgets and weakness signals", async () => {
    await db.exec("reset role");
    for (const budget of [30, 60, 90])
      for (const dueReviews of [0, 13, 300])
        for (const weak of [false, true]) {
          const signals = {
            ...emptySignals,
            dueReviews,
            quant: {
              attempts: weak ? 10 : 0,
              correct: weak ? 2 : 0,
              weakType: weak ? "numeric_entry" : null,
            },
          };
          const result = await db.query<{ plan: unknown }>(
            "select public.study_plan_spec($1,$2,$3::jsonb) as plan",
            [budget, 15, JSON.stringify(signals)],
          );
          expect(result.rows[0].plan).toEqual(
            generatePlan({ ...defaults, daily_minutes: budget }, signals),
          );
        }
  });
  it("rejects incomplete check-in, stale dates, forged completion and direct table writes", async () => {
    await login(A);
    const s = await action({ kind: "ensure" });
    await expect(action({ kind: "checkin", date: s.today })).rejects.toThrow(
      "TASKS_INCOMPLETE",
    );
    await expect(
      action({ kind: "note", date: "2001-01-01", note: "late" }),
    ).rejects.toThrow("DAY_CHANGED");
    await expect(
      action({
        kind: "toggle",
        date: s.today,
        taskId: s.tasks[0].id,
        completed: "true",
      }),
    ).rejects.toThrow("INVALID_COMPLETION");
    await expect(
      db.query("update public.daily_tasks set completed_at=now()"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query(
        "insert into public.study_events(id,user_id,local_date,minutes) values(gen_random_uuid(),$1,current_date,60)",
        [A],
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("logs once on retry, auto-completes focus, and checks in once", async () => {
    await login(A);
    let s = await action({ kind: "ensure" });
    const log = {
      kind: "log",
      date: s.today,
      id: crypto.randomUUID(),
      minutes: 60,
      note: "offline practice",
    };
    await action(log);
    s = await action(log);
    expect(s.events).toHaveLength(1);
    await expect(action({ ...log, minutes: 61 })).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
    expect(s.tasks.filter((t) => t.completed_at)).toHaveLength(1);
    expect(s.tasks.find((t) => t.task_key === "focus")?.completion_source).toBe(
      "automatic",
    );
    for (const task of s.tasks.filter((t) => t.task_key !== "focus"))
      s = await action({
        kind: "toggle",
        date: s.today,
        taskId: task.id,
        completed: true,
      });
    s = await action({ kind: "checkin", date: s.today });
    s = await action({ kind: "checkin", date: s.today });
    expect(s.checkins).toHaveLength(1);
    await expect(action({ kind: "replan", date: s.today })).rejects.toThrow(
      "DAY_LOCKED",
    );
    await expect(
      action({
        kind: "toggle",
        date: s.today,
        taskId: s.tasks[0].id,
        completed: false,
      }),
    ).rejects.toThrow("DAY_LOCKED");
  });
  it("isolates account B through RPC, RLS and helper ACLs", async () => {
    await login(A);
    const a = await action({ kind: "ensure" });
    await login(B);
    const b = await action({ kind: "ensure" });
    expect(b.events).toHaveLength(0);
    expect(b.checkins).toHaveLength(0);
    expect(b.tasks.some((t) => a.tasks.some((at) => at.id === t.id))).toBe(
      false,
    );
    expect(
      (
        await db.query("select * from public.study_events where user_id=$1", [
          A,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select * from public.daily_checkins where user_id=$1", [
          A,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.study_days where user_id=$1", [A]))
        .rows,
    ).toHaveLength(0);
    await expect(
      action({
        kind: "toggle",
        date: b.today,
        taskId: a.tasks[0].id,
        completed: true,
      }),
    ).rejects.toThrow("TASK_NOT_FOUND");
    await expect(
      db.query("select public.study_signals($1)", [A]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.study_plan_spec(60,15,$1)", [
        JSON.stringify(emptySignals),
      ]),
    ).rejects.toThrow(/permission denied/);
  });
  it("blocks anonymous and empty-identity callers", async () => {
    await db.exec("reset role;set role anon");
    await expect(action({ kind: "ensure" })).rejects.toThrow(
      /permission denied/,
    );
    await login("");
    await expect(action({ kind: "ensure" })).rejects.toThrow("AUTH_REQUIRED");
  });
  it("handles SQL date boundaries, DST and timezone-local plans", async () => {
    await db.exec("reset role");
    for (const [instant, tz, date] of [
      ["2026-11-02T15:59:59Z", "Asia/Kuala_Lumpur", "2026-11-02"],
      ["2026-11-02T16:00:00Z", "Asia/Kuala_Lumpur", "2026-11-03"],
      ["2026-11-01T05:30:00Z", "America/New_York", "2026-11-01"],
      ["2026-11-01T06:30:00Z", "America/New_York", "2026-11-01"],
      ["2026-03-08T07:01:00Z", "America/New_York", "2026-03-08"],
    ]) {
      const r = await db.query<{ date: string }>(
        "select public.study_local_date($1::timestamptz,$2)::text as date",
        [instant, tz],
      );
      expect(r.rows[0].date).toBe(date);
    }
    await login(B);
    const current = await action({ kind: "ensure" });
    await db.query(
      "update public.user_settings set timezone=$1 where user_id=$2",
      ["Pacific/Kiritimati", B],
    );
    const east = await action({ kind: "ensure" });
    await db.query(
      "update public.user_settings set timezone=$1 where user_id=$2",
      ["Pacific/Honolulu", B],
    );
    const west = await action({ kind: "ensure" });
    expect(east.today).not.toBe(west.today);
    expect(west.days.length).toBeGreaterThanOrEqual(2);
    await db.query(
      "update public.user_settings set timezone=$1 where user_id=$2",
      ["Asia/Kuala_Lumpur", B],
    );
    expect(
      (await action({ kind: "ensure" })).days.filter(
        (d) => d.local_date === current.today,
      ),
    ).toHaveLength(1);
  });
  it("derives due reviews, mastery, accuracy and weak types from actual owned records", async () => {
    await db.exec("reset role");
    const word = crypto.randomUUID(),
      verbal = crypto.randomUUID(),
      quant = crypto.randomUUID(),
      session = crypto.randomUUID();
    await db.query(
      "insert into public.vocabulary(id,word,review_status) values($1,'original-fixture','reviewed')",
      [word],
    );
    await db.query(
      "insert into public.vocabulary_progress(user_id,vocabulary_id,status,due_at) values($1,$2,'mastered',now()-interval '1 day')",
      [B, word],
    );
    await db.query(
      "insert into public.questions(id,module,question_type,difficulty,prompt,review_status) values($1,'verbal','text_completion',2,'Original fixture','reviewed'),($2,'quant','numeric_entry',2,'Original fixture','reviewed')",
      [verbal, quant],
    );
    await db.query(
      "insert into public.practice_sessions(id,user_id,module) values($1,$2,'quant')",
      [session, B],
    );
    for (let i = 0; i < 4; i++)
      await db.query(
        "insert into public.practice_attempts(user_id,session_id,question_id,answer,is_correct) values($1,$2,$3,'{}',$4)",
        [B, session, quant, i === 0],
      );
    for (let i = 0; i < 4; i++)
      await db.query(
        "insert into public.practice_attempts(user_id,session_id,question_id,answer,is_correct) values($1,$2,$3,'{}',true)",
        [B, session, verbal],
      );
    await login(B);
    let b = await action({ kind: "ensure" });
    expect(b.signals).toEqual({
      dueReviews: 1,
      masteredWords: 1,
      verbal: { attempts: 4, correct: 4, weakType: "text_completion" },
      quant: { attempts: 4, correct: 1, weakType: "numeric_entry" },
    });
    b = await action({ kind: "replan", date: b.today });
    expect(
      b.tasks.some(
        (t) =>
          t.local_date === b.today &&
          t.task_key === "review_words" &&
          t.target === 1,
      ),
    ).toBe(true);
    expect(
      b.tasks.find((t) => t.local_date === b.today && t.task_key === "quant")
        ?.focus_type,
    ).toBe("numeric_entry");
    await login(A);
    expect((await action({ kind: "ensure" })).signals).toEqual(emptySignals);
  });
  it("validates log limits, note persistence and explicit replanning", async () => {
    await login(B);
    let s = await action({ kind: "ensure" });
    await expect(
      action({
        kind: "log",
        date: s.today,
        id: crypto.randomUUID(),
        minutes: 1.5,
        note: "",
      }),
    ).rejects.toThrow("INVALID_LOG");
    await expect(
      action({
        kind: "log",
        date: s.today,
        id: crypto.randomUUID(),
        minutes: 181,
        note: "",
      }),
    ).rejects.toThrow("INVALID_LOG");
    s = await action({
      kind: "note",
      date: s.today,
      note: "A real reflection",
    });
    expect(s.days.find((d) => d.local_date === s.today)?.notes).toBe(
      "A real reflection",
    );
    await db.query(
      "update public.user_settings set daily_minutes=90 where user_id=$1",
      [B],
    );
    expect(
      (await action({ kind: "ensure" })).days.find(
        (d) => d.local_date === s.today,
      )?.budget,
    ).toBe(60);
    s = await action({ kind: "replan", date: s.today });
    expect(
      s.tasks.find((t) => t.local_date === s.today && t.task_key === "focus")
        ?.target,
    ).toBe(90);
    for (let i = 0; i < 8; i++)
      s = await action({
        kind: "log",
        date: s.today,
        id: crypto.randomUUID(),
        minutes: 180,
        note: "",
      });
    await expect(
      action({
        kind: "log",
        date: s.today,
        id: crypto.randomUUID(),
        minutes: 1,
        note: "",
      }),
    ).rejects.toThrow("DAILY_LIMIT");
  });
});
