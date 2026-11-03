import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import { loadInsights } from "../services/insights";
import { useInsights } from "../hooks/useInsights";
import { writingAction } from "../services/writing";
import { useWriting } from "../hooks/useWriting";
import type { InsightsSource } from "../types/insights";
vi.mock("../services/insights", () => ({ loadInsights: vi.fn() }));
vi.mock("../services/writing", () => ({ writingAction: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const source = (today: string) => ({ study: { today } }) as InsightsSource;
it("does not allow an earlier refresh to replace a newer response", async () => {
  const first = deferred<InsightsSource>();
  vi.mocked(loadInsights)
    .mockReturnValueOnce(first.promise)
    .mockResolvedValue(source("new"));
  const { result } = renderHook(() => useInsights("A"));
  await act(async () => {
    await result.current.load();
  });
  expect(result.current.source?.study.today).toBe("new");
  await act(async () => first.resolve(source("old")));
  expect(result.current.source?.study.today).toBe("new");
});
it("never displays a previous account response after switching accounts", async () => {
  const first = deferred<InsightsSource>();
  vi.mocked(loadInsights)
    .mockReturnValueOnce(first.promise)
    .mockResolvedValue(source("B"));
  const { result, rerender } = renderHook(({ user }) => useInsights(user), {
    initialProps: { user: "A" },
  });
  rerender({ user: "B" });
  expect(result.current.source).toBeNull();
  await waitFor(() => expect(result.current.source?.study.today).toBe("B"));
  await act(async () => first.resolve(source("A")));
  expect(result.current.source?.study.today).toBe("B");
});
it("writing rejects older snapshots even when they arrive after a confirmed save", async () => {
  vi.mocked(writingAction).mockResolvedValue({
    documents: [],
    today: "2026-11-03",
    server_now: "2026-11-03T12:00:00Z",
  });
  const { result } = renderHook(() => useWriting("A"));
  await waitFor(() => expect(result.current.snapshot).not.toBeNull());
  act(() =>
    result.current.setSnapshot({
      documents: [],
      today: "2026-11-03",
      server_now: "2026-11-03T13:00:00Z",
    }),
  );
  act(() =>
    result.current.setSnapshot({
      documents: [],
      today: "2026-11-03",
      server_now: "2026-11-03T12:30:00Z",
    }),
  );
  expect(result.current.snapshot?.server_now).toContain("13:00:00");
});
