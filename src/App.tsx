import { useEffect, useState, lazy, Suspense } from "react";
import {
  NavLink,
  Route,
  Routes,
  Link,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  Compass,
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Calculator,
  PenLine,
  Bookmark,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Languages,
  LogOut,
  ArrowRight,
  Menu,
  X,
  Leaf,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "./features/auth/AuthProvider";
import { AuthPage } from "./features/auth/AuthPage";
import { SettingsForm } from "./features/settings/SettingsForm";
import { usePreferences } from "./hooks/usePreferences";
import { loadSettings } from "./services/settings";
import { Button } from "./components/ui/button";
import type { StudySettings } from "./types";
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const Vocabulary = lazy(() =>
  import("./pages/Vocabulary").then((module) => ({
    default: module.Vocabulary,
  })),
);
const Practice = lazy(() =>
  import("./pages/Practice").then((module) => ({ default: module.Practice })),
);
const Mistakes = lazy(() =>
  import("./pages/Mistakes").then((module) => ({ default: module.Mistakes })),
);
const Writing = lazy(() =>
  import("./pages/Writing").then((m) => ({ default: m.Writing })),
);
const Analytics = lazy(() =>
  import("./pages/Analytics").then((m) => ({ default: m.Analytics })),
);
const modules = [
  {
    path: "/",
    zh: "学习总览",
    en: "Dashboard",
    icon: LayoutDashboard,
    phase: 2,
  },
  {
    path: "/vocabulary",
    zh: "词汇学习",
    en: "Vocabulary",
    icon: BookOpen,
    phase: 3,
  },
  {
    path: "/verbal",
    zh: "语文推理",
    en: "Verbal",
    icon: MessageSquare,
    phase: 4,
  },
  { path: "/quant", zh: "数学推理", en: "Quant", icon: Calculator, phase: 4 },
  {
    path: "/writing",
    zh: "分析性写作",
    en: "Writing",
    icon: PenLine,
    phase: 5,
  },
  { path: "/mistakes", zh: "错题本", en: "Mistakes", icon: Bookmark, phase: 4 },
  {
    path: "/analytics",
    zh: "学习分析",
    en: "Analytics",
    icon: BarChart3,
    phase: 5,
  },
  {
    path: "/settings",
    zh: "个人设置",
    en: "Settings",
    icon: Settings,
    phase: 1,
  },
];
export function App() {
  const prefs = usePreferences();
  const { t } = prefs;
  const auth = useAuth();
  const [settings, setSettings] = useState<StudySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  useEffect(() => {
    let active = true;
    if (!auth.user && !auth.local) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    loadSettings(auth.user?.id)
      .then((v) => {
        if (active) setSettings(v);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [auth.user?.id, auth.local, auth.user, retry]);
  const controls = (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("切换语言", "Switch language")}
        onClick={() => prefs.setLanguage(prefs.language === "zh" ? "en" : "zh")}
      >
        <Languages size={18} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("切换主题", "Toggle theme")}
        onClick={() => prefs.setDark(!prefs.dark)}
      >
        {prefs.dark ? <Sun size={18} /> : <Moon size={18} />}
      </Button>
    </>
  );
  if (auth.loading)
    return (
      <div role="status" className="full-status">
        {t("正在恢复登录状态…", "Restoring your session…")}
      </div>
    );
  if ((!auth.user && !auth.local) || auth.recovery)
    return (
      <>
        <div className="floating-controls">{controls}</div>
        {auth.error && (
          <p role="alert" className="error">
            {auth.error}
          </p>
        )}
        <AuthPage t={t} />
      </>
    );
  async function logout() {
    setError("");
    try {
      await auth.signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const current = modules.find((m) => m.path === location.pathname);
  return (
    <div className="workspace">
      <a href="#main" className="skip-link">
        {t("跳至主要内容", "Skip to content")}
      </a>
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <Link to="/" className="brand">
          <Compass size={28} /> GRE Pilot<span className="version">BETA</span>
        </Link>
        <div className="workspace-label">
          {t("你的学习空间", "YOUR WORKSPACE")}
        </div>
        <nav aria-label={t("主导航", "Main navigation")}>
          {modules.map((m, i) => (
            <NavLink
              key={m.path}
              to={m.path}
              end={m.path === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""} ${i === 5 ? "nav-divider" : ""}`
              }
            >
              <m.icon size={18} />
              <span>{t(m.zh, m.en)}</span>
              {m.path === "/vocabulary" && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-card">
            <Leaf size={19} />
            <strong>
              {t("每天一点，慢慢走远。", "Progress takes practice.")}
            </strong>
            <p>
              {t(
                "你的下一步，比完美的计划更重要。",
                "Make room for one small step today.",
              )}
            </p>
          </div>
          <div className="profile">
            <span className="avatar">
              {settings?.display_name?.slice(0, 1).toUpperCase() || "P"}
            </span>
            <div>
              <strong>
                {settings?.display_name || t("新同学", "New learner")}
              </strong>
              <small>
                {auth.local
                  ? t("本地体验", "Local experience")
                  : auth.user?.email}
              </small>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={logout}
              aria-label={t("退出登录", "Sign out")}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="mobile-backdrop"
          aria-label={t("关闭导航", "Close navigation")}
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle"
              aria-label={t("打开导航", "Open navigation")}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>{current ? t(current.zh, current.en) : "404"}</strong>
          </div>
          <div className="top-controls">
            <span className="phase-chip">
              v1.0 <span>·</span> GRE PILOT
            </span>
            {controls}
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {auth.local && (
            <div className="mode-banner">
              <ShieldCheck size={15} />
              {t(
                "本地体验 · 学习记录仅保存在此浏览器，云端认证尚未配置。",
                "Local experience · Study records stay in this browser. Cloud authentication is not configured.",
              )}
            </div>
          )}
          {error ? (
            <section className="panel">
              <h2>{t("暂时无法读取设置", "Unable to load settings")}</h2>
              <p role="alert" className="error">
                {error}
              </p>
              <Button onClick={() => setRetry((v) => v + 1)}>
                {t("重试", "Retry")}
              </Button>
            </section>
          ) : loading ? (
            <p role="status">
              {t("正在加载你的空间…", "Loading your workspace…")}
            </p>
          ) : !settings ? (
            <div className="onboarding">
              <SettingsForm
                initial={null}
                onSaved={setSettings}
                t={t}
                onboarding
              />
            </div>
          ) : (
            <Routes>
              <Route
                path="/"
                element={
                  <Suspense
                    fallback={
                      <p role="status">
                        {t(
                          "正在加载学习工作台…",
                          "Loading your study dashboard…",
                        )}
                      </p>
                    }
                  >
                    <Dashboard settings={settings} t={t} />
                  </Suspense>
                }
              />
              <Route
                path="/vocabulary"
                element={
                  <Suspense
                    fallback={
                      <p role="status">
                        {t("正在加载词汇…", "Loading vocabulary…")}
                      </p>
                    }
                  >
                    <Vocabulary settings={settings} t={t} />
                  </Suspense>
                }
              />
              <Route
                path="/verbal"
                element={
                  <Suspense
                    fallback={
                      <p role="status">
                        {t("正在加载练习…", "Loading practice…")}
                      </p>
                    }
                  >
                    <Practice
                      key="verbal"
                      module="verbal"
                      settings={settings}
                      t={t}
                    />
                  </Suspense>
                }
              />
              <Route
                path="/quant"
                element={
                  <Suspense
                    fallback={
                      <p role="status">
                        {t("正在加载练习…", "Loading practice…")}
                      </p>
                    }
                  >
                    <Practice
                      key="quant"
                      module="quant"
                      settings={settings}
                      t={t}
                    />
                  </Suspense>
                }
              />
              <Route
                path="/mistakes"
                element={
                  <Suspense
                    fallback={
                      <p role="status">
                        {t("正在加载错题…", "Loading mistakes…")}
                      </p>
                    }
                  >
                    <Mistakes t={t} />
                  </Suspense>
                }
              />
              <Route
                path="/settings"
                element={
                  <>
                    <PageHeading
                      eyebrow="MAKE IT YOURS"
                      title={t("按你的节奏学习", "Learn at your own pace")}
                      text={t(
                        "更新目标，为接下来的学习做好准备。",
                        "Keep your goals aligned with your next chapter.",
                      )}
                    />
                    <SettingsForm
                      initial={settings}
                      onSaved={setSettings}
                      t={t}
                    />
                  </>
                }
              />
              <Route
                path="/writing"
                element={
                  <Suspense
                    fallback={
                      <p role="status">
                        {t("正在加载写作…", "Loading writing…")}
                      </p>
                    }
                  >
                    <Writing t={t} />
                  </Suspense>
                }
              />
              <Route
                path="/analytics"
                element={
                  <Suspense
                    fallback={
                      <p role="status">
                        {t("正在加载分析…", "Loading analytics…")}
                      </p>
                    }
                  >
                    <Analytics settings={settings} t={t} />
                  </Suspense>
                }
              />
              {modules
                .filter((m) => m.phase > 5)
                .map((m) => (
                  <Route
                    key={m.path}
                    path={m.path}
                    element={
                      <>
                        <PageHeading
                          eyebrow={`PHASE 0${m.phase}`}
                          title={t(m.zh, m.en)}
                          text={t(
                            "此模块将在对应开发阶段实现。",
                            "This module will be implemented in its scheduled phase.",
                          )}
                        />
                        <section className="panel empty-state">
                          <m.icon size={32} />
                          <h2>
                            {t(
                              "学习空间已预留",
                              "Your learning space is ready for its next step",
                            )}
                          </h2>
                          <p>
                            {t(
                              "目前没有学习记录。下一阶段完成后，这里会连接真实的数据与练习流程。",
                              "No study records yet. Practice and real records will arrive in a later phase.",
                            )}
                          </p>
                          <Button asChild variant="outline">
                            <Link to="/">
                              {t("返回学习总览", "Back to dashboard")}
                              <ArrowRight size={16} />
                            </Link>
                          </Button>
                        </section>
                      </>
                    }
                  />
                ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
          <footer>
            <span>GRE Pilot</span> ·{" "}
            {t(
              "独立学习工具，与 ETS 无关联。",
              "Independent study tool. Not affiliated with ETS.",
            )}
            <span className="footer-right">Built for your next chapter.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p className="muted">{text}</p>
    </div>
  );
}
