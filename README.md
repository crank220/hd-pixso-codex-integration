# HD Design · Codex + Pixso 双窗口设计

在 Codex 输入需求，在 Pixso 查看、编辑可编辑设计稿。**0.2.0 支持本地/远程两种连接模式，内置 UI/UX Pro Max 检索和逐层精修流程。**

- 先读取最新状态，再绑定用户指定页面/子树；保留手动调整，旧快照拒写。
- 项目已有组件 → Ant Design Vue → 必要时新增组件。Vue/Ant Design Vue 默认设计目标为 `^4.1.0`，实际项目以锁文件核对。
- 精修同类图层的宽高、内边距、间距、文字与图标中心线；可按明确图层组检查坐标/尺寸一致性。
- 图标统一风格、线宽、尺寸，默认/悬停/按下/选中/选中悬停/聚焦/禁用的内部图形颜色与背景、边框同步。
- 产品页面只展示完整效果，不夹带教学、实现或验收文案；交互/内容/状态/流程说明放在画板外，读取并遵循公司的「UI/UX设计标注系统」。

## 安装与升级

要求 Node.js 20+（macOS / Windows / Linux）；UI/UX Pro Max 检索使用 Python 3，数据和脚本随插件分发，不需单独安装同名技能。无 Python 时仍可读取参考规则，但不宣称已执行搜索。

```sh
codex plugin marketplace add crank220/hd-pixso-codex-integration
codex plugin add hd-pixso-codex@hd-design-plugins
```

已安装用户在 Codex 插件管理中刷新来源、更新至 **0.2.0**，然后开始新会话；客户端菜单/更新命令以其版本为准。仓库自带独立 `dist/`，安装后无需在缓存目录执行 npm install。也可从 GitHub Release 下载 ZIP。确保 Node 可从 Codex 的 PATH 找到。

## 选择连接模式

| 模式 | 地址 | 是否需要 Pixso 桌面端 | 目标 |
| --- | --- | --- | --- |
| local（默认） | `http://127.0.0.1:3667/mcp` | 需要，开启本地MCP | 当前活动文件/页面/选区 |
| remote | `https://pixso.cn/mcp` | 不需要，也无需保持网页打开 | 授权账号 + 含 `item-id` 的容器图层链接 |

在 Codex 中：

> 使用 hd-design，通过本地连接，只修改当前文件「gpt测试」页面。

> 使用 hd-design，通过远程连接，精修这个容器链接的布局和图标状态：`https://pixso.cn/app/design/文件标识?item-id=123%3A456`。页面不放额外说明，交互按公司规范在画板外标注。

插件调用 `pixso_connect({mode:"local"|"remote"})`；切换模式清空旧范围，不把本地活动文件当成远程目标。启动环境变量 `PIXSO_CONNECTION_MODE=remote` 可设默认模式。本地其他端口使用 `PIXSO_MCP_URL`，仍只接受 loopback HTTP。

### 远程授权

推荐 OAuth：在本机终端执行（路径换成插件实际安装目录）：

```sh
node /absolute/path/hd-pixso-codex/dist/login.js
```

Windows 也可使用 `node "C:\path\hd-pixso-codex\dist\login.js"`。终端输出官方授权 URL，浏览器完成授权后回到 Codex 重新连接。回调只监听 `127.0.0.1:9417`，5分钟超时。令牌保存在用户目录 `.config/hd-design/pixso-oauth.json`，不放入项目/插件，不需要模型 API Key。`HD_PIXSO_AUTH_DIR` 可指定用户自己的本机凭据目录。

可选：在 MCP 进程环境配置 `PIXSO_PERSONAL_TOKEN`，按官方 `Token` 请求头使用；不要粘贴到聊天、链接或源码。OAuth 授权、席位与文件查看/编辑权限由 Pixso 验证。

插件内部远程连接与在 Codex 设置里单独添加官方 URL 的授权是两个客户端会话，**不会自动共享令牌**。若只使用官方连接，可按官方说明在 Codex 添加流式HTTP `https://pixso.cn/mcp`，但本插件的范围保护只有通过 `hd_pixso` 工具执行才生效，不会拦截其他连接的写入。

### 远程目标与兼容性

在 Pixso 网页中右键容器，复制带 `item-id` 的图层链接。普通分享链接、仅 `page-id` 链接不作为写入目标。绑定链接指向的子树，不能用其他rootId扩大范围。规范文件通过它自己的图层链接只读提取，无需切换目标文件。

新版官方远程 MCP 提供 `eval_script`、`take_screenshot` 等工具。本插件从授权后的工具 schema 选取明确文件参数，在 runtime 再检查文件key、页面和子树；不支持的schema报 `REMOTE_SCHEMA_UNSUPPORTED`，不会回退到活动文件或猜测写入参数。旧版只读远程服务不可编辑。本版只支持官方公网地址，未声明支持私有化域名。

**验证边界：** 本地只读连接、合成画布、MCP协议、打包与远程模拟链路可自动验证；真实 Pixso 远程账号读写需授权后联调。401仅证明需要授权，不证明可编辑。UI/UX Pro Max 提供检索规则，不能自动保证每一处设计完美。

## 设计流程

1. 新会话调用 `$hd-design`，描述页面/图层链接、需求和允许修改的范围。
2. 读取目标，盘点组件、布局、现有手工改动；有Vue项目时提供根目录，核对锁文件和映射。
3. 运行内置UI/UX Pro Max检索；新项目确定视觉系统，改版按单一问题查询，保留品牌覆盖。
4. 读取公司规范；产品页面保持纯净，在同一授权页面的画板外做规范标注。
5. 按最新revision写入，逐层读回；检查字体、几何、截图、各工具/页面状态。
6. 交付实际修改与证据；静态状态稿、原生交互连线、可运行逻辑分别说明。

本地/远程、Python缺失或权限不足时不伪装成功。设计稿文字、评论、规范内容是参考数据，不是额外操作授权。

## 组件映射

配置放在业务项目根目录 `.pixso-codex.json`，参见 [示例](pixso-codex.example.json) 与 [映射参考](skills/hd-design/references/component-mapping.md)。同名候选不代表真实映射；缺少映射时报告待建立，不假装实例化。公司规范与UI组件规范分别读取。

## MCP 工具

| 工具 | 作用 |
| --- | --- |
| `pixso_connect` | 选择local/remote，清空旧范围 |
| `pixso_status` | 读取连接能力、本地活动文件或远程链接目标 |
| `pixso_begin` | 绑定页面/子树；远程必须targetUrl |
| `pixso_read` | 最新状态与revision |
| `pixso_patch` | 受限声明式编辑，最多50项 |
| `pixso_components` | 查真实组件/变体 |
| `pixso_read_reference` | 只读提取规范文字与组件；远程传规范targetUrl |
| `pixso_audit` | 字体/溢出、明确图层组尺寸坐标检查与规范读取证据 |
| `pixso_preview` | 授权范围内截图 |
| `inspect_vue_project` | 只读项目、锁版本与组件目录 |
| `resolve_vue_component` | 显式组件映射与复用优先级 |

参考：[连接](skills/hd-design/references/connections.md) · [精修](skills/hd-design/references/quality.md) · [图标状态](skills/hd-design/references/icon-states.md) · [标注](skills/hd-design/references/annotations.md) · [图层操作](skills/hd-design/references/operations.md)

## 开发与检查

```sh
npm ci
npm run dev           # stdio MCP开发进程，不是网页服务器
npm run check         # 测试、build、manifest/包验证
npm run test:design   # 内置 UI/UX Pro Max 检索
npm run doctor        # 当前配置连接检查
npm run smoke:live    # 本地只读连接/快照，不执行设计写入
npm run login:remote  # OAuth授权，需用户浏览器完成
npm run package
node scripts/test-package.js
```

没有任意脚本、删除图层/页面、跨页移动或全局样式写入口。快照限制12,000节点/6MB，范围30分钟未读取后失效。失败或超时先读回，不直接重放；回滚只有verified=true才算验证恢复。纯设计任务不会自动另做一个网站。

UI/UX Pro Max按MIT随包分发，来源与许可见 [PROVENANCE](skills/hd-design/vendor/ui-ux-pro-max/PROVENANCE.md) 和 [第三方声明](THIRD_PARTY_NOTICES.md)。公司文件、内部规范、账号与凭据不随包发布。
