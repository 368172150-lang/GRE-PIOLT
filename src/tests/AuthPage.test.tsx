import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { AuthPage } from "../features/auth/AuthPage";
const { signIn, signUp, reset, update, state } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  reset: vi.fn(),
  update: vi.fn(),
  state: { recovery: false, clearRecovery: vi.fn(), enterLocal: vi.fn() },
}));
vi.mock("../services/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: signIn,
      signUp,
      resetPasswordForEmail: reset,
      updateUser: update,
    },
  },
}));
vi.mock("../features/auth/AuthProvider", () => ({ useAuth: () => state }));
beforeEach(() => {
  vi.clearAllMocks();
  state.recovery = false;
  signIn.mockResolvedValue({ error: null });
  signUp.mockResolvedValue({ data: { session: null }, error: null });
  reset.mockResolvedValue({ error: null });
  update.mockResolvedValue({ error: null });
});
const t = (zh: string) => zh;
it("submits login credentials and shows server errors", async () => {
  signIn.mockResolvedValue({ error: new Error("Invalid credentials") });
  const user = userEvent.setup();
  render(<AuthPage t={t} />);
  await user.type(screen.getByLabelText("邮箱"), "pilot@example.com");
  await user.type(screen.getByLabelText("密码（至少 8 位）"), "test-password");
  await user.click(screen.getByRole("button", { name: "登录" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Invalid credentials",
  );
  expect(signIn).toHaveBeenCalledWith({
    email: "pilot@example.com",
    password: "test-password",
  });
});
it("registers and asks for email confirmation", async () => {
  const user = userEvent.setup();
  render(<AuthPage t={t} />);
  await user.click(screen.getByRole("button", { name: "创建账号" }));
  await user.type(screen.getByLabelText("邮箱"), "pilot@example.com");
  await user.type(screen.getByLabelText("密码（至少 8 位）"), "test-password");
  await user.click(screen.getByRole("button", { name: "创建账号" }));
  expect(await screen.findByRole("status")).toHaveTextContent("确认链接");
  expect(signUp).toHaveBeenCalled();
});
it("requests password recovery without requiring a password", async () => {
  const user = userEvent.setup();
  render(<AuthPage t={t} />);
  await user.click(screen.getByRole("button", { name: "忘记密码？" }));
  await user.type(screen.getByLabelText("邮箱"), "pilot@example.com");
  await user.click(screen.getByRole("button", { name: "发送重置邮件" }));
  expect(await screen.findByRole("status")).toHaveTextContent("重置邮件");
  expect(reset).toHaveBeenCalledWith("pilot@example.com", {
    redirectTo: window.location.origin,
  });
});
it("updates password on a recovery session without requiring email reentry", async () => {
  state.recovery = true;
  const user = userEvent.setup();
  render(<AuthPage t={t} />);
  await user.type(
    screen.getByLabelText("密码（至少 8 位）"),
    "changed-password",
  );
  await user.click(screen.getByRole("button", { name: "保存新密码" }));
  expect(await screen.findByRole("status")).toHaveTextContent("密码已更新");
  expect(update).toHaveBeenCalledWith({ password: "changed-password" });
  expect(state.clearRecovery).toHaveBeenCalled();
});
