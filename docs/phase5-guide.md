> 历史阶段记录。当前安装、测试与发布请看 [v1.0 交付指南](release-guide.md)。

# Phase 5：Writing、Analytics 与自适应推荐

版本 0.5.0 · 2026-11-03。此前四阶段继续可用；本轮没有部署、创建远程仓库、调用付费 AI 或上传学习数据。下一阶段需用户确认。

## 启动与验收

在项目目录用常规 Node.js/npm 环境执行：

```powershell
npm ci
npm run dev
```

当前机器的 npm 位于工作区，以下命令可直接复制：

```powershell
Set-Location 'path\to\gre-pilot'
node ../../work/npm/package/bin/npm-cli.js run dev
```

打开终端给出的 localhost 地址。环境变量未配置时，选择“进入本地体验”，完成目标设置。

1. 在 Writing 选择一道原创 Issue 题，点击“开始新作文”，输入英文正文。停止输入约 0.8 秒后自动保存，也可点击“保存草稿”。看到保存成功后再切换页面。
2. 修改意见单独保存；字数按英文词元估算，含数字和内部连字符/撇号，不计中文或独立标点，不用于评分。
3. 刷新后从历史列表打开同一篇作文，核对正文与修改意见。计时器依据原始截止时间继续，离开页面仍计时。跨日可以继续原稿，归档日期沿用创建时的学习日。
4. 30 分钟到期会提示，可继续收尾并保存超时文字。这是练习计时器，不是强制考试封卷。点击“完成本篇写作”后正文成为只读历史，修改意见仍可编辑；要重写可开始另一篇。
5. “导出文本”下载本篇题目、正文和修改意见。保存冲突或失败时文字保留在编辑器，可导出后合并。另一标签页更新同篇作文会触发版本冲突，不静默覆盖。有未保存修改时页面内链接暂停跳转，关页/刷新使用浏览器原生未保存提示；浏览器前进后退等快捷导航前也应确认保存成功。
6. 先记录学习分钟、学习词汇、完成练习或打卡，再打开 Analytics，切换 7/30/90 天，核对分钟、正确数/作答数、任务与日历。无记录的正确率为“—”，图表不生成假数据。
7. 查看 Dashboard 或 Analytics 下方的下一次学习建议。建议附依据，链接可直接打开错题或带题型/难度筛选的练习页；不会修改今日任务或自动记时。

本地体验记录保存在当前浏览器，清理浏览器数据会删除。没有自动云端迁移。草稿正文最多 60,000 字符，修改意见最多 10,000 字符；超出限制不保存。

## 图表的含义

- 每日分钟只汇总手动申报的学习时长，不把计时器、答题耗时重复累加。
- 每周任务按周一分组，首尾周只计算所选范围内的日期。手动勾选任务不等于作答正确或掌握词汇。
- 词汇环形图展示当前状态，不是过去某日的回放，因此不随 7/30/90 天切换。
- Verbal/Quant 正确率来自所选范围内保存的答案快照，重复作答也计入；未作答日留空，不当作 0%。
- 知识点表显示作答数和平均难度，小样本不代表稳定能力。
- 日历颜色表示完成任务数量，圆点表示实际打卡。图表附原始数据表和可访问的日期说明。
- 历史日期保留当时的学习日；修改时区不会重写历史归档。

## 推荐规则

算法在 src/algorithms/recommendations.ts，按最近 30 天记录分配下一次学习预算：

1. 到期词汇优先，最多约占预算 40%，每分钟建议复习 2 词。
2. 仍未掌握、累计错至少两次的高频题安排 5 分钟定向重练。
3. 某题型至少有 3 次作答且正确率低于 70% 时，优先最低正确率组；按该组平均难度取整，安排不超过 12 分钟。
4. 其余 Verbal/Quant 保持均衡练习；预算至少 60 分钟且有余量时留出写作练习，剩余时间用于少量新词。

每条建议给出建议时长、数量和依据，总时长不超过预算。规则没有机器学习、能力标定或官方预测分；重复题可能影响判断，少于 3 次不推断薄弱题型，写作建议也不是掌握诊断。算法测试覆盖冷启动、到期、高频错题、样本阈值、日期范围和预算上限。

## 数据库配置与升级

新项目按顺序执行 migrations/ 中五份 SQL（001–005），再执行 seed.sql、questions-seed.sql、writing-seed.sql。已有 Phase 4 数据库只需执行 supabase/migrations/202611030005_writing.sql 和 supabase/writing-seed.sql。在测试项目先验证升级，保留备份。

迁移新增 writing_prompts 和私有 writing_feedback_usage，并扩展既有 writing_submissions，共 20 张业务表。写作通过 writing_action RPC 写入；服务端决定创建时间、时区日期、30 分钟截止时间、修订号，用户不能直接改写表。保存和完成支持相同请求重试；完成后的正文不能改写。题目与作文分离，保存时复制题干，历史不随种子更新改变。

私有数据按 auth.uid() 归属查询。普通账号不能直接写作文、查看 AI 配额表、调用私有文档函数或伪造 AI 返回值。AI 结果仅由受限服务器角色写入。多标签页本地写作、词汇和练习使用同一个 Web Lock 和原子存储快照。

本轮使用 PGlite 执行真实迁移与 RLS/RPC 测试，最小 Auth 模拟仅用于设置测试账号；没有托管 Supabase 凭据，真实 Auth、邮件和 PostgREST 仍需实际项目验收。

## 可选 AI Feedback

默认关闭，未配置时完整写作流程仍可使用。本轮未调用任何外部 AI；仅交付服务端适配器和测试。AI 反馈只包含结构、逻辑、表达、语法、改写建议五个文本字段，拒绝 score 等额外字段，不是 ETS 官方评分。

实现位于 supabase/functions/writing-feedback/。入口使用 Supabase 验证 JWT，按用户权限读已完成作文，再申请配额。只有在用户主动点击按钮时，题目与正文会发给配置的服务；自行记录的修改意见不会发送。

需要维护者提供一个 HTTPS JSON 适配器，并在 Supabase Edge 环境配置以下服务端变量：

| 变量 | 含义 |
|---|---|
| APP_ORIGIN | 前端精确 origin，如 https://your-app.example，无路径或结尾斜杠 |
| AI_FEEDBACK_URL | 你提供的 HTTPS 反馈适配器地址，不是任意模型服务的通用直连地址 |
| AI_FEEDBACK_KEY | 适配器认证密钥，仅服务器使用 |
| SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY | Supabase Edge 运行环境中的项目配置，仅服务器角色密钥用于保存反馈 |

适配器接收 JSON：prompt、essay、instructions；返回 JSON 字符串字段：structure、logic、language、grammar、revision。instructions 明确把作文当作不可信数据，不执行作文中的指令。每项最多 4,000 字符；外部响应最多 100 KB、超时 25 秒、禁止跟随重定向。只接受精确五字段，网页以纯文本展示。

每用户 UTC 日最多 3 次，间隔至少 60 秒；失败请求也占用配额，不能通过切换学习时区绕过。配置和部署函数需要按实际项目执行并验收，本轮不部署。服务器密钥不能以 VITE_ 命名、不能写入前端或提交版本库。服务端配置完成后，才把公开开关 VITE_ENABLE_WRITING_AI 设为 true 并重启/重建前端。按钮仍要求真实登录、完成作文和保存所有修改。

接口实现参考 [Supabase Auth 集成](https://supabase.com/docs/guides/functions/auth-legacy-jwt)、[getUser](https://supabase.com/docs/reference/javascript/auth-getuser) 和 [CORS](https://supabase.com/docs/guides/functions/cors)。Edge 入口已做 TypeScript 检查；纯请求处理器已在 Node 环境使用注入依赖测试。尚未验证 Deno 实际运行、真实模型服务或托管 Edge 部署。

## 内容与维护

4 道 Issue 题为原创 AI 辅助内容，经作者检查，不是官方题库或独立专家认证。src/data/writing.json 记录来源、AI 标记和审核状态；draft 不进入页面和公共查询。编辑后执行 npm run writing:build 生成 writing-seed.sql。已有作文保存原始题干，不受后续内容更新影响。

最值得学习的文件：

- src/algorithms/writing.ts：不依赖 UI 的保存、幂等和修订规则。
- src/features/writing/Editor.tsx：受控文本输入、延迟自动保存、计时和失败保留。
- src/algorithms/analytics.ts：从真实记录按日/周汇总，保留空值。
- src/algorithms/recommendations.ts：可解释的预算分配。
- supabase/migrations/202611030005_writing.sql：服务端校验、账号权限与调用配额。
- src/tests/writing-database.test.ts 与 e2e/phase5.spec.ts：数据库边界和完整浏览器流程。

## 检查命令

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

typecheck 同时检查浏览器和可选 Edge 源码；首次浏览器测试先执行 npx playwright install chromium。当前机器需把每条 npm 替换为 node ../../work/npm/package/bin/npm-cli.js，并将 PLAYWRIGHT_BROWSERS_PATH 设为工作区 work/browsers 的绝对路径。结果与边界见 phase5-verification.md。
