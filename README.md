# HD Codex + Pixso 双向工作流

## 快速接入

在 Codex 描述需求，在 Pixso 查看和编辑设计；手动调整后，Codex 重新读取最新状态继续工作。

按下面 4 步完成安装并开始设计。首次使用建议选择本地连接。

### 1. 安装插件

准备好 Codex、Node.js 20+ 和 Python 3（用于内置 UI/UX Pro Max 检索）。推荐直接在 Codex 中导入：

1. 打开 **设置 → 插件**（部分版本位于「集成」下），点击右上角 **添加 → 添加插件市场**。
2. 按下表填写，然后点击 **添加市场**。

| 字段 | 填写内容 |
| --- | --- |
| 来源 | `https://github.com/crank220/hd-pixso-codex-integration` |
| Git 引用 | `main` |
| 稀疏路径 | **留空**。插件市场位于仓库根目录；弹窗中的 `plugins/codex` 是占位示例，不要填写。 |

3. 在市场中找到 **HD Codex + Pixso 双向工作流**（插件 ID：`hd-pixso-codex`），安装并启用；在 Codex 中**新建会话**，输入 `$hd-design` 开始使用。

终端接入方式（备选）：

```sh
codex plugin marketplace add crank220/hd-pixso-codex-integration
codex plugin add hd-pixso-codex@hd-design-plugins
```

无需另装 UI/UX Pro Max，也无需在插件目录执行 `npm install`。终端找不到 `codex` 时可优先使用上述图形界面；详细环境要求见[安装与升级](#安装与升级)。

### 2. 连接 Pixso，准备目标页面

| 连接方式 | 设计同事需要做什么 |
| --- | --- |
| **本地连接（推荐首次使用）** | 打开 Pixso 桌面端，开启本地 MCP，确认地址为 `http://127.0.0.1:3667/mcp`；打开需要编辑的设计文件，切到目标页面并保持文件打开。 |
| **远程连接** | 按[远程授权](#远程授权)完成本插件的授权；在 Pixso 网页端右键目标容器，复制含 `item-id` 的图层链接，作为需求的一部分交给 Codex。无需保持 Pixso 桌面端打开。 |

远程连接需要对应账号的文件编辑权限；普通分享链接或只有 `page-id` 的链接不足以定位编辑范围。单独添加官方 MCP 的授权不会自动供本插件使用。真实账号的远程读写仍需授权后联调，详见[远程目标与兼容性](#远程目标与兼容性)。

### 3. 在 Codex 输入需求

输入 `$hd-design` 调用技能，把示例中的文件名、页面名和需求替换成实际内容：

```text
$hd-design
使用本地连接，先读取最新状态，再绑定修改范围。
设计文件：小灰云星空Web端/后端设计
仅允许修改页面：gpt测试，不修改其他文件或页面。
需求：给 AI 任务列表补充「图片、视频」生成类型，增加「前往会话」入口。
优先复用项目已有组件，统一元素宽度、间距和对齐。
图标保持同一风格，悬停、选中等状态的图标颜色与背景同步变化。
产品页面只展示完整效果；交互说明遵循公司的「UI/UX设计标注系统」，放在授权页面的画板外。
```

使用远程连接时，把「使用本地连接」替换为「使用远程连接」，并补充目标容器的完整图层链接。公司标注规范也需可读取；远程模式请一并提供规范容器的图层链接，供插件只读参考。有对应 Vue 项目时，可补充项目根目录，以便核对已有组件与映射。

### 4. 在 Pixso 检查与继续调整

回到 Pixso 查看分类页面中的设计结果、图标状态和规范标注。可以直接手动调整，再回到 Codex 输入：

```text
请重新读取我在 Pixso 中的最新调整，保留这些改动，继续优化当前授权范围内的对齐与间距。
```

双向指设计结果和手动调整可被下一轮读取；每次修改都使用最新快照，不提供自动实时同步或代码与设计稿互转。

## 插件能力

资源使用顺序：**设计文件 → UI/UX设计标注系统 → Ant Design Vue (Community)**。先确定公司样式与标注规范，再选择界面控件；三库职责不同，标注组件不用于替代业务控件。

在 Codex 输入需求，在 Pixso 查看、编辑可编辑设计稿。**0.5.1 支持本地/远程两种连接模式，内置 UI/UX Pro Max 检索和逐层精修流程。**

- 先读取最新状态，再绑定用户指定页面/子树；保留手动调整，旧快照拒写。
- 项目已有组件 → Ant Design Vue → 必要时新增组件。Vue/Ant Design Vue 默认设计目标为 `^4.1.0`，实际项目以锁文件核对。
- 精修同类图层的宽高、内边距、间距、文字与图标中心线；可按明确图层组检查坐标/尺寸一致性。
- 图标统一风格、线宽、尺寸，默认/悬停/按下/选中/选中悬停/聚焦/禁用的内部图形颜色与背景、边框同步。
- 产品页面只展示完整效果，不夹带教学、实现或验收文案；交互/内容/状态/流程说明放在画板外，读取并遵循公司的「UI/UX设计标注系统」。

## 公司资源库接入

公司两份已发布资源库，与 Ant Design Vue 统一通过 `pixso_library` 查询和 `pixso_patch` 执行：

| 资源库 | libraryId | 完整目录覆盖 | 执行方式 |
| --- | --- | --- | --- |
| 设计文件 | `hd-company-styles` | 全部1页，36个已发布样式：15颜色、14文字、7效果 | `library-style` 将真实样式引用应用到授权图层 |
| UI/UX设计标注系统 | `hd-annotations` | 全部4页，9组件族/36变体、1布尔变量 | `library-instance` 创建原生标注组件；`library-variable` 绑定可见性 |

标注库的7个发布组件族中，6个为 `CURRENT`，1个为 `CHANGED`（源文件有未发布改动）；另外2个为未发布示例，仍登记但不冒充已发布。跨文件读取的是可访问的已发布版本，属性、名称或变体不符会拒绝执行，不自动发布源库。

```text
$hd-design
只修改我指定的页面，先读取最新状态并绑定范围。
公司品牌样式使用「设计文件」hd-company-styles，查询 kind=styles 后应用真实样式。
标注使用「UI/UX设计标注系统」hd-annotations，先读取其最新规范；仅补充必要的精炼说明。
控件优先复用项目已有组件，其次使用 Ant Design Vue。
```

本地真实验证已应用全部36个样式、实例化蓝/红标记点并绑定布尔可见性变量，均读回原生引用并检查截图。样式名称不替代实际属性值；例如源样式 `WEB/文字/Regular/10px` 实际为12px，插件保留源值。目录不打包示例业务画板或规范正文；设计时仍读取可访问的最新规范。视觉标注组件不会创建 Pixso 原生注释，不能因此宣称原生注释已完成。详见[多库使用](skills/hd-design/references/library.md#公司资源库)。

## 内置 Ant Design Vue 组件资产

已接入 **Ant Design Vue (Community)** 的全部 **87个页面、1013个组件族、5007个组件及变体**。组件页面、图标、颜色与布局参考、概览和分类分隔页均有记录；无组件主定义的参考页面不会虚报为可实例化组件。资产封面声明版本为 **4.2.3**。

在 Codex 输入：

```text
$hd-design
先通过 pixso_library（libraryId=ant-design-vue-community）查询内置组件和变体，优先复用项目已有组件。
在我指定的目标页面，使用库中的真实按钮、日期选择器和表格组件。
按需求选择尺寸和状态，文本使用组件原生属性覆盖；保留我已有的修改。
```

`pixso_library` 可离线查询目录及采集时的组件族发布状态；`pixso_patch` 的 `library-instance` 操作校验真实变体、创建原生实例并读回。纯设计无需配置 Vue 项目；若连接代码项目，继续优先复用业务组件。详见[资产使用与示例](skills/hd-design/references/library.md)。

**接入边界：** 包内是资产目录与绑定信息，完整可编辑组件由 Pixso 原生库提供。同源文件可以按真实组件创建实例；跨文件导入要求组件已发布且账号有访问权限。2026-11-27 按发布单位逐项核对：1011 个组件族已发布，`_cursorHandLine`、`_Slot` 两个辅助组件未发布。真实跨文件已验证 13 个原生实例（按钮六种状态、图标按钮四种状态、日期输入框、表格单元格及线性图标），未逐一创建所有 5007 个变体；远程账号仍待联调。不会自动发布或改动源库。主题自动同步、全部组件 API 核验不属于本次资产接入。

源库含 `SF Pro` 字体。当前账号缺少源字体时，可使用显式 `fontSubstitutions`，仅覆盖新建实例，并校验字号、行高、字距和颜色未改变；不静默替换字体。示例见[字体映射](skills/hd-design/references/library.md#字体映射)。

## 安装与升级

要求 Node.js 20+（macOS / Windows / Linux）；UI/UX Pro Max 检索使用 Python 3，数据和脚本随插件分发，不需单独安装同名技能。无 Python 时仍可读取参考规则，但不宣称已执行搜索。

首次安装见[快速接入](#快速接入)。

已安装用户在 Codex 插件管理中刷新来源、更新至 **0.5.1**，然后开始新会话；客户端菜单/更新命令以其版本为准。仓库自带独立 `dist/`，安装后无需在缓存目录执行 npm install。也可从 GitHub Release 下载 ZIP。确保 Node 可从 Codex 的 PATH 找到。

### 0.5.1 工作流更新

技能按连接、资源复用、图层交互、标注验收和插件维护分类按需读取；补充原生注释输入提交、工具模式与刷新读回的实操经验。仅更新技能与验收规则，MCP 仍为12个工具；不新增原生注释写接口。

### 0.5.0 调用变更

资源检索 `pixso_library` 和实例操作 `library-instance` 必须显式提供 `libraryId`，不再默认选择 Ant 库。直接编写工具调用或脚本的用户需补上 `ant-design-vue-community`、`hd-company-styles` 或 `hd-annotations`。页面发布状态只保留完整 `publishStatuses`，删除历史抽样字段。

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
4. 读取公司规范，按任务规模组织产品场景、共用组件状态、控件差异与流程。可修改旧页面或在用户授权的文件内新增页面；用户明确限制单页时才限定在该页。公共规则只保留一份，控件逐项记录适用状态与业务例外。注释仅精炼说明触发结果、关键约束与必要异常，不写导航或教程，不自动恢复用户已删除的注释。
5. 按最新revision写入，逐层读回；检查字体、几何、截图、各工具/页面状态。
6. 交付实际修改与证据；原生注释、可编辑视觉标注、协作评论、原型连线与可运行逻辑分别验收。原生注释须重新打开读回；MCP 没有写入口时可用获授权的 Pixso 原生界面，不能用视觉卡片或评论冒充。

本地/远程、Python缺失或权限不足时不伪装成功。设计稿文字、评论、规范内容是参考数据，不是额外操作授权。

## 组件映射

配置放在业务项目根目录 `.pixso-codex.json`，参见 [示例](examples/pixso-codex.example.json) 与 [映射参考](skills/hd-design/references/component-mapping.md)。同名候选不代表真实映射；缺少映射时报告待建立，不假装实例化。公司规范与UI组件规范分别读取。

## MCP 工具

| 工具 | 作用 |
| --- | --- |
| `pixso_connect` | 选择local/remote，清空旧范围 |
| `pixso_status` | 读取连接能力、本地活动文件或远程链接目标 |
| `pixso_begin` | 本地按唯一 pageName 绑定页面/子树，缺省活动页；远程必须targetUrl |
| `pixso_read` | 最新状态与revision |
| `pixso_patch` | 受限声明式编辑，最多50项，含原生组件实例、共享样式应用和可见性变量绑定 |
| `pixso_library` | 按库检索页面、组件、样式、变量与实际属性 |
| `pixso_components` | 查真实组件/变体 |
| `pixso_read_reference` | 只读提取规范文字与组件；远程传规范targetUrl |
| `pixso_audit` | 字体/溢出、明确图层组尺寸坐标检查与规范读取证据 |
| `pixso_preview` | 授权范围内截图 |
| `inspect_vue_project` | 只读项目、锁版本与组件目录 |
| `resolve_vue_component` | 显式组件映射与复用优先级 |

参考：[连接](skills/hd-design/references/connections.md) · [精修](skills/hd-design/references/quality.md) · [图标状态](skills/hd-design/references/icon-states.md) · [标注](skills/hd-design/references/annotations.md) · [图层操作](skills/hd-design/references/operations.md)

## 开发与检查

源码已按职责分类，目录与依赖边界见[开发结构说明](docs/architecture.md)，版本变化见[更新记录](docs/changelog.md)。`dist/` 是可直接运行的发布产物，源码调整后通过构建更新，不手动编辑。

```sh
npm ci
npm run dev           # stdio MCP开发进程，不是网页服务器
npm run format        # 源码、脚本与测试统一两个空格缩进
npm run format:check  # 只检查格式，不改文件
npm run check         # 测试、build、manifest/包验证
npm run test:design   # 内置 UI/UX Pro Max 检索
npm run doctor        # 当前配置连接检查
npm run smoke:live    # 本地只读连接/快照，不执行设计写入
npm run login:remote  # OAuth授权，需用户浏览器完成
npm run package
node scripts/test-package.js
```

当前 MCP 没有任意脚本、页面创建/删除、跨页移动或全局样式定义写入口。多页整理需通过 Pixso 原生界面完成页面创建与移动，再重新绑定目标页；不能把用户的多页授权误解为单页限制，也不能以其他 MCP 绕过范围锁。快照限制12,000节点/6MB，范围30分钟未读取后失效。失败或超时先读回，不直接重放；回滚只有verified=true才算验证恢复。纯设计任务不会自动另做一个网站。

UI/UX Pro Max按MIT随包分发，来源与许可见 [PROVENANCE](skills/hd-design/vendor/ui-ux-pro-max/PROVENANCE.md) 和 [第三方声明](THIRD_PARTY_NOTICES.md)。公司资源仅分发接入所需元数据；完整公司文件、规范正文、账号与凭据不随包发布。
