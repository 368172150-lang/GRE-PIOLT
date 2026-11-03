> 历史阶段记录。当前安装、测试与发布请看 [v1.0 交付指南](release-guide.md)。

# Phase 4：Verbal、Quant 与错题本

当前版本 0.4.0，保留 Phase 1–3。写作和完整 Analytics 留待后续阶段；本轮没有部署网站或创建外部账户。

## 运行

安装 Node.js 22 或更新版本后，在项目目录执行 npm ci、npm run dev。未配置 Supabase 时点击“进入本地体验”，填写目标设置即可使用。此机器可用 node ../../work/npm/package/bin/npm-cli.js run dev 启动。记录保存在当前浏览器；清理浏览器数据会清除本地记录，不会自动上传到云端。

## 练习与复盘

- Verbal 有 12 道原创示例：一至三空填空、双选句子等价、单选与多选阅读。
- Quant 有 16 道原创示例：算术、代数、几何、数据分析，支持单选、多选、数量比较和数值填空。
- 按题型、分类、难度、标签或收藏筛选；设置题数和可选时限。刷新可以恢复当前组，开始同模块新组会结束旧组并保留已交答案。
- 题干保持英文；提交后显示英文解析，中文思路单独展开。数学公式使用 KaTeX，解析含选项理由、术语或长难句分析。
- 数值接受有符号整数、小数、分数，例如 0.1 与 1/10 等价；使用精确有理数比较，不接受指数、表达式或零分母，输入最多 80 字符。
- 时限使用持久化截止时间，离开页面仍计时；已到期不能交新答案。跨学习日不能继续旧组。每题耗时是墙钟时间，包含离开页面的时间；它不会自动冒充专注学习分钟。
- 错题本保留首次错误答案与当时题目/解析快照，同时记录最近错误和累计次数。可填写原因、标记掌握、定向重练；再次答错会重新打开掌握状态。保存原因或掌握状态记作今日回顾。
- 每日 Verbal/Quant 任务按当天不同题目数量自动完成。重复刷同一道题不会重复充数；错题回顾接入对应任务。已打卡的每日计划保持冻结。

## 数据库升级

新数据库按文件名顺序执行 supabase/migrations/ 中 001–004 四份迁移，再执行 supabase/seed.sql 和 supabase/questions-seed.sql。已有 Phase 3 数据库只需执行 202611020004_practice.sql 和 questions-seed.sql。先在测试项目检查备份与迁移结果。

浏览器仅填写 .env.example 中两个公开 Supabase 变量。练习使用 practice_action RPC：服务端计算正确性、日期和耗时；题目答案放在受限 question_solutions 表，普通账号不能直接读取。每次提交保存不可变快照，错题、收藏和练习记录按账号隔离。幂等请求防止重复计分，修订号防止过期写入。

本轮已在本地 PostgreSQL 执行迁移、种子和 RLS 测试。没有托管 Supabase 凭据，真实 Auth、邮件、PostgREST 与托管环境仍待实际账号验收。源码和本地体验包含示例答案，定位为学习工具。

## 内容维护与 AI 扩展

28 道初始题目为原创、AI 辅助生成并经本轮作者检查与自动化验证；没有独立 GRE 专家或 ETS 审核，不是官方真题。详见 content-review.md。

源文件 src/data/questions.json 包含公开题目和 solution；UUID 保持稳定，修改题目或答案应增加 revision。执行 npm run questions:build 生成 questions-seed.sql；重新播种不会删除用户历史。

执行 npm run questions:import -- input.json 可把 1–200 道、最多 2 MB 的题目暂存到 work/question-import-draft.json，强制 draft，不改在线题库。此入口只做基础结构检查；人工检查题干、唯一答案、双语解析、来源与完整 schema 后，再合入源文件并运行测试、生成种子。AI 草稿不自动发布；应用和数据库均排除 draft。

## 验证命令

npm run lint、npm run typecheck、npm test、npm run build、npm run test:e2e。首次浏览器测试需要 npx playwright install chromium。当前机器的浏览器缓存位于工作区 work/browsers，可设置 PLAYWRIGHT_BROWSERS_PATH 指向它。具体结果见 phase4-verification.md。
