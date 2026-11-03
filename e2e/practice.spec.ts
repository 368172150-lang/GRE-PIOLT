import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page, module = "quant") {
  await page.goto("/");
  await page.getByRole("button", { name: "进入本地体验" }).click();
  await page.getByLabel("昵称").fill("Pilot");
  await page.getByRole("button", { name: "开启学习空间" }).click();
  await expect(
    page.getByRole("heading", { name: "把目标，变成今天的行动。" }),
  ).toBeVisible();
  await page.goto(`/${module}`);
  await expect(
    page.getByRole("heading", {
      name: module === "verbal" ? "Verbal Reasoning" : "Quantitative Reasoning",
      exact: true,
    }),
  ).toBeVisible();
}
test("single-choice attempt creates one persistent mistake with original answer and review notes", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("每组题数").selectOption("1");
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await page.getByRole("radio", { name: "A. 54", exact: true }).check();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存到错题本");
  await page.getByText("中文思路与逐步解析", { exact: true }).click();
  await expect(
    page.getByText("先打折，再对折后金额加税，最终为 66 美元。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "收藏题目", exact: true }).click();
  await page.getByRole("link", { name: "到错题本记录原因" }).click();
  await expect(
    page.getByRole("heading", { name: "首次错误记录" }),
  ).toBeVisible();
  await expect(page.locator(".original-wrong-answer")).toContainText("54");
  await page.getByLabel("错误原因与改进计划").fill("I omitted sales tax.");
  await page.getByRole("button", { name: "保存并记为今日回顾" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "回顾记录已保存" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("错误原因与改进计划")).toHaveValue(
    "I omitted sales tax.",
  );
  await page.goto("/");
  await expect(
    page.getByRole("checkbox", { name: "整理错题与反思 1" }),
  ).toBeChecked();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  expect(state.practice.attempts).toHaveLength(1);
  expect(state.practice.mistakes).toHaveLength(1);
  expect(state.practice.mistakes[0].wrong_answer).toEqual({ choices: ["A"] });
  expect(state.events).toHaveLength(0);
});
test("retry keeps one mistake row, preserves the first answer and can be marked mastered", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("每组题数").selectOption("1");
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await page.getByRole("radio", { name: "A. 54", exact: true }).check();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存到错题本");
  await page.goto("/mistakes");
  await page.getByRole("link", { name: "重新练习", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "B. 60", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "B. 60", exact: true }).check();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存到错题本");
  await page.goto("/mistakes");
  await expect(
    page.getByText("累计出错 2 次。以下保留首次错误时的题目、答案和解析。"),
  ).toBeVisible();
  await expect(page.locator(".original-wrong-answer")).toContainText("54");
  await page.getByLabel("标记已掌握").check();
  await page.getByRole("button", { name: "保存并记为今日回顾" }).click();
  await expect(
    page.getByRole("heading", { name: "此筛选下没有错题" }),
  ).toBeVisible();
  await page.getByLabel("掌握状态").selectOption("mastered");
  await expect(
    page.getByRole("heading", { name: "首次错误记录" }),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  expect(state.practice.mistakes).toHaveLength(1);
  expect(state.practice.mistakes[0]).toMatchObject({
    frequency: 2,
    mastered: true,
    wrong_answer: { choices: ["A"] },
    last_wrong_answer: { choices: ["B"] },
  });
});
test("numeric answers accept exact equivalent fractions and render math", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("combobox", { name: "题型", exact: true })
    .selectOption("numeric_entry");
  await page.getByLabel("每组题数").selectOption("1");
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await page.getByLabel("数值答案").fill("1/0");
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("分母不能为零");
  await page.getByLabel("数值答案").fill("2/20");
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("回答正确");
  await expect(page.locator(".katex").first()).toBeVisible();
  await page.getByRole("button", { name: "查看本组结果" }).click();
  await expect(
    page.getByRole("heading", { name: "这一组，已经留下记录。" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "查看记录" }).click();
  await expect(page.getByRole("status")).toContainText("回答正确");
});
test("sentence equivalence enforces two choices and reading comprehension shows a passage", async ({
  page,
}) => {
  await setup(page, "verbal");
  await page
    .getByRole("combobox", { name: "题型", exact: true })
    .selectOption("sentence_equivalence");
  await page.getByLabel("每组题数").selectOption("1");
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await page.getByRole("checkbox", { name: "A. candid", exact: true }).check();
  await expect(
    page.getByRole("button", { name: "提交答案", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "D. forthright", exact: true })
    .check();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("回答正确");
  await page.goto("/verbal");
  await page
    .getByRole("combobox", { name: "题型", exact: true })
    .selectOption("reading_comprehension");
  await page.getByLabel("每组题数").selectOption("1");
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Reading passage" }),
  ).toContainText("A transit agency");
  await page.getByRole("radio", { name: /^B\. The increase/ }).check();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("回答正确");
});
test("multi-blank completion and quantitative comparison use their own deterministic formats", async ({
  page,
}) => {
  await setup(page, "verbal");
  await page.goto("/verbal?questionId=50000000-0000-4000-8000-000000000004");
  await expect(page.getByRole("group", { name: "第 1 空" })).toBeVisible();
  await page.getByRole("radio", { name: "B. evasive", exact: true }).check();
  await page
    .getByRole("radio", { name: "E. provisional", exact: true })
    .check();
  await page.getByRole("radio", { name: "G. suspend", exact: true }).check();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("回答正确");
  await page.goto("/quant?questionId=50000000-0000-4000-8000-000000000025");
  await expect(
    page.getByRole("heading", { name: "Quantity A", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("radio", {
      name: "D. The relationship cannot be determined.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("回答正确");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("timed sessions persist their deadline and reject answers after time is up", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-02T12:00:00Z") });
  await setup(page);
  await page.getByLabel("每组题数").selectOption("1");
  await page.getByLabel("限时模式", { exact: true }).check();
  await page.getByLabel("限时分钟").fill("1");
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await expect(page.getByRole("timer")).toContainText("1:00");
  await page.clock.setSystemTime(new Date("2026-11-02T12:02:00Z"));
  await page.reload();
  await page.getByRole("button", { name: "继续 / 查看" }).click();
  await expect(
    page.getByText("计时已结束，已保存答案不受影响。"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "提交答案", exact: true }),
  ).toBeDisabled();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  expect(state.practice.attempts).toHaveLength(0);
});
test("question filters show empty states and saved favorites remain available", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("combobox", { name: "难度", exact: true })
    .selectOption("5");
  await expect(
    page.getByRole("heading", { name: "此筛选下没有题目" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "开始练习", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "重置筛选" }).click();
  await page.getByRole("button", { name: "收藏 013", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "取消收藏 013", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("仅收藏题").check();
  await expect(page.locator(".question-preview-grid article")).toHaveCount(1);
  await page.reload();
  await page.getByLabel("仅收藏题").check();
  await expect(page.locator(".question-preview-grid article")).toHaveCount(1);
});
test("practice and vocabulary writes share one atomic state across tabs", async ({
  page,
  context,
}) => {
  await setup(page);
  await page.getByLabel("每组题数").selectOption("1");
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "C. 66", exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("/vocabulary");
  await second.getByRole("button", { name: "进入本地体验" }).click();
  await expect(
    second.getByRole("heading", { name: "让每一个单词，慢慢变熟悉。" }),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  const session = state.practice.sessions[0];
  await Promise.all([
    page.evaluate(
      async ({ path, date, sessionId, id }) => {
        const service = await import(path);
        await service.practiceAction({
          kind: "submit",
          date,
          id,
          sessionId,
          questionId: "50000000-0000-4000-8000-000000000013",
          revision: 1,
          answer: { choices: ["C"] },
        });
      },
      {
        path: "/src/services/practice.ts",
        date: state.today,
        sessionId: session.id,
        id: crypto.randomUUID(),
      },
    ),
    second.evaluate(
      async ({ path, date, id }) => {
        const service = await import(path);
        await service.vocabularyAction({
          kind: "review",
          date,
          id,
          wordId: "30000000-0000-4000-8000-000000000001",
          revision: 0,
          mode: "card",
          answer: "self-rating:4",
          quality: 4,
        });
      },
      {
        path: "/src/services/vocabulary.ts",
        date: state.today,
        id: crypto.randomUUID(),
      },
    ),
  ]);
  await page.reload();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  expect(saved.practice.attempts).toHaveLength(1);
  expect(saved.vocabulary.reviews).toHaveLength(1);
  expect(saved.signals.quant).toMatchObject({ attempts: 1, correct: 1 });
  expect(saved.events).toHaveLength(0);
});
