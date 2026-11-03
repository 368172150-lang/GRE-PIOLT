import { beforeEach, describe, it, expect, vi } from "vitest";
import { writingTransition } from "../algorithms/writing";
import {
  saveWritingRecovery,
  readWritingRecovery,
  clearWritingRecovery,
} from "../services/writingRecovery";
const doc = writingTransition(
  { documents: [] },
  { kind: "start", id: crypto.randomUUID(), promptId: "public-spaces" },
  "Asia/Kuala_Lumpur",
  new Date("2026-11-03T12:00:00Z"),
).documents[0];
beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});
describe("tab-scoped unsaved writing recovery", () => {
  it("persists the latest keystrokes separately from saved data", () => {
    expect(
      saveWritingRecovery(doc.id, {
        body: "Unsaved last sentence.",
        notes: "Review",
        revision: 0,
      }),
    ).toBe(true);
    expect(readWritingRecovery(doc)).toMatchObject({
      body: "Unsaved last sentence.",
      revision: 0,
    });
    expect(doc.body).toBe("");
  });
  it("separates users and documents and removes a buffer after confirmed save", () => {
    saveWritingRecovery(
      doc.id,
      { body: "Private text", notes: "", revision: 0 },
      "owner-a",
    );
    expect(readWritingRecovery(doc, "owner-b")).toBeNull();
    expect(
      readWritingRecovery({ ...doc, id: crypto.randomUUID() }, "owner-a"),
    ).toBeNull();
    clearWritingRecovery(doc.id, "owner-a");
    expect(readWritingRecovery(doc, "owner-a")).toBeNull();
  });
  it("does not resurrect text already saved by the interrupted request", () => {
    saveWritingRecovery(doc.id, {
      body: "Confirmed",
      notes: "Done",
      revision: 0,
    });
    expect(
      readWritingRecovery({
        ...doc,
        body: "Confirmed",
        notes: "Done",
        revision: 1,
      }),
    ).toBeNull();
  });
  it("retains a stale revision for an explicit user merge", () => {
    saveWritingRecovery(doc.id, { body: "Other text", notes: "", revision: 0 });
    expect(readWritingRecovery({ ...doc, revision: 1 })?.revision).toBe(0);
  });
  it("handles disabled/full browser storage without damaging the saved document", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    expect(
      saveWritingRecovery(doc.id, { body: "Text", notes: "", revision: 0 }),
    ).toBe(false);
    expect(doc.body).toBe("");
  });
});
