# GRE Pilot v1.0 使用与交付指南

2026-11-03。六个开发阶段的本地实现与发布准备完成。完整学习流程可在浏览器本地体验；真实云端账户、邮件、托管权限与可选 AI 仍需项目配置，未公开部署。本文是当前入口，早期 Phase 文档保留为开发记录。

## 现在开始使用

当前机器可复制以下命令：

```powershell
Set-Location 'path\to\gre-pilot'
& .\Start-GRE-Pilot.ps1
```

它在缺少依赖时执行 npm ci，然后启动 Vite，不修改系统设置、不创建账号。当前工作区能找到已有 npm；换一台机器请安装带 npm 的 Node.js 24 LTS。也可使用已构建的静态包，无需安装 npm 依赖。

标准环境在项目目录执行：

```powershell
npm ci
npm run dev
```

访问终端打印的 localhost 地址，通常是 http://127.0.0.1:5173。选择“进入本地体验”，填写昵称与目标，即可开始。没有 Supabase 时不伪造账户登录。

首次使用建议顺序：Dashboard 看每日计划 → Vocabulary 学词 → Verbal/Quant 作答 → Mistakes 复盘 → Writing 写作 → Dashboard 记录实际分钟并打卡 → Analytics 查看变化。勾选任务不等于答题正确或词汇掌握，计时器也不会自动生成学习分钟。

## 当前完整功能

| 模块 | 可用能力 |
|---|---|
| 认证与设置 | Supabase 登录/注册/重置/恢复接口与目标设置；本地体验独立可用 |
| Dashboard | 预算型任务、真实分钟、备注、按学习时区打卡、连续记录与历史 |
| Vocabulary | 24 个原创示例词条、翻卡/发音、收藏筛选、两种测验、CSV 导入、SM-2 复习 |
| Verbal / Quant | 28 道原创示例、7 种判题格式、分类/难度/标签筛选、计时、收藏与双语解析 |
| Mistakes | 原始错答与解析快照、频次、原因、掌握状态、定向重练 |
| Writing | 4 道原创 Issue 题、30 分钟练习、自动保存、字数、修改意见、历史与文本导出 |
| Analytics | 7/30/90 天真实图表、任务周统计、词汇分布、正确率、知识点与打卡日历 |
| 推荐 | 根据到期词汇、高频错题、至少 3 次作答的薄弱题型和预算给出可解释建议 |
| 可选 AI | 受认证和配额保护的服务器适配器，默认关闭，不提供官方分数 |

题目、词汇和写作题为原创 AI 辅助示例，经作者检查与自动化验证，未受独立 GRE 专家或 ETS 审核。此项目与 ETS 无关联，题量有限，不是完整商业备考题库。

## 数据保存与作文恢复

已保存的本地设置和学习记录使用 localStorage，并通过同一个 Web Lock 合并。浏览器清理数据、无痕窗口关闭或更换浏览器不会迁移这些记录。云端模式与本地模式分开，不自动上传本地历史。本地数据归属于完整 origin（协议、主机、端口）；请固定使用同一个地址，改端口或用 localhost 替代 127.0.0.1 会看到另一份存储，原数据未被删除。

写作在停止输入约 0.8 秒后保存，修订号阻止不同标签页互相覆盖。每次输入还会在 sessionStorage 中保存本标签页的临时缓冲，按用户与作文隔离；自动保存前返回上一页或重新加载，重新打开 Writing 可以恢复。缓冲与正式保存记录分开，保存成功后清除；若版本冲突，保留文字，先导出再合并。关闭整个标签页会结束 sessionStorage 的保留期，仍应确认保存成功再关闭。

30 分钟是练习提示，允许超时保存。完成后的正文只读，修改意见可继续编辑；跨日继续原稿时沿用开始日期。答题计时器的限制与写作提示不同，Verbal/Quant 截止后不能提交新答案。

## 本地完整验收

Node.js 24 LTS 推荐；最低支持的 22 系列版本为 22.13。首次安装浏览器：

```powershell
npm ci
npx playwright install chromium
npm run verify
```

verify 依次执行 lint（零警告）、前端与 Edge 类型检查、内容生成一致性检查、169 项测试、生产构建、60 项开发环境 E2E 和 6 项生产构建验收。浏览器测试使用独立的 localhost:5180 与 localhost:4173，测试服务器（开发为 Vite API，生产为交付的静态服务）在进程内创建并关闭，不依赖 Windows taskkill，也不占用日常开发端口。

只做非浏览器检查用 npm run check。单独验收生产构建先 npm run build，再 npm run test:production。当前工作区没有全局 npm 时，可将 npm 替换为 node ../../work/npm/package/bin/npm-cli.js；浏览器缓存设置如下：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='path\to\playwright-browsers'
node ../../work/npm/package/bin/npm-cli.js run verify
```

测试会创建隔离浏览器上下文和内存数据库，不向个人学习空间插入验收记录。CI 执行同类命令，限定只读仓库权限、任务超时、取消旧运行，失败时保存测试 trace；尚未在用户的 GitHub 仓库远程运行。

## 配置真实 Supabase

新项目执行五份迁移，顺序为 001 foundation → 002 daily_learning → 003 vocabulary → 004 practice → 005 writing；然后执行 seed.sql、questions-seed.sql、writing-seed.sql。已有 Phase 5 数据库本轮没有新增 SQL 迁移。升级前先在测试项目验证并保留备份。

复制 .env.example 为 .env，仅填入 VITE_SUPABASE_URL 与公开的 VITE_SUPABASE_ANON_KEY；保持 VITE_ENABLE_WRITING_AI=false，重启开发服务器。VITE_ 变量会进入浏览器代码，不能填写 Service Role、数据库密码或 AI Key。

开启邮箱密码登录与邮箱确认，配置 Site URL、回调地址和邮件服务。使用两个真实账号，按 acceptance-matrix.md 与 deployment.md 验证注册、邮件确认、恢复密码、跨设备持久化及互相隔离。项目内 PGlite 已执行真实 SQL/RLS/RPC，但它使用最小 Auth 模拟，不能证明托管 Auth/PostgREST 工作正常。

可选 AI 的 JSON 适配器、服务端变量、JWT、UTC 日配额与降级规则见 phase5-guide.md。只有配置服务并完成真实验证后才开启公开开关；本轮没有调用外部模型或部署 Edge Function。

## 交付文件

- GRE-Pilot-v1.0.0.zip：完整源码、五份迁移、三份种子、测试、CI、文档、启动脚本与许可证。
- GRE-Pilot-Web-v1.0.0.zip：以空 Supabase 配置构建的 dist 静态文件，默认使用本地体验，附独立托管配置和说明。云端变量在构建时注入，要接 Supabase 必须从源码重新构建。
- GRE-Pilot-v1.0.0.sha256.txt：两个压缩包的 SHA-256 校验值。

源码包不含 node_modules、.env、测试运行数据、浏览器缓存或私人学习记录；此前阶段 ZIP 继续保留。静态文件须通过 HTTP(S) 和 SPA 回退服务，不能直接双击 index.html。静态包另附无依赖的 serve.mjs 和 Start-GRE-Pilot.cmd：安装 Node.js 后可运行 node serve.mjs，默认在 localhost:5173 使用，无需 npm 安装。该服务仅绑定本机，不是公开托管服务。

## 学习代码的顺序

1. src/App.tsx：路由、布局、认证后的页面组合。
2. src/features/settings/schema.ts 与 SettingsForm.tsx：Zod 输入/输出类型和表单。
3. src/algorithms/：日期、任务、SM-2、精确判题、写作、聚合与推荐，全部接受明确输入。
4. src/services/ 与 src/hooks/：持久化、原子写入、修订和异步结果隔离。
5. src/services/writingRecovery.ts：正式记录之外的临时恢复缓冲。
6. supabase/migrations/：RLS 与 RPC 如何在服务器再次检查权限和数据。
7. e2e/release.spec.ts：一个用户怎样完成全部学习流程；e2e/server.setup.ts：测试服务器的生命周期。

当前限制：大量历史仍是全量快照，需要后续分页；学习时长为本人申报，不支持历史补签或更正/删除；推荐不是能力模型；系统语音依赖设备，需听觉检查；没有后台推送或离线安装。详见最终验收记录。
