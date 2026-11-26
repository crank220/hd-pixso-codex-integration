import { PixsoUpstream, parseToolResult } from './upstream.js';
const upstream = new PixsoUpstream(process.env.PIXSO_MCP_URL || 'http://127.0.0.1:3667/mcp');
try {
 const result = parseToolResult(await upstream.call('get_mcp_server_info'));
 console.log(JSON.stringify({ ok: true, node: process.version, pixso: result, next: '在 Pixso 选择目标页面，然后在新 Codex 会话中使用 hd-design。' }, null, 2));
} catch (e) {
 console.error(JSON.stringify({ ok: false, error: e.message, next: '确认 Pixso 已启动、本地 MCP 已开启，默认地址为 http://127.0.0.1:3667/mcp。' }, null, 2)); process.exitCode = 1;
} finally { await upstream.close(); }
