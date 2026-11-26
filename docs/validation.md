# 验证记录

## 0.2.1 · 2026-11-26

本次调整源码职责分类、注释和开发检查，不新增 Pixso 设计操作能力。

- 使用 esbuild 归一化比较目录迁移前后的 7 个核心模块，去除注释、格式和 import 路径差异后执行代码一致；抽出的 3 份 MCP schema 与原输入契约一致。
- `npm run check` 通过：两个空格格式检查、37 项回归、三个独立入口构建、manifest/schema、版本、公共依赖地址和许可校验。
- 源码 stdio 与 ZIP 解压后的 stdio 均核对实际握手版本，公开工具仍为 11 个。
- `node scripts/test-package.js` 通过：从临时目录独立启动，无需源码或 node_modules；组件选择、内置检索、新 examples/docs 路径与发布文件边界通过。
- `npm run dev` 可启动迁移后的开发入口；验证后结束进程。
- `npm run test:design` 命中内置 UX 数据；`npm run smoke:live` 通过真实本地 MCP 只读 status、bind、read，快照 revision 稳定，未修改设计稿。
- 本机使用 Node.js 24.15.0。Node.js 20/22/24 的 Linux 矩阵由仓库 CI 执行；真实远程账号的读写仍不包含在本次验证中。

发布构建保留 `dist/server.js`、`dist/doctor.js`、`dist/login.js`，MCP 工具名、参数、错误码、OAuth 存储路径和设计范围保护契约保持不变。

## 0.2.0

2026-11-26：在原有本地范围引擎上增加远程显式文件绑定、OAuth入口、双模式切换和完整设计精修流程。

- 37项Node自动测试覆盖本地越界拒写、手改旧版本、异步读写竞态、补偿回滚、组件映射、项目读取与真实stdio协议；远程合成画布覆盖链接校验、错误文件、切换页面不影响链接目标、越界写入拒绝、旧快照、独立规范链接与截图参数，以及写入失败不重放。
- OAuth测试保留issuer绑定的token/client对象、凭据权限、state和回调路径校验、撤销token；模拟OAuth协议测试见测试输出。不将测试token用于任何真实服务。
- `pixso_audit.checks` 对明确同组的宽高/同父坐标做数值对比；跨父坐标返回人工核对，截图与公司规范仍需独立审查。
- 内置UI/UX Pro Max检索可命中实际UX数据，不依赖个人绝对路径；包内包含源许可与来源记录。
- 独立ZIP解压后不依赖node_modules启动；manifest、版本、依赖许可与bundled runtime校验。

官方文档核对：远程MCP为 `https://pixso.cn/mcp`，推荐OAuth2.1，支持StreamableHTTP；新版文档列出eval_script和take_screenshot。无凭据的真实initialize探测返回HTTP401及官方OAuth资源元数据。**未用真实远程授权账号执行读写，不宣称端到端兼容已验证。** 上游schema必须具有明确文件参数，否则适配器拒绝发送。

本地真实连接仅进行只读status、bind、read；没有在本次插件测试中修改公司设计稿。真实账户、远程工具schema与席位权限需在用户授权后进一步验证。
