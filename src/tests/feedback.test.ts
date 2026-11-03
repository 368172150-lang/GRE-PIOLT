// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  createFeedbackHandler,
  validateFeedback,
  type FeedbackPorts,
} from "../../supabase/functions/writing-feedback/handler";
const id = "70000000-0000-4000-8000-000000000001",
  doc = {
    id,
    revision: 1,
    prompt: "Original prompt",
    body: "My argument.",
    completed_at: "2026-11-03T00:00:00Z",
  },
  feedback = {
    structure: "Claim",
    logic: "Evidence",
    language: "Precise",
    grammar: "Correct",
    revision: "Try this.",
  };
function ports(): FeedbackPorts {
  return {
    authenticate: vi.fn(async () => id),
    read: vi.fn(async () => doc),
    reserve: vi.fn(async () => doc),
    store: vi.fn(async () => {}),
    provider: vi.fn(async () => feedback),
  };
}
const req = (
  body: unknown = { documentId: id },
  origin = "https://pilot.test",
) =>
  new Request("https://edge.test", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
describe("optional AI server boundary", () => {
  it("rejects an oversized streamed request before reading any essay", async () => {
    const p = ports();
    const r = await createFeedbackHandler(
      p,
      "https://pilot.test",
      true,
    )(req({ documentId: id, extra: "x".repeat(2100) }));
    expect(r.status).toBe(413);
    expect(p.read).not.toHaveBeenCalled();
    expect(p.provider).not.toHaveBeenCalled();
  });
  it("requires a signed-in owner before reading any essay", async () => {
    const p = ports();
    p.authenticate = async () => null;
    expect(
      (await createFeedbackHandler(p, "https://pilot.test", true)(req()))
        .status,
    ).toBe(401);
    expect(p.read).not.toHaveBeenCalled();
  });
  it("works as a clear unconfigured state without sending text", async () => {
    const p = ports();
    expect(
      (await createFeedbackHandler(p, "https://pilot.test", false)(req()))
        .status,
    ).toBe(503);
    expect(p.provider).not.toHaveBeenCalled();
  });
  it("checks origin, ID, ownership and completion before calling provider", async () => {
    const p = ports(),
      h = createFeedbackHandler(p, "https://pilot.test", true);
    expect((await h(req({}, "https://evil.test"))).status).toBe(403);
    expect((await h(req({ documentId: "x" }))).status).toBe(400);
    p.read = async () => null;
    expect((await h(req())).status).toBe(404);
    p.read = async () => ({ ...doc, completed_at: null });
    expect((await h(req())).status).toBe(400);
    expect(p.provider).not.toHaveBeenCalled();
  });
  it("reserves rate allowance and sends only essay/prompt/instructions, then saves for the authenticated owner", async () => {
    const p = ports(),
      r = await createFeedbackHandler(p, "https://pilot.test", true)(req());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(feedback);
    expect(p.reserve).toHaveBeenCalledWith(id, 1);
    expect(p.provider).toHaveBeenCalledWith(
      expect.objectContaining({
        essay: "My argument.",
        prompt: "Original prompt",
      }),
    );
    expect(p.store).toHaveBeenCalledWith(id, id, 1, feedback);
  });
  it("blocks provider calls when a reservation is denied", async () => {
    const p = ports();
    p.reserve = async () => {
      throw Error("limit");
    };
    expect(
      (await createFeedbackHandler(p, "https://pilot.test", true)(req()))
        .status,
    ).toBe(429);
    expect(p.provider).not.toHaveBeenCalled();
  });
  it("does not accept scores, extra fields or empty/oversized feedback", () => {
    expect(() => validateFeedback({ ...feedback, score: 6 })).toThrow();
    expect(() => validateFeedback({ ...feedback, logic: "" })).toThrow();
    expect(() =>
      validateFeedback({ ...feedback, logic: "x".repeat(4001) }),
    ).toThrow();
  });
  it("does not store malformed provider output or expose upstream errors", async () => {
    const p = ports();
    p.provider = async () => ({ score: 6, secret: "do not expose" });
    const r = await createFeedbackHandler(p, "https://pilot.test", true)(req());
    expect(r.status).toBe(502);
    expect(await r.text()).not.toContain("secret");
    expect(p.store).not.toHaveBeenCalled();
  });
  it("handles CORS preflight without authentication", async () => {
    const p = ports();
    const r = await createFeedbackHandler(
      p,
      "https://pilot.test",
      true,
    )(
      new Request("https://edge.test", {
        method: "OPTIONS",
        headers: { Origin: "https://pilot.test" },
      }),
    );
    expect(r.status).toBe(204);
    expect(p.authenticate).not.toHaveBeenCalled();
  });
});
