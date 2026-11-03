import { test, expect, type Page } from "@playwright/test";
test("failed autosave retains text, holds internal navigation and can be retried", async ({
  page,
}) => {
  await onboard(page);
  await newEssay(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (
        key === "gre-pilot:local-experience:study:v2" &&
        (window as Window & { failSave?: boolean }).failSave
      )
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
    (window as Window & { failSave?: boolean }).failSave = true;
  });
  await page
    .getByLabel("作文正文（英文）")
    .fill("Keep this text through a failed save.");
  await expect(page.getByRole("alert")).toContainText("当前文字仍保留");
  // Use a real internal link through the layout. Mobile navigation is opened first.
  const menu = page.getByRole("button", { name: "打开导航" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name: "数学推理", exact: true }).click();
  await expect(page).toHaveURL(/\/writing$/);
  await expect(page.getByLabel("作文正文（英文）")).toHaveValue(
    "Keep this text through a failed save.",
  );
  await page.evaluate(() => {
    (window as Window & { failSave?: boolean }).failSave = false;
  });
  const close = page.getByRole("button", { name: "关闭导航" });
  if (await close.isVisible())
    await close.click({
      position: { x: page.viewportSize()!.width - 20, y: 20 },
    });
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "草稿已保存" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Public spaces.*打开作文/ }).click();
  await expect(page.getByLabel("作文正文（英文）")).toHaveValue(
    "Keep this text through a failed save.",
  );
});
async function onboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "进入本地体验" }).click();
  await page.getByLabel("昵称").fill("Pilot");
  await page.getByRole("button", { name: "开启学习空间" }).click();
  await expect(
    page.getByRole("heading", { name: "把目标，变成今天的行动。" }),
  ).toBeVisible();
}
async function newEssay(page: Page) {
  await page.goto("/writing");
  await page.getByRole("button", { name: "开始新作文" }).click();
  await expect(page.getByLabel("作文正文（英文）")).toBeVisible();
}
const essay =
  "Libraries provide reliable information. Public investment can make access more equal. However, businesses also create jobs.";
async function saved(page: Page, body = essay) {
  await page.getByLabel("作文正文（英文）").fill(body);
  await expect(
    page.getByRole("status").filter({ hasText: "草稿已保存" }),
  ).toBeVisible();
}
test("writing autosaves, exports, completes and retains revision notes after reload", async ({
  page,
}) => {
  await onboard(page);
  await newEssay(page);
  await expect(page.getByRole("timer")).toHaveText(/^(30:00|29:[0-5][0-9])$/);
  await saved(page);
  await expect(page.getByTestId("word-count")).toHaveText("16 词");
  await page
    .getByLabel("自行记录修改意见")
    .fill("Add a specific library example.");
  await expect(
    page.getByRole("status").filter({ hasText: "草稿已保存" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出文本" }).click();
  expect((await download).suggestedFilename()).toMatch(/gre-pilot-.*\.txt/);
  await page.getByRole("button", { name: "完成本篇写作" }).click();
  await expect(
    page.getByRole("heading", { name: "历史作文", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("作文正文（英文）")).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(
    page.getByRole("button", { name: "获取 AI 学习建议" }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: /Public spaces.*打开作文/ }).click();
  await expect(page.getByLabel("作文正文（英文）")).toHaveValue(essay);
  await expect(page.getByLabel("自行记录修改意见")).toHaveValue(
    "Add a specific library example.",
  );
  await page.getByLabel("自行记录修改意见").fill("Review the opposing view.");
  await expect(
    page.getByRole("status").filter({ hasText: "草稿已保存" }),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  expect(state.writing.documents).toHaveLength(1);
  expect(state.events).toHaveLength(0);
});
test("writing timer survives reload, reaches zero and preserves overtime edits", async ({
  page,
}) => {
  await onboard(page);
  await page.clock.install({ time: new Date("2026-11-03T12:00:00Z") });
  await newEssay(page);
  await page.getByLabel("作文正文（英文）").fill("An initial claim.");
  await page.clock.runFor(1000);
  await expect(
    page.getByRole("status").filter({ hasText: "草稿已保存" }),
  ).toBeVisible();
  await page.clock.fastForward(31 * 60000);
  await expect(page.getByRole("timer")).toHaveText("00:00");
  await expect(page.getByText(/时间已到。可保存收尾/)).toBeVisible();
  await page
    .getByLabel("作文正文（英文）")
    .fill("An initial claim. A final conclusion.");
  await page.clock.runFor(1000);
  await page.reload();
  await page.getByRole("button", { name: /Public spaces.*打开作文/ }).click();
  await expect(page.getByRole("timer")).toHaveText("00:00");
  await expect(page.getByLabel("作文正文（英文）")).toHaveValue(
    "An initial claim. A final conclusion.",
  );
});
test("competing tabs retain unsaved text and require an explicit merge after revision conflict", async ({
  page,
  context,
}) => {
  await onboard(page);
  await newEssay(page);
  await saved(page, "First draft.");
  const second = await context.newPage();
  await second.goto("/writing");
  await second.getByRole("button", { name: "进入本地体验" }).click();
  await second.getByRole("button", { name: /Public spaces.*打开作文/ }).click();
  await saved(page, "Updated in the first tab.");
  await second
    .getByLabel("作文正文（英文）")
    .fill("Competing text in the second tab.");
  await expect(second.getByRole("alert")).toContainText("另一标签页已更新");
  await expect(second.getByLabel("作文正文（英文）")).toHaveValue(
    "Competing text in the second tab.",
  );
  await second
    .getByRole("button", { name: "载入已保存版本（替换当前文字）" })
    .click();
  await expect(second.getByLabel("作文正文（英文）")).toHaveValue(
    "Updated in the first tab.",
  );
  await second.close();
});
test("writing remains in shared storage after vocabulary study and practice", async ({
  page,
}) => {
  await onboard(page);
  await newEssay(page);
  await saved(page);
  await page.goto("/vocabulary");
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await page.getByRole("button", { name: "翻转卡片", exact: true }).click();
  await page.getByRole("button", { name: "记得", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已记录本次学习");
  await page.goto("/quant");
  await page.getByLabel("每组题数").selectOption("1");
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await page.getByRole("radio", { name: "C. 66", exact: true }).check();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("回答正确");
  await page.goto("/writing");
  await page.getByRole("button", { name: /Public spaces.*打开作文/ }).click();
  await expect(page.getByLabel("作文正文（英文）")).toHaveValue(essay);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gre-pilot:local-experience:study:v2")!),
  );
  expect(state.writing.documents).toHaveLength(1);
  expect(state.vocabulary.reviews).toHaveLength(1);
  expect(state.practice.attempts).toHaveLength(1);
});
test("analytics shows honest empty states and 7/30/90 day calendars", async ({
  page,
}) => {
  await onboard(page);
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "学习分析", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("该范围还没有学习时长记录。")).toBeVisible();
  await expect(
    page.getByText("完成练习后，这里显示真实正确率。"),
  ).toBeVisible();
  await expect(page.getByTestId("analytics-minutes")).toContainText("0");
  await expect(page.locator(".heatmap-day")).toHaveCount(7);
  await page.getByRole("button", { name: "最近 30 天" }).click();
  await expect(page.locator(".heatmap-day")).toHaveCount(30);
  await page.getByRole("button", { name: "最近 90 天" }).click();
  await expect(page.locator(".heatmap-day")).toHaveCount(90);
  await expect(page.getByText(/未学习 24 · 学习中 0/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("analytics reflects real time logs, answers and completed essays without invented minutes", async ({
  page,
}) => {
  await onboard(page);
  await page.getByLabel("本次学习分钟数").fill("45");
  await page.getByRole("button", { name: "保存学习时长" }).click();
  await expect(page.getByLabel("本次学习分钟数")).toBeEnabled();
  await newEssay(page);
  await saved(page);
  await page.getByRole("button", { name: "完成本篇写作" }).click();
  await expect(
    page.getByRole("heading", { name: "历史作文", exact: true }),
  ).toBeVisible();
  await page.goto("/quant");
  await page.getByLabel("每组题数").selectOption("1");
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await page.getByRole("radio", { name: "C. 66", exact: true }).check();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("回答正确");
  await page.goto("/analytics");
  await expect(page.getByTestId("analytics-minutes")).toContainText("45");
  await expect(page.locator(".analytics-metrics article").nth(2)).toContainText(
    "100%",
  );
  await expect(page.locator(".analytics-metrics article").nth(3)).toContainText(
    "0 / 1",
  );
  await page.getByText("查看图表原始数据", { exact: true }).click();
  await expect(page.locator(".analytics-data tbody")).toContainText("100 (1)");
  await page.reload();
  await expect(page.getByTestId("analytics-minutes")).toContainText("45");
});
test("adaptive suggestions explain repeated errors and apply the recommended type and difficulty", async ({
  page,
}) => {
  await onboard(page);
  for (let i = 0; i < 3; i++) {
    await page.goto("/quant?questionId=50000000-0000-4000-8000-000000000013");
    await page.getByRole("radio", { name: "A. 54", exact: true }).check();
    await page.getByRole("button", { name: "提交答案", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("已保存到错题本");
  }
  await page.goto("/analytics");
  await expect(page.getByText(/累计错 3 次/)).toBeVisible();
  const suggestion = page
    .locator(".recommendation-card")
    .filter({ hasText: "近 30 天该题型 3 次作答" });
  await expect(suggestion).toContainText("正确率 0%");
  await suggestion.click();
  await expect(
    page.getByRole("combobox", { name: "题型", exact: true }),
  ).toHaveValue("single_choice");
  await expect(
    page.getByRole("combobox", { name: "难度", exact: true }),
  ).toHaveValue("2");
});
test("writing and analytics stay usable in dark mode and English", async ({
  page,
}) => {
  await onboard(page);
  await newEssay(page);
  await page.getByRole("button", { name: "切换主题" }).click();
  await page.getByRole("button", { name: "切换语言" }).click();
  await expect(page.getByLabel("Essay body (English)")).toBeVisible();
  await page.getByLabel("Essay body (English)").fill("A short argument.");
  await expect(
    page.getByRole("status").filter({ hasText: "Draft saved" }),
  ).toBeVisible();
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Learning analytics", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "30 days", exact: true }).click();
  await expect(page.locator(".heatmap-day")).toHaveCount(30);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
