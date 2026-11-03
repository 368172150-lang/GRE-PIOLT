import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <h1>GRE Pilot</h1>
        <h2>页面暂时无法显示 / Unable to display this page</h2>
        <p>
          已保存数据未被清除。请重新加载；若仍出错，保留浏览器数据并查看运行指南。
        </p>
        <p>
          Your saved data has not been cleared. Reload, or consult the guide if
          the issue continues.
        </p>
        <button onClick={() => window.location.reload()}>
          重新加载 / Reload
        </button>
      </main>
    );
  }
}
