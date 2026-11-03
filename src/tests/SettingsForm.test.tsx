import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AuthProvider } from "../features/auth/AuthProvider";
import { SettingsForm } from "../features/settings/SettingsForm";
it("requires a name, then saves onboarding settings", async () => {
  const onSaved = vi.fn();
  const user = userEvent.setup();
  render(
    <AuthProvider>
      <SettingsForm
        initial={null}
        onSaved={onSaved}
        t={(zh) => zh}
        onboarding
      />
    </AuthProvider>,
  );
  await user.click(screen.getByRole("button", { name: "开启学习空间" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("display_name");
  expect(onSaved).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("昵称"), "Pilot");
  await user.click(screen.getByRole("button", { name: "开启学习空间" }));
  expect(await screen.findByRole("status")).toHaveTextContent("已保存");
  expect(onSaved).toHaveBeenCalledWith(
    expect.objectContaining({
      display_name: "Pilot",
      timezone: "Asia/Kuala_Lumpur",
    }),
  );
});
