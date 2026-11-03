import { describe, it, expect } from "vitest";
import { settingsSchema, defaults } from "../features/settings/schema";
import { saveSettings, loadSettings } from "../services/settings";
describe("study preferences", () => {
  it("validates and coerces form values", () => {
    expect(
      settingsSchema.parse({
        ...defaults,
        display_name: " Pilot ",
        daily_minutes: "60",
      }),
    ).toMatchObject({ display_name: "Pilot", daily_minutes: 60 });
  });
  it.each([
    { target_score: 350 },
    { new_words: 0 },
    { timezone: "Mars/Nowhere" },
    { daily_minutes: 45 },
    { display_name: "" },
  ])("rejects invalid goals %j", (patch) => {
    expect(
      settingsSchema.safeParse({ ...defaults, display_name: "Pilot", ...patch })
        .success,
    ).toBe(false);
  });
  it("returns a genuine empty state", async () => {
    expect(await loadSettings()).toBeNull();
  });
  it("persists only settings across reloads", async () => {
    const v = { ...defaults, display_name: "Pilot" };
    await saveSettings(v);
    expect(await loadSettings()).toEqual(v);
    await saveSettings({ ...v, target_score: 330 });
    expect((await loadSettings())?.target_score).toBe(330);
  });
  it("reports corrupted storage", async () => {
    localStorage.setItem("gre-pilot:local-experience:settings:v1", "broken");
    await expect(loadSettings()).rejects.toThrow();
  });
});
