import { test, expect, type Page } from "@playwright/test";
async function onboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "进入本地体验" }).click();
  await page.getByLabel("昵称").fill("Pilot");
  await page.getByLabel("每日新词").fill("1");
  await page.getByRole("button", { name: "开启学习空间" }).click();
  await expect(
    page.getByRole("heading", { name: "把目标，变成今天的行动。" }),
  ).toBeVisible();
}
test("complete learning journey uses persisted data across all implemented modules", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await onboard(page);
  await page.goto("/vocabulary");
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await page.getByRole("button", { name: "翻转卡片", exact: true }).click();
  await page.getByRole("button", { name: "记得", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已记录本次学习");
  await page.goto("/verbal");
  await page.getByLabel("每组题数").selectOption("1");
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("回答正确");
  await page.goto("/quant");
  await page.getByLabel("每组题数").selectOption("1");
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await page.getByRole("radio", { name: "A. 54", exact: true }).check();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存到错题本");
  await page.getByRole("link", { name: "到错题本记录原因" }).click();
  await page
    .getByLabel("错误原因与改进计划")
    .fill("Apply tax after the discount.");
  await page.getByRole("button", { name: "保存并记为今日回顾" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "回顾记录已保存" }),
  ).toBeVisible();
  await page.goto("/writing");
  await page.getByRole("button", { name: "开始新作文" }).click();
  await page
    .getByLabel("作文正文（英文）")
    .fill(
      "Public resources can expand access to information. Priorities should reflect local needs.",
    );
  await expect(
    page.getByRole("status").filter({ hasText: "草稿已保存" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "完成本篇写作" }).click();
  await expect(
    page.getByRole("heading", { name: "历史作文", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await page.getByLabel("本次学习分钟数").fill("60");
  await page.getByRole("button", { name: "保存学习时长" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "学习记录已保存。" }),
  ).toBeVisible();
  const checks = page.getByRole("checkbox").filter({ visible: true });
  for (let i = 0; i < (await checks.count()); i++) {
    const box = checks.nth(i);
    if (!(await box.isChecked())) {
      await expect(box).toBeEnabled();
      await box.check();
      await expect(
        page.getByRole("button", { name: "保存学习时长" }),
      ).toBeEnabled();
    }
  }
  await page.getByRole("button", { name: "完成今日打卡" }).click();
  await expect(
    page.getByRole("button", { name: "今日已打卡", exact: true }),
  ).toBeDisabled();
  await page.goto("/analytics");
  await expect(page.getByTestId("analytics-minutes")).toContainText("60");
  await expect(page.locator(".analytics-metrics article").nth(1)).toContainText(
    "100%",
  );
  await expect(page.locator(".analytics-metrics article").nth(2)).toContainText(
    "0%",
  );
  await expect(page.locator(".analytics-metrics article").nth(3)).toContainText(
    "1 / 1",
  );
  await page.reload();
  await expect(page.getByTestId("analytics-minutes")).toContainText("60");
  for (const route of [
    "/vocabulary",
    "/verbal",
    "/quant",
    "/writing",
    "/mistakes",
    "/analytics",
    "/settings",
  ]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("unfinished writing survives browser back navigation and interrupted autosave", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await onboard(page);
  await page.clock.install({ time: new Date("2026-11-03T12:00:00Z") });
  await page.goto("/writing");
  await page.getByRole("button", { name: "开始新作文" }).click();
  await page
    .getByLabel("作文正文（英文）")
    .fill("The last sentence must survive immediate navigation.");
  await page.goBack();
  await page.goto("/writing");
  await expect(page.getByLabel("作文正文（英文）")).toHaveValue(
    "The last sentence must survive immediate navigation.",
  );
  await page.clock.runFor(1000);
  await expect(
    page.getByRole("status").filter({ hasText: "草稿已保存" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Public spaces.*打开作文/ }).click();
  await expect(page.getByLabel("作文正文（英文）")).toHaveValue(
    "The last sentence must survive immediate navigation.",
  );
});
test("static assets, deep routes and production security headers are ready", async ({
  page,
  request,
}, info) => {
  for (const path of ["/writing", "/analytics", "/quant"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<div id="root">');
  }
  const favicon = await request.get("/favicon.svg");
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()["content-type"]).toContain("image/svg+xml");
  if (info.config.configFile?.includes("production")) {
    const response = await request.get("/writing");
    expect(response.headers()["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect((await request.get("/package.json")).status()).toBe(404);
    expect((await request.get("/assets/missing.js")).status()).toBe(404);
    expect((await request.post("/api/test")).status()).toBe(405);
    expect((await request.head("/writing")).status()).toBe(200);
  }
  const violations: string[] = [];
  await page.exposeFunction("recordCspViolation", (v: string) =>
    violations.push(v),
  );
  await page.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) => {
      void (
        window as unknown as Window & {
          recordCspViolation: (v: string) => Promise<void>;
        }
      ).recordCspViolation(e.violatedDirective);
    }),
  );
  await onboard(page);
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "学习分析", exact: true }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});
