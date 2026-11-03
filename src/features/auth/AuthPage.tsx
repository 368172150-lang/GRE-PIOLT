import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "../../lib/validation";
import { ArrowRight, Compass, ShieldCheck } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAuth } from "./AuthProvider";
import { Button } from "../../components/ui/button";
export function AuthPage({ t }: { t: (zh: string, en: string) => string }) {
  const { enterLocal, recovery, clearRecovery } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const schema = z.object({
    email: recovery
      ? z.string()
      : z.string().email("请输入有效邮箱 / Enter a valid email"),
    password: z.string(),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  async function submit(values: z.infer<typeof schema>) {
    setError("");
    setMessage("");
    if (!supabase) {
      setError(
        t(
          "请先配置 Supabase 环境变量，或进入本地体验。",
          "Configure Supabase or enter local experience.",
        ),
      );
      return;
    }
    try {
      if ((mode !== "reset" || recovery) && values.password.length < 8)
        throw new Error(t("密码至少 8 位。", "Use at least 8 characters."));
      const redirectTo = window.location.origin;
      if (recovery) {
        const { error } = await supabase.auth.updateUser({
          password: values.password,
        });
        if (error) throw error;
        clearRecovery();
        setMessage(t("密码已更新。", "Password updated."));
        return;
      }
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword(values);
        if (error) throw error;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          ...values,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        if (!data.session)
          setMessage(
            t(
              "请检查邮箱中的确认链接，然后登录。",
              "Check your email confirmation link, then sign in.",
            ),
          );
      }
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          values.email,
          { redirectTo },
        );
        if (error) throw error;
        setMessage(
          t(
            "如果该邮箱已注册，你会收到重置邮件。",
            "If an account exists, a reset email will arrive.",
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <div className="brand">
          <Compass size={30} /> GRE Pilot <span>WORKSPACE</span>
        </div>
        <div>
          <div className="eyebrow">SMALL STEPS. BIG POSSIBILITIES.</div>
          <h1>
            {t(
              "让每一天的积累，\n带你走得更远。",
              "A little progress.\nA bigger future.",
            )}
          </h1>
          <p>
            {t(
              "为你的研究生申请之路，建立一个持续、清晰、属于自己的学习节奏。",
              "Build a steady, focused study habit for the next chapter of your education.",
            )}
          </p>
          <div className="story-lines">
            <span>01 — {t("明确目标", "Set your direction")}</span>
            <span>02 — {t("专注当下", "Focus on today")}</span>
            <span>03 — {t("看见成长", "See your progress")}</span>
          </div>
        </div>
        <small>Independent learning. Intentional progress.</small>
      </section>
      <section className="auth-form">
        <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
        <h2>
          {recovery
            ? t("设置新密码", "Set a new password")
            : mode === "signup"
              ? t("创建你的学习空间", "Create your workspace")
              : mode === "reset"
                ? t("重置密码", "Reset your password")
                : t("欢迎回到 GRE Pilot", "Welcome to GRE Pilot")}
        </h2>
        <p className="muted">
          {t(
            "把远大的目标，变成今天的一小步。",
            "Turn your ambitions into a small step today.",
          )}
        </p>
        <form onSubmit={handleSubmit(submit)} noValidate>
          <label>
            {t("邮箱", "Email")}
            <input type="email" autoComplete="email" {...register("email")} />
          </label>
          {errors.email && (
            <p role="alert" className="error">
              {errors.email.message}
            </p>
          )}
          {(mode !== "reset" || recovery) && (
            <label>
              {t("密码（至少 8 位）", "Password (8+ characters)")}
              <input
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                {...register("password")}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="success">
              {message}
            </p>
          )}
          <Button
            disabled={isSubmitting || !supabase}
            className="w-full"
            type="submit"
          >
            {isSubmitting
              ? t("处理中…", "Working…")
              : recovery
                ? t("保存新密码", "Save password")
                : mode === "signup"
                  ? t("创建账号", "Create account")
                  : mode === "reset"
                    ? t("发送重置邮件", "Send reset email")
                    : t("登录", "Sign in")}
            <ArrowRight size={16} />
          </Button>
        </form>
        {!recovery && (
          <div className="auth-links">
            {(["login", "signup", "reset"] as const)
              .filter((v) => v !== mode)
              .map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setMode(v);
                    setError("");
                    setMessage("");
                  }}
                >
                  {v === "login"
                    ? t("已有账号？登录", "Already registered? Sign in")
                    : v === "signup"
                      ? t("创建账号", "Create account")
                      : t("忘记密码？", "Forgot password?")}
                </button>
              ))}
          </div>
        )}
        {!supabase && (
          <div className="local-notice">
            <ShieldCheck size={20} />
            <div>
              <strong>{t("尚未连接云端", "Cloud is not configured")}</strong>
              <p>
                {t(
                  "本地体验只保存本机设置，不创建账号、不模拟云端登录。",
                  "Local experience saves settings on this device. It does not create an account.",
                )}
              </p>
              <Button variant="outline" onClick={enterLocal}>
                {t("进入本地体验", "Enter local experience")}
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        )}
        <small className="muted">
          {t(
            "独立 GRE 学习工具，与 ETS 无关联。",
            "An independent GRE study tool, unaffiliated with ETS.",
          )}
        </small>
      </section>
    </div>
  );
}
