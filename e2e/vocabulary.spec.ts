import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function setup(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "进入本地体验" }).click();
  await page.getByLabel("昵称").fill("Pilot");
  await page.getByLabel("每日新词").fill("1");
  await page.getByRole("button", { name: "开启学习空间" }).click();
  await expect(
    page.getByRole("heading", { name: "把目标，变成今天的行动。" }),
  ).toBeVisible();
  await page.goto("/vocabulary");
  await expect(
    page.getByRole("heading", { name: "让每一个单词，慢慢变熟悉。" }),
  ).toBeVisible();
}
test("flashcards flip, favorite, dispatch pronunciation and automatically complete the new-word task", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: () => {},
        speak: (utterance: { text: string }) => {
          document.documentElement.dataset.spoken = utterance.text;
        },
      },
    });
  });
  await setup(page);
  await page.getByRole("button", { name: "收藏 abate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "取消收藏 abate", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .locator(".word-open")
    .filter({ hasText: /^abate/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "英语发音" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-spoken", "abate");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await page.getByRole("button", { name: "翻转卡片", exact: true }).click();
  await expect(page.getByText("减弱；缓和", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "记得", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("下次复习");
  await page.getByRole("button", { name: "完成本组" }).click();
  await page.getByRole("button", { name: "返回词库" }).click();
  await page.reload();
  await page.getByLabel("按掌握程度筛选").selectOption("favorite");
  await expect(page.locator(".word-tile")).toHaveCount(1);
  await page.goto("/");
  await expect(
    page.getByRole("checkbox", { name: "学习新词 1" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "学习新词 1" }),
  ).toBeDisabled();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  expect(state.events).toHaveLength(0);
  expect(state.vocabulary.reviews).toHaveLength(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("spelling mistakes retain original answers and can be practiced again", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("学习方式").selectOption("spelling");
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await page.getByLabel("单词拼写").fill("incorrect-spelling");
  await page.getByRole("button", { name: "提交答案" }).click();
  await expect(page.getByRole("status")).toContainText("已加入错词记录");
  await expect(page.getByRole("status")).toContainText("abate");
  await page.getByRole("button", { name: "完成本组" }).click();
  await page.getByRole("button", { name: "返回词库" }).click();
  await page.getByLabel("按掌握程度筛选").selectOption("wrong");
  await expect(page.getByText("原错误答案: incorrect-spelling")).toBeVisible();
  await page.getByRole("button", { name: "重新练习" }).click();
  await page.getByLabel("单词拼写").fill("abate");
  await page.getByRole("button", { name: "提交答案" }).click();
  await expect(page.getByRole("status")).toContainText("未到期练习");
  const data = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!)
        .vocabulary,
  );
  expect(data.reviews).toHaveLength(2);
  expect(data.progress[0].repetitions).toBe(0);
  expect(data.reviews[1].correct).toBe(true);
});
test("meaning quiz grades the selected definition and preserves progress on reload", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("学习方式").selectOption("choice");
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await page.getByRole("button", { name: /减弱；缓和/ }).click();
  await expect(page.getByRole("status")).toContainText("已记录本次学习");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "让每一个单词，慢慢变熟悉。" }),
  ).toBeVisible();
  const data = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!)
        .vocabulary,
  );
  expect(data.reviews[0]).toMatchObject({
    mode: "choice",
    correct: true,
    quality: 4,
  });
  expect(data.progress[0].repetitions).toBe(1);
});
test("CSV import validates, previews, requires review and persists personal words", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "导入 CSV", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const input = dialog.locator("input[type=file]");
  await input.setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("word\nhello"),
  });
  await expect(dialog.getByRole("alert")).toContainText("CSV 列名缺失");
  const buffer = await readFile("public/vocabulary-template.csv");
  await input.setInputFiles({
    name: "words.csv",
    mimeType: "text/csv",
    buffer,
  });
  await expect(dialog.getByText("lucid", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "确认导入个人词库" }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "确认导入个人词库" }).click();
  await expect(dialog.getByRole("status")).toContainText("导入 1 个单词");
  await dialog.getByRole("button", { name: "关闭导入窗口" }).click();
  await page.getByLabel("搜索词汇").fill("lucid");
  await expect(page.locator(".word-tile")).toHaveCount(1);
  await expect(page.locator(".word-tile")).toContainText("个人");
  await page.reload();
  await page.getByLabel("搜索词汇").fill("lucid");
  await expect(page.locator(".word-tile")).toHaveCount(1);
});
test("next-day due queue schedules the second successful recall six days later", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-02T15:59:00Z") });
  await setup(page);
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await page.getByRole("button", { name: "翻转卡片", exact: true }).click();
  await page.getByRole("button", { name: "记得", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2026-11-03");
  await page.clock.setSystemTime(new Date("2026-11-02T16:00:05Z"));
  await page.reload();
  await expect(page.getByText("有 1 个单词到期，建议先复习。")).toBeVisible();
  await page.getByLabel("学习范围").selectOption("review");
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await expect(
    page.getByRole("heading", { name: "abate", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "翻转卡片", exact: true }).click();
  await page.getByRole("button", { name: "记得", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2026-11-09");
  await page.goto("/");
  await expect(
    page.getByRole("checkbox", { name: "复习到期词汇 1" }),
  ).toBeChecked();
});
test("vocabulary and study writes from different tabs share one atomic local state", async ({
  page,
  context,
}) => {
  await setup(page);
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
  await Promise.all([
    page.evaluate(
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
      { path: "/src/services/vocabulary.ts", date, id },
    ),
    second.evaluate(
      async ({ path, date, id }) => {
        const service = await import(path);
        await service.studyAction({
          kind: "log",
          date,
          id,
          minutes: 15,
          note: "parallel study",
        });
      },
      { path: "/src/services/study.ts", date, id: crypto.randomUUID() },
    ),
  ]);
  await second.reload();
  const state = await second.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  expect(state.events).toHaveLength(1);
  expect(state.vocabulary.reviews).toHaveLength(1);
  expect(
    state.tasks.find((t: { task_key: string }) => t.task_key === "new_words")
      .completion_source,
  ).toBe("automatic");
});
