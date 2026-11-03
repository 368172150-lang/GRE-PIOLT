import { test, expect, type Page } from "@playwright/test";
async function onboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "进入本地体验" }).click();
  await page.getByLabel("昵称").fill("Pilot");
  await page.getByRole("button", { name: "开启学习空间" }).click();
  await expect(
    page.getByRole("heading", { name: "把目标，变成今天的行动。" }),
  ).toBeVisible();
}
test("records real offline study, auto-completes time, checks in and retains history", async ({
  page,
}) => {
  await onboard(page);
  await expect(
    page.getByRole("button", { name: "完成今日打卡" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "从第一条学习记录开始" }),
  ).toBeVisible();
  await page.getByLabel("本次学习分钟数").fill("60");
  await page.getByLabel("本次内容（可选）").fill("Original offline study");
  await page.getByRole("button", { name: "保存学习时长" }).click();
  await expect(
    page.getByRole("checkbox", { name: "记录学习时长 60" }),
  ).toBeChecked();
  const manual = page.getByRole("checkbox").filter({ visible: true });
  const total = await manual.count();
  for (let i = 0; i < total; i++) {
    const checkbox = manual.nth(i);
    if (
      !(await checkbox.getAttribute("aria-label"))?.startsWith("记录学习时长")
    ) {
      await expect(checkbox).toBeEnabled();
      await checkbox.check();
      await expect(
        page.getByRole("button", { name: "保存学习时长" }),
      ).toBeEnabled();
    }
  }
  await page
    .getByLabel("学习备注", { exact: true })
    .fill("Review algebra tomorrow");
  await page.getByRole("button", { name: "保存备注" }).click();
  await page.getByRole("button", { name: "完成今日打卡" }).click();
  await expect(
    page.getByRole("button", { name: "今日已打卡", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "按最新目标重排" }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "今天的积累，已经留下。" }),
  ).toBeVisible();
  await expect(page.getByLabel("学习备注", { exact: true })).toHaveValue(
    "Review algebra tomorrow",
  );
  await expect(
    page.getByText("Original offline study", { exact: true }),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  expect(state.events).toHaveLength(1);
  expect(state.checkins).toHaveLength(1);
  expect(state.events[0].minutes).toBe(60);
  await expect(
    page.getByRole("img", { name: "最近七天的真实学习时长柱状图" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("two tabs serialize writes and keep duplicate submissions idempotent", async ({
  page,
  context,
}) => {
  await onboard(page);
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: "进入本地体验" }).click();
  await expect(
    second.getByRole("heading", { name: "把目标，变成今天的行动。" }),
  ).toBeVisible();
  const date = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!)
        .today,
  );
  const id = crypto.randomUUID();
  const write = (tab: Page, requestId: string, minutes: number) =>
    tab.evaluate(
      async ({ modulePath, date, id, minutes }) => {
        const service = await import(modulePath);
        await service.studyAction({
          kind: "log",
          date,
          id,
          minutes,
          note: "multi-tab",
        });
      },
      { modulePath: "/src/services/study.ts", date, id: requestId, minutes },
    );
  await Promise.all([
    write(page, id, 15),
    write(second, id, 15),
    write(page, crypto.randomUUID(), 20),
  ]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "把目标，变成今天的行动。" }),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  expect(state.events).toHaveLength(2);
  expect(
    state.events.reduce(
      (s: number, e: { minutes: number }) => s + e.minutes,
      0,
    ),
  ).toBe(35);
});
test("midnight generates a new plan and preserves yesterday", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-02T15:59:50Z") });
  await onboard(page);
  await page.getByLabel("本次学习分钟数").fill("20");
  await page.getByRole("button", { name: "保存学习时长" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "学习记录已保存。" }),
  ).toHaveText("学习记录已保存。");
  await page.clock.setSystemTime(new Date("2026-11-02T16:00:05Z"));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "把目标，变成今天的行动。" }),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  expect(state.today).toBe("2026-11-03");
  expect(state.days).toHaveLength(2);
  expect(state.events[0].local_date).toBe("2026-11-02");
  expect(
    state.tasks.filter(
      (task: { local_date: string; completed_at: string | null }) =>
        task.local_date === "2026-11-03" && task.completed_at,
    ),
  ).toHaveLength(0);
  await page.getByLabel("查询日期").fill("2026-11-02");
  await expect(page.getByText("计划 60 分钟 · 完成 0/5 项")).toBeVisible();
});
