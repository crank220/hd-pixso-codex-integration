# 资源库与原生复用

使用顺序：**设计文件 → UI/UX设计标注系统 → Ant Design Vue (Community)**。先确定品牌样式与标注规范，再选择UI组件；项目已有控件仍优先复用。

## Ant Design Vue 资产目录

使用用户指定的 **Ant Design Vue (Community)** 文件：`cqyV7EPRujL6ptWDBKKlSQ`。封面声明 **4.2.3**；这是 UI kit 的版本声明，不能自动证明它与项目安装的每个 API 相符。源组件及主定义只读，不自动发布团队库。

## 覆盖与查找

`pixso_library({libraryId:"ant-design-vue-community"})` 离线检索全部 **87 页、1013 个组件族、5007 个组件及变体**，含 Icon 页的独立组件。目录记录所有页面；Thumbnail、Overview、Color、Flex、Grid、Layout、Affix、ConfigProvider、App 等无主组件页面作为参考，分类分隔页保留记录但不算组件。

- `pixso_library({libraryId:"ant-design-vue-community",page:"Button"})` 找组件族；`page` 不需要原页面名中的缩进空格。
- `pixso_library({libraryId:"ant-design-vue-community",familyId:"144:5014",offset:0,limit:20})` 读取属性定义和分页变体。属性名、大小写和值以返回数据为准，不能把另一套 Ant Design 库的命名套过来。
- 全页索引不需要扫描整页快照；Form、DatePicker 等大页面应按具体组件族处理，避免超过快照上限。

目录随 ZIP 分发，包含真实 key、来源、原节点、属性与尺寸，不包含完整画布几何、业务设计稿或凭据；没有账号权限时不能把目录当作离线设计资产本体。

## 创建原生实例

先绑定用户允许修改的目标页面或子树，读最新 revision，然后：

```json
{
  "scopeToken": "已绑定的token",
  "expectedRevision": "最新revision",
  "operations": [{
    "op": "library-instance",
    "libraryId": "ant-design-vue-community",
    "key": "primaryHover",
    "parentId": "授权范围内的容器ID",
    "familyId": "144:5014",
    "variants": {
      "Type": "primary", "State": "hover", "Size": "default",
      "Shape": "default", "Status": "default"
    },
    "componentProperties": {"Text#144:0": "确认"},
    "props": {"x": 24, "y": 24}
  }]
}
```

- 直接选择目录中真实变体再实例化；未给出的轴优先使用唯一默认组合，缺失或含糊时报错，不取列表第一项凑数。
- 原生文本、布尔覆盖使用 `componentProperties` 中实际完整属性名；图标换项暂不开放。读取属性定义后再填写，不把可见文本当属性ID。
- 纯设计任务不要求 Vue 项目目录。若已连接项目，传 `projectRoot`，优先处理项目封装；原有 `instance` 操作仍要求显式项目映射，不允许绕过。
- 同源文件核对 sourceNodeId 和 key 后创建实例。跨文件使用 `importComponentByKeyAsync`，只导入依赖，不改源组件。**仅已发布且账号有权访问的组件可以跨文件导入**。发布状态按组件集或独立主组件采集，不能用单个变体返回的 UNPUBLISHED 判断整个组件集未发布。最新目录为1011个 CURRENT、2个未发布辅助组件（_cursorHandLine、_Slot）；状态是采集快照，真实导入仍由 Pixso 校验。
- 导入后校验 key、名称、变体，覆盖后读回文字/布尔属性，再验证实例类型、mainComponent key、范围和最新版本。导入或权限失败保留原错误，不重绘假组件、不切换其他文件代做、不自动重放。
- 原生导入可能缓存组件依赖；回滚验证针对授权目标的可见节点，不声称清除了编辑器内部依赖缓存。

## 字体映射

源库含 SF Pro。先核对项目字体和 Pixso 可用字体；缺少源字体时可显式传入下面的 `fontSubstitutions`，与 `variants` 同级。它只作用于新建的原生实例，不改变源组件或全局样式：

```json
"fontSubstitutions": [{
  "from": { "family": "SF Pro", "style": "Regular" },
  "to": { "family": "Noto Sans SC", "style": "Regular" }
}]
```

每个字重分别映射，不默认补全或静默回退。目标字体使用 Pixso 返回的完整字体身份；原生文本属性覆盖后，在实例文字上解除共享文字样式引用并应用字体覆盖，读回核对字体、字号、行高、字距和颜色。混合字体的文字节点暂不支持此映射；目标字体不可用或读回不符时明确失败并撤回本批可见改动。

组件族的属性定义是候选集合；具体变体不一定开放全部属性。例如 Button 的 loading 变体未开放 Text/Show Icon，不应套用普通按钮的覆盖字段；以创建实例后的实际属性校验为准。

2026-11-27 本地真实跨文件已验证13个原生实例并检查截图，未逐一创建全部变体，也未完成真实远程账号验证。

设计状态（hover、focused、pressed）与代码 props 分开：悬停并非一个名为 hover 的 Vue 属性。状态稿不等于运行原型。库版本、主题同步与 API 能力核验仍遵循具体项目证据，接入目录不代表其全部完成。

## 公司资源库

`pixso_library` 每次返回可用库清单；检索和实例操作必须显式提供 `libraryId`，不再支持缺省选库。公司品牌样式优先使用 `hd-company-styles`，标注资源使用 `hd-annotations`；资源以库标识和真实 key 定位，同名或同节点 ID 不构成跨库映射。

- 公司样式：`pixso_library({libraryId:"hd-company-styles",kind:"styles",query:"WEB/文字",limit:20})`。完整1页/36样式，返回真实key、发布状态和实际属性。命名与属性不一致时以实际读回为准并说明，不按名称重绘。
- 标注组件：`pixso_library({libraryId:"hd-annotations",page:"控件"})`；再传 `familyId` 查变体。完整4页/9族/36变体，其中7族有发布版本（6 CURRENT、1 CHANGED），2族是未发布示例。原生实例必须显式传 `libraryId:"hd-annotations"`。
- 标注变量：`pixso_library({libraryId:"hd-annotations",kind:"variables"})`，当前1个 BOOLEAN。只支持绑定节点 `visible`；不改变量值、变量集或模式。

在已绑定的授权范围内执行：

```json
{
  "op": "library-style",
  "libraryId": "hd-company-styles",
  "nodeId": "授权图层ID或本批$key",
  "styleKey": "pixso_library返回的真实样式key",
  "slot": "fill"
}
```

样式 slot 为 `fill`、`stroke`（PAINT），`text`（TEXT节点），`effect`（EFFECT）或 `grid`（GRID）；仅目录实际存在的类型可用。原生导入后读回key/类型/名称，再应用样式引用并核对值，不复制HEX冒充绑定。

```json
{
  "op": "library-variable",
  "libraryId": "hd-annotations",
  "nodeId": "授权图层ID或本批$key",
  "variableKey": "pixso_library返回的真实变量key",
  "field": "visible"
}
```

变量绑定校验原生别名（兼容对象和数组返回）；失败补偿恢复原绑定和可见性。所有操作仍受最新revision、主组件只读和页面/子树范围保护。跨文件导入可能留下编辑器依赖缓存，不能把可见图层撤回说成清除所有缓存。

公司规范正文不随插件发布。设计时用 `pixso_read_reference` 读取最新「UI/UX设计标注系统」，然后回到目标范围；不把资产目录、静态标记点或变量绑定当作规范验收或原生注释写入证据。保留用户已删除的注释，不为展示资源而自动重建说明。
