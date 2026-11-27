# 本地与远程连接

| 模式 | 地址 | 定位 |
| --- | --- | --- |
| local 默认 | http://127.0.0.1:3667/mcp | Pixso 桌面活动文档；显式 pageName 绑定唯一页面，缺省为活动页 |
| remote | https://pixso.cn/mcp | OAuth或访问令牌 + 含item-id的容器图层链接 |

`pixso_connect({mode:"remote"})` 切换到远程；`pixso_connect({mode:"local"})` 切回。本地保留 loopback HTTP 限制，远程仅接受官方 HTTPS 端点；本版不声称支持私有化域名。切换清空旧范围 token；不要将本地 token 用在远程连接。

远程授权推荐在终端执行 `node <插件安装目录>/dist/login.js`，按终端输出的官方授权地址登录，回调仅监听本机127.0.0.1:9417，5分钟超时。macOS、Windows、Linux 均使用 Node.js20+；不依赖 Pixso 桌面端。OAuth token保存在用户目录 `.config/hd-design/pixso-oauth.json`，不放进插件或项目仓库。`HD_PIXSO_AUTH_DIR` 可指定本机存储目录。官方账号授权需要用户在浏览器中完成，不能假装已登录。

也可在 MCP 进程环境配置 `PIXSO_PERSONAL_TOKEN`，按官方 Token 请求头使用。不要让用户把令牌粘到聊天、图层链接或源码。`PIXSO_CONNECTION_MODE=remote` 可设置进程启动模式；`PIXSO_MCP_URL` 只适用于本地连接端口，不接受远程地址。

```text
https://pixso.cn/app/design/<fileKey>?item-id=123%3A456
```

`pixso_begin({targetUrl:"上述链接",pageName:"用户指定页面"})`：图层链接绑定其子树，不能传其他rootId扩大范围。独立读取规范时给 `pixso_read_reference` 提供规范文件自己的图层链接和预期文档名；不会换掉已经绑定的设计范围。

连接后实际发现上游工具 schema，只有 `eval_script` 提供明确文件参数且 runtime文件身份匹配时才执行范围脚本；不支持的 schema 报 `REMOTE_SCHEMA_UNSUPPORTED`，不会去猜活动文档。截图使用远程 `take_screenshot` 的明确文件与节点参数，缺失时报告能力不足。旧版只读远程服务不能当作可编辑服务。

官方连接、席位、查看/编辑权限由 Pixso 验证。未经真实账号授权与目标文件测试，交付中写明“远程链路通过模拟协议测试，真实账号编辑尚未验证”；一次401只证明需要授权，不证明读写已联调。

官方依据（核对日期2026-11-26）：
- https://pixso.cn/developer/zh/mcp/remote-mcp.html
- https://pixso.cn/developer/zh/mcp/tools.html

本地 `pixso_begin({pageName:"03 控件差异与交互"})` 精确匹配当前文件的唯一页面，不改变设计师的活动页。重名返回 PAGE_NAME_AMBIGUOUS，缺失返回 PAGE_NAME_MISMATCH；一个 token 只绑定一个页面/子树。未传 pageName 时仍在切换活动页后拒写。
