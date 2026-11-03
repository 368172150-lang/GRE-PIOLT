# 部署与真实云端验收

本项目尚未公开部署。以下是维护者在获得授权并完成配置后可执行的步骤，当前源码包已经准备好。

## 构建

使用 Node.js 24 LTS，npm ci 后执行 npm run verify。Vercel 项目框架选 Vite，安装 npm ci，构建 npm run build，输出 dist，项目根目录为 gre-pilot。vercel.json 已提供 SPA 回退、CSP、禁止 iframe、nosniff、Referrer/Permissions Policy。

VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY 是公开浏览器变量，必须在构建前配置。环境变量改变后重建；已有 dist 不会在运行时读取 .env。禁止把 Service Role/AI Key 加到 VITE_ 变量。

静态包 GRE-Pilot-Web-v1.0.0.zip 以本地模式构建。解压后内容须放在支持 SPA 回退的 HTTP(S) 主机，附带静态托管 vercel.json、无依赖 serve.mjs 与说明。安装 Node.js 后可 node serve.mjs 在本机直接使用，默认端口 5173。其他平台也需把非资源的应用路由回退到 index.html，静态资源保持正确 MIME。请勿直接用 file:// 打开。

## Supabase

先在测试项目执行五份迁移和三份种子，核对 20 张业务表、RLS、owner 策略及 RPC 的授权范围。开启邮箱确认；把前端 origin 设置为 Auth Site URL/允许回调，配置邮件服务。使用两个测试账号：

1. A 注册、确认邮件、登录、设置目标；重置密码并用新密码重新登录。
2. A 学词、练习、创建错题、完成作文、记录分钟并打卡；刷新、退出和重新登录，数据应一致。
3. B 不应读到 A 的作文、答案、词汇进度、错题或收藏；尝试带 A 的 UUID 写入应失败。
4. 用当前用户时区检查跨日与任务冻结，重复提交不能重复计数。
5. 按需配置可选 Edge 适配器，再验证 JWT、origin、日配额、失败降级和密钥不在浏览器 bundle。

服务端数据应通过项目备份策略保护；先备份，再在测试项目升级。不要把生产用户记录写入公共 GitHub issue、CI artifact 或演示种子。

## 发布后核对

刷新 /writing、/quant、/analytics 不应 404；JS/CSS/字体和 favicon 均有正确 MIME；CSP 不应有脚本违规。使用实际账号完成上述隔离流程，再把验收日期、项目配置与发布版本写进维护记录。Vercel 的头部实际应用情况需要部署后复核；本轮只在本机生产服务器验证同一组配置。

参考：[Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)、[vercel.json](https://vercel.com/docs/project-configuration/vercel-json)、[Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)、[Supabase Auth](https://supabase.com/docs/guides/auth/passwords)。
