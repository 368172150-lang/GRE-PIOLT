import { test, expect } from "@playwright/test";
test("local onboarding persists, settings update, preferences and logout work", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入本地体验" }).click();
  await page.getByLabel("昵称").fill("Pilot");
  await page.getByRole("button", { name: "开启学习空间" }).click();
  await expect(
    page.getByRole("heading", { name: "把目标，变成今天的行动。" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "把目标，变成今天的行动。" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "查看我的学习计划" }).click();
  await page.getByLabel("目标总分").fill("330");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect(page.getByRole("status")).toHaveText("学习目标已保存。");
  await page.getByRole("button", { name: "切换主题" }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.getByRole("button", { name: "切换语言" }).click();
  await expect(
    page.getByRole("heading", { name: "Learn at your own pace" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  if (isMobile)
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Vocabulary" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Make every word a little more familiar.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (isMobile)
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to GRE Pilot" }),
  ).toBeVisible();
});
