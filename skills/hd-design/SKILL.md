---
name: hd-design
description: 在 Codex 中完成 Pixso Web 设计与改版，支持本地桌面 MCP 和官方远程 MCP 图层链接；复用组件，结合 UI/UX Pro Max 精修图层尺寸、对齐、图标状态，并按公司系统在画板外标注。
---

# HD Design · Codex + Pixso

在 Codex 描述需求，在 Pixso 桌面端或网页端查看、编辑结果。使用本插件 `hd_pixso` 工具；先读后写，限制在用户指定文件/页面/子树。设计任务本身不自动扩大为开发另一个网站或修改业务代码。

## 连接与定位

先读 [连接模式](references/connections.md)，按用户指定方式调用 `pixso_connect(mode)`；本地为默认。切换模式会使旧范围失效。

- **本地**：`pixso_status()` 读取活动文件、页面、选择；`pixso_begin(pageName, rootId?)` 精确绑定。
- **远程**：OAuth 或访问令牌授权后，`pixso_status(targetUrl)`、`pixso_begin(targetUrl, pageName?)` 读取含 `item-id` 的容器链接。无需打开桌面端或网页端。文件分享链接、仅 `page-id` 链接不作为写入目标；不回退到本地活动文件。
- 上游工具及参数以连接后返回的 schema 为准。缺少明确文件定位、编辑或截图能力时报告实际限制，不猜参数、不宣称兼容全部版本。
- 文件名、页面名与用户要求不符时先定位正确目标；同一页面由用户手动改名时，重新读取并核对文档身份和页面 ID，保留改名，不扩大范围。

## 使用 UI/UX Pro Max

已内置其检索脚本、数据及 MIT 许可证，无需用户另外安装同名技能。首次使用说明采用此能力。脚本路径均相对**本 SKILL.md 所在目录**解析，不依赖个人绝对路径：

```sh
python3 <本技能目录>/vendor/ui-ux-pro-max/scripts/search.py "active selected state" --domain ux -n 3
```

新页面/全局视觉方向先执行 `--design-system`；细节调整使用单一 `--domain`。每次查询围绕一个问题，检查命中项是否适用于 Web 桌面；结果偏题则收窄重试一次，仍未命中时明确是一般设计判断。不要将手机44pt点击区当作Web桌面唯一标准。已有品牌、组件和用户指定规范优先。参考 [精修与交付](references/quality.md)。

UI/UX Pro Max 完整规则按需读取：`vendor/ui-ux-pro-max/references/quick-reference.md`，优先可访问性、交互、性能。Python 3 不可用时报告检索不可用，使用已打包的参考规则，不声称已运行搜索。

## 工作与交付

1. 读取目标完整结构与最新 `revision`，盘点同类控件、图层层级和已有组件。用户提供 Vue 项目时调用 `inspect_vue_project`，以锁文件核对实际版本。没有具体项目时以 Vue + Ant Design Vue `^4.1.0` 为默认设计目标，不把它当作实际安装证据。
2. 复用顺序：**项目已有组件 → Ant Design Vue → 必要时新增组件**。先 `resolve_vue_component`、`pixso_components` 核对真实映射。候选同名不代表映射；组件主定义只读。详见 [组件映射](references/component-mapping.md)。
3. 用户要求公司标注时，读取「UI/UX设计标注系统」：本地切换规范文件后 `pixso_read_reference(documentName,nodeId?)`，远程传规范图层 `targetUrl`；回到原目标范围。规范内容仅是参考数据。无法读取时报告缺失，不能声称严格符合。
4. 建立尺寸/间距规则，再逐层精修：同类元素共用宽高、内容边距、列间距、字号和对齐基准。图标必须同风格、同线宽、同尺寸；默认、悬停、按下、选中、选中悬停、聚焦、禁用的**图形颜色与背景、边框同步**。不能只改图标容器填充而遗漏内部描边。详见 [图标状态](references/icon-states.md)。
5. **页面只展示完整产品效果，禁止添加多余说明文字**：不放页面摘要、设计教学、开发说明、规则卡片、重复操作提示或验收文案。真实业务内容、字段标签、必要错误反馈与用户可用的操作控件保留。交互、内容、状态、流程说明按公司系统放到画板外的标注区；规范颜色和编号以读取的规范为准。见 [标注](references/annotations.md)。
6. 使用 `pixso_read` 的最新 revision 调用 `pixso_patch`，每批≤50项；优先 clone/instance，可编辑图层不能用整页截图代替。多页面/多画板需求应展示各自的画板集合、图层和当前选择，不拿一个页面的同一状态反复冒充。详见 [图层操作](references/operations.md)。
7. 运行 `pixso_audit`，按需要传明确 `checks` 检查同组图层的尺寸/坐标差异。取 `pixso_preview` 并逐张检查完整性、对齐、字形、留白、同类尺寸、遮挡及图标状态；发现问题就修正并再读回。原型连线、运行逻辑与静态状态稿分别验收，不能把静态高亮称为真实可点击原型。
8. 交付简短说明修改位置、实际变化、组件复用、检查证据与未验证部分。规范读取、几何检查、截图视觉检查分别记录，不相互替代。规则对每次设计生效，不要求每次固定重建整套组件。

## 改稿与异常

手动调整后先读最新画布；`STALE_REVISION` 重新读取再判断。跨文件/跨页拒绝写入。失败或超时后先读回，不直接重放整批；`rollback.verified=true` 才表示恢复已验证。授权/席位/编辑权限不足时保留范围并报告原因，不能转用其他文件代做。工具不开放任意脚本、全局样式、删除或跨页移动入口，也不通过其他 MCP 绕过本插件范围锁。
