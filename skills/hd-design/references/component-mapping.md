# Vue 组件映射

配置放在用户明确连接的项目根目录 `.pixso-codex.json`，工具只读此配置，不修改业务代码。

```json
{
  "schemaVersion": 1,
  "tokens": { "colorPrimary": "#286BFF", "borderRadius": 6 },
  "annotation": { "documentName": "UI/UX设计标注系统" },
  "mappings": [{
    "semantic": "table",
    "provider": "project",
    "code": { "name": "BusinessTable", "importFrom": "@/components/BusinessTable.vue" },
    "design": { "componentId": "读取到的真实节点ID", "documentName": "读取到的设计文件名称", "componentName": "读取到的真实组件名" }
  }]
}
```

- `mapped`：存在显式设计与代码映射；使用前仍核对当前文档名与组件 ID，避免其他文件复用相同ID。
- `needs-mapping`：发现可能的项目组件，需要检查业务职责并建立映射，不能直接跳过。
- `needs-design-mapping`：已知代码组件，但没有设计组件 ID；在 Pixso 导入/选择对应组件并读取，或复用项目已有版式。
- `design-needed`：没有已知匹配，说明新增必要性后在用户授权范围内制作。

内置真实资产与纯设计实例化参见 [资产目录](library.md)。传统代码语义基础目录覆盖 table、select、button、input、modal、pagination、tag、tabs、form、empty、tooltip、datePicker，此代码名称目录用于选择建议；真实资产需另用 pixso_library 查询并经 library-instance 校验实例化。

默认依赖范围 `^4.1.0`。当前支持 npm package-lock（v1/v2/v3）、pnpm 项目 importer（v6–9常见格式）、Yarn Classic/Berry 的明确版本条目。上层工作区锁、多个含糊匹配或无法解析时返回 resolved=null；先定位正确工作区再核对。Vue2 / Ant Design Vue 1.x 不按4.x自动套用。

官方依据：
- [Ant Design Vue](https://antdv.com/components/overview)
- [Ant Design Vue 4.1.0 源码](https://github.com/vueComponent/ant-design-vue/tree/4.1.0)
- [Codex 插件打包规范](https://developers.openai.com/plugins/build/plugins)

UI 组件规范与公司交互标注系统分别读取和检查；品牌 tokens 覆盖不会自动证明所有页面合规。
