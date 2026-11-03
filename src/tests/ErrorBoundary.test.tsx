import { render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { ErrorBoundary } from "../components/ErrorBoundary";
it("renders the application normally", () => {
  render(
    <ErrorBoundary>
      <p>Study workspace</p>
    </ErrorBoundary>,
  );
  expect(screen.getByText("Study workspace")).toBeVisible();
});
it("offers reload after a rendering error and retains stored progress", () => {
  const expectedError = (event: ErrorEvent) => {
    if (event.error?.message === "Internal details") event.preventDefault();
  };
  window.addEventListener("error", expectedError);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  localStorage.setItem("retained-progress", "saved");
  function Broken(): never {
    throw new Error("Internal details");
  }
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("已保存数据未被清除");
  expect(
    screen.getByRole("button", { name: "重新加载 / Reload" }),
  ).toBeEnabled();
  expect(screen.queryByText("Internal details")).not.toBeInTheDocument();
  expect(localStorage.getItem("retained-progress")).toBe("saved");
  localStorage.removeItem("retained-progress");
  log.mockRestore();
  window.removeEventListener("error", expectedError);
});
