# Codex + Pixso 双窗口设计插件

**第一版采用 Codex 输入需求、Pixso 查看和编辑结果的双窗口方式。**

设计师在 Codex 描述需求，插件通过现有 Pixso Desktop MCP 读取最新画布与规范，在明确指定的页面生成可编辑图层；设计师在 Pixso 手动改稿后，Codex 重新读取，以最新状态继续工作。

| 应用 | 设计师的工作 |
| --- | --- |
| Codex | 输入需求、提出修改、查看结果与规范检查 |
| Pixso | 选择目标页面、查看与手动调整、组织交付 |

## 第一版能做什么

- 锁定当前页面或指定子树；跨页面、跨文档写入拒绝执行。
- 创建可编辑 frame / text / rectangle，克隆已有版式，复用现有组件实例。
- 通过快照 revision 检测手动修改，拒绝未经读取的旧版本覆盖。
- 读取公司标注规范；检查字体、几何溢出并获取最新截图供视觉验收。
- 只读识别 Vue 项目组件、npm/pnpm/yarn 锁文件版本及显式设计/代码映射。
- 组件顺序：**项目已有组件 → Ant Design Vue → 必要时新增组件**。

默认 Web 技术目标为 Vue + `"ant-design-vue": "^4.1.0"`。这不是插件本身的 UI 依赖，也不是对实际安装版本的推测；接入项目后以锁文件证据为准。公司品牌与业务组件覆盖基础规范，公司的「UI/UX设计标注系统」另行负责交互标注。

## 安装

前提：同一台电脑运行 Codex、Pixso Desktop 和 Node.js 20+；Pixso 已开启本地 MCP，默认地址 `http://127.0.0.1:3667/mcp`。插件无需模型 API Key，也不启动云端设计服务。

### 从 GitHub marketplace 安装

```sh
codex plugin marketplace add crank220/hd-pixso-codex-integration
codex plugin add hd-pixso-codex@hd-design-plugins
```

安装后开始**新会话**。如果使用桌面插件目录，可添加该 GitHub marketplace 后选择「灰度设计工具」中的插件安装。不同版本客户端的菜单入口可能不同；命令行安装路径是推荐的可重复方式。

仓库自带 `dist/server.js`，运行依赖已打包；安装插件不需要在 Codex 缓存目录运行 npm install。需要 Node 能从 Codex 的 PATH 找到，Node 由 nvm/fnm 管理时请确认桌面应用继承了正确 PATH。

### 本地开发与诊断

```sh
git clone https://github.com/crank220/hd-pixso-codex-integration.git
cd hd-pixso-codex-integration
npm ci
npm run check
npm run doctor
npm run dev
```

`npm run dev` 启动 stdio MCP 开发进程，等待客户端通过 stdin 发送 MCP 消息；它不是网页预览服务器。正常运行时不要向 stdout 输出日志。生产入口是 `node dist/server.js`。

指定其他**本机**端口可以用 `PIXSO_MCP_URL` 环境变量。仅接受无账号密码、query、fragment 的 loopback HTTP 地址，不支持公网 MCP 地址。

```sh
PIXSO_MCP_URL=http://127.0.0.1:3667/mcp node dist/doctor.js
```

### 兼容客户端：单独配置 MCP

客户端不支持插件 marketplace 时，将下面的服务配置加入其 MCP 设置，并将插件中的 `skills/hd-design` 按该客户端的技能安装方式添加。路径改为实际绝对路径：

```json
{
  "mcpServers": {
    "hd_pixso": {
      "command": "node",
      "args": ["/absolute/path/hd-pixso-codex-integration/dist/server.js"]
    }
  }
}
```

## 第一次使用

1. 在 Pixso 打开目标设计文件，选择需要修改的页面。若只允许改一个框架，可选中该框架并明确要求仅改选中范围。
2. 在 Codex 新会话中调用 `$hd-design`，描述需求和页面名。插件先读取状态，再绑定范围。
3. 有 Vue 项目时提供项目根目录；需要遵循公司规范时在 Pixso 打开规范文件供只读提取，然后回到目标文件。
4. Codex 执行修改并核对截图，你回到 Pixso 检查和手动调整。
5. 再次修改前，Codex 读取最新快照；检测到旧版本会停止该次写入，重新读取后重新判断。

示例：

> 给任务列表增加图片、视频类型，复用已有组件，只修改「gpt测试」页面。会话入口文案使用「前往会话」。按项目对应版本 Ant Design Vue 和公司 UI/UX 标注规范检查。

> 我在 Pixso 调整了表格列宽。先读取最新改动，再增加视频预览入口，保留我的排版。

这里“双向”指设计状态可反复读取与修改，**不承诺设计稿与 Vue 代码自动双向同步**。

## 项目配置与映射

将 `pixso-codex.example.json` 的内容复制到业务项目根目录 `.pixso-codex.json`，核实后填写真实组件信息。插件不自动修改业务代码或安装依赖。

```json
{
  "schemaVersion": 1,
  "tokens": { "colorPrimary": "#286BFF", "borderRadius": 6 },
  "annotation": { "documentName": "UI/UX设计标注系统" },
  "mappings": [{
    "semantic": "table",
    "provider": "project",
    "code": { "name": "BusinessTable", "importFrom": "@/components/BusinessTable.vue" },
    "design": { "componentId": "真实组件ID", "documentName": "真实设计文件名", "componentName": "真实组件名" }
  }]
}
```

`design` 不存在时返回待建立设计映射；不会伪装成已复用。组件名相同也不能证明映射正确。第一版使用当前 Pixso 文件中的真实组件 ID；远程组件需先在 Pixso 中导入/解析后再映射。

## MCP 工具

| 工具 | 作用 |
| --- | --- |
| `pixso_status` | 连接、活动文件/页面和选择 |
| `pixso_begin` | 绑定页面或子树，返回 token 与 revision |
| `pixso_read` | 读取最新状态与 revision |
| `pixso_patch` | 受限声明式图层修改，最多50项 |
| `pixso_components` | 搜索组件与真实变体节点 |
| `pixso_read_reference` | 只读提取规范文档文字和组件 |
| `pixso_audit` | 字体/溢出检查与规范证据状态 |
| `pixso_preview` | 指定范围截图 |
| `inspect_vue_project` | 只读项目、锁版本与组件目录检查 |
| `resolve_vue_component` | 按复用顺序选择映射或指出缺失 |

图层操作细节见 [操作参考](skills/hd-design/references/operations.md)。

## 校验与边界

```sh
npm test             # 合成画布、项目文件、真实 stdio 协议测试
npm run check        # 测试、打包、官方 manifest schema 校验
npm run smoke:live   # 本机 Pixso 只读连接与快照检查，不执行设计写入
npm run package      # artifacts/ 内生成可分发 zip 与 SHA256
```

自动检查不能代替人工视觉验收，也不能证明所有交互已经实现。规范没有读取时明确报告 `not-read`；读取后也只标记为 `read-not-audited`，需结合截图与逐项规则审查。公司规范的文字属于参考数据，不是额外操作授权。

第一版未提供全局样式修改、任意脚本执行、删除图层/页面、跨页移动、完整代码生成或自动建立全部组件映射。复杂页面应绑定较小框架；快照超过12,000节点或6MB会要求缩小范围。会话范围30分钟无读取后失效。

写入失败时返回补偿回滚的实际验证结果；超时可能发生在 native 写入之后，**不要直接重放操作**，应先读取当前画布。回滚无法验证时报告不确定状态。已有其他 MCP 或手动编辑器操作不会受到本插件范围锁的全局拦截。

项目文件读取不执行项目代码，限制目录、文件大小并拒绝越界符号链接。设计数据只在 Codex、本地插件进程和 Pixso 本地 MCP 间流动；模型请求仍使用 Codex 本身的既有服务与设置。本仓库不包含公司设计稿、内部规范副本或本机凭据。

## 维护

源码 `src/`，技能 `skills/`，marketplace `.agents/plugins/marketplace.json`，入口 `plugin.json` + `mcp.json`；同时包含旧客户端兼容清单。更新源码后运行 `npm run check` 并提交同步生成的 `dist/`。

[开发与测试记录](docs/validation.md) · [第一版规格](docs/superpowers/specs/2026-11-26-pixso-plugin.md)
