# 0.2.0 验证记录

2026-11-26：在原有本地范围引擎上增加远程显式文件绑定、OAuth入口、双模式切换和完整设计精修流程。

- 37项Node自动测试覆盖本地越界拒写、手改旧版本、异步读写竞态、补偿回滚、组件映射、项目读取与真实stdio协议；远程合成画布覆盖链接校验、错误文件、切换页面不影响链接目标、越界写入拒绝、旧快照、独立规范链接与截图参数，以及写入失败不重放。
- OAuth测试保留issuer绑定的token/client对象、凭据权限、state和回调路径校验、撤销token；模拟OAuth协议测试见测试输出。不将测试token用于任何真实服务。
- `pixso_audit.checks` 对明确同组的宽高/同父坐标做数值对比；跨父坐标返回人工核对，截图与公司规范仍需独立审查。
- 内置UI/UX Pro Max检索可命中实际UX数据，不依赖个人绝对路径；包内包含源许可与来源记录。
- 独立ZIP解压后不依赖node_modules启动；manifest、版本、依赖许可与bundled runtime校验。

官方文档核对：远程MCP为 `https://pixso.cn/mcp`，推荐OAuth2.1，支持StreamableHTTP；新版文档列出eval_script和take_screenshot。无凭据的真实initialize探测返回HTTP401及官方OAuth资源元数据。**未用真实远程授权账号执行读写，不宣称端到端兼容已验证。** 上游schema必须具有明确文件参数，否则适配器拒绝发送。

本地真实连接仅进行只读status、bind、read；没有在本次插件测试中修改公司设计稿。真实账户、远程工具schema与席位权限需在用户授权后进一步验证。
