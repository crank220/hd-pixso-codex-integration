# 开发结构与维护约定

HD Design 是 Node.js stdio MCP 插件。Codex 调用受限工具，设计服务先读取 Pixso 最新状态，再在绑定页面或子树内写入；本地桌面与官方远程连接共用范围引擎。

## 文件夹职责

```text
src/
  cli/                  进程入口：server、doctor、login
  mcp/                  MCP 输入契约与属性白名单
  design/               范围会话、快照版本、画布编辑与审查
  pixso/                连接地址、工具发现与上游协议适配
  auth/                 OAuth 凭据存储、PKCE 与回调校验
  library/              内置资产目录查询、真实变体与属性选择
  project/              只读 Vue 项目检查、锁版本与组件映射
  plugin-info.js        从 package.json 读取运行版本
tests/
  unit/                 画布规则、项目读取与组件选择测试
  integration/          服务、真实 stdio、模拟远程与 OAuth 测试
  fixtures/             最小合成 Plugin API，不包含公司设计内容
  schemas/              用于发布校验的第三方 JSON schema
scripts/                构建、目录采集、只读 smoke、打包与包验收
examples/               可复制到业务项目的配置示例
skills/hd-design/       设计工作流、参考规则与授权分发的检索数据
assets/                 插件图标与全页组件元数据目录
docs/                   使用边界、架构、变更与验证记录
  superpowers/          首版方案与计划归档，保留当时的路径和决策
dist/                   生成的独立运行入口与依赖许可证
artifacts/              本机生成的 ZIP 与校验和，不提交 Git
```

插件清单、MCP 配置、marketplace 清单和 `package.json` 保持在宿主要求的位置。示例配置位于 `examples/pixso-codex.example.json`，使用时复制为业务项目根目录的 `.pixso-codex.json`。

## 依赖与执行边界

1. `cli/server.js` 负责注册工具和请求队列；参数由 `mcp/tool-schemas.js` 校验。对外为 12 个工具（包含 pixso_library），不暴露任意脚本执行工具。
2. `design/design-service.js` 管理范围、完整快照摘要和规范读取凭据，调用 `pixso/upstream.js`；项目组件实例化前通过 `project/inspect-project.js` 核对显式映射；library-instance 通过 `library/catalog.js` 从内置目录解析受限 key、变体和文本/布尔覆盖，不能注入任意组件 key。
3. `pixso/upstream.js` 负责 HTTP、工具发现和授权适配；`auth/oauth-provider.js` 仅向 SDK 提供本机凭据，不把 token 放进快照或聊天输出。
4. `design/canvas-runtime.js` 通过 `toString()` 发送到 Pixso 沙箱。它必须自包含，不能引用 Node import 或外部变量；按普通模块拆出内部 helper 会使沙箱缺少依赖，因此保留在一个函数中。

设计写入的检查顺序是：文档身份与范围 → 完整快照 → 全批预检 → 库依赖导入、异步字体加载后再验 → 写入 → 逐项读回。局部写入失败后逆序补偿；只有完整快照一致才返回 `rollback.verified=true`。超时后不能自动重发，因为原生编辑可能已经发生。

`revision` 来自完整快照，返回树的深度和数量裁剪只用于控制上下文大小。切换连接模式会创建新的服务实例并使旧范围失效。公司规范读取凭据、几何检查和截图审查是三个不同证据，不能互相替代。

## 注释与格式

自有 JavaScript 文件用中文文件概述说明职责；关键公共接口使用 JSDoc。注释重点说明权限边界、版本规则、异步竞态、恢复条件、单位和副作用，不逐行复述普通语句。错误码、公开字段和 MCP 工具名保持原有契约；第三方代码及许可证不改写。

使用 Prettier 固定两个空格缩进。`npm run format` 只处理 `src/`、`scripts/`、`tests/`；忽略生成包、依赖、第三方 schema 和内置 UI/UX Pro Max。`npm run check` 会先检查格式，再运行现有回归、构建和发布清单校验。

## 组件库目录更新

在 Pixso 桌面激活指定源库后执行 `node scripts/index-library.js`，脚本核对 fileKey、全部页面及每页组件数量，只更新本地目录，不写画布、不发布库。资产源身份和版本声明需人工核对；页面发生变化时检查覆盖数、对应测试及 README，再构建发布。

## 构建与发布

运行版本从 `package.json` 读取；发布时同步更新 `plugin.json`、`.codex-plugin/plugin.json` 和锁文件版本，校验脚本负责拦截不一致。源码移动后仍生成 `dist/server.js`、`dist/doctor.js` 和 `dist/login.js`，因此已安装用户的 MCP 和 OAuth 入口不变。

```sh
npm ci
npm run dev
npm run check
npm run test:design
npm run smoke:live    # 需要本地 Pixso，只读，不写设计稿
npm run package
node scripts/test-package.js
```

ZIP 仅包含清单指定的安装文件和文档。解压验收会从临时目录启动服务、核对协议版本与工具、执行内置检索，并排除源码、开发依赖、缓存与凭据文件。真实远程账号读写仍需单独授权联调，模拟协议通过不表示真实远程编辑已经验证。

公司资源通过 assets/libraries/registry.json 注册；每库独立目录，libraryId+真实key解析组件、样式与变量。目录解析在Node服务层，原生导入、授权范围应用、引用/属性读回及补偿仍由canvas-runtime执行；共享资源主定义只读。

0.5.0 起资源查询和实例必须显式携带 libraryId，删除历史 Ant 默认选库、抽样发布字段以及服务内直接调用本地上游工具的分支。DesignService 统一依赖上游 info/evaluate/screenshot 接口；连接差异仅由 PixsoUpstream 处理。批次内项目检查只执行一次，组件优先级使用同一份证据。
