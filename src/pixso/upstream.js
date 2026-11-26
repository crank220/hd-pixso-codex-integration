// 封装 Pixso MCP 连接、工具发现和本地/远程调用，不自动重试设计写入。
import { PLUGIN_NAME, PLUGIN_VERSION } from '../plugin-info.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { PixsoOAuthProvider, AUTH_HELP } from '../auth/oauth-provider.js';
import {
  validateRemoteEndpoint,
  parseLayerLink,
  remoteToolArguments,
  LOCAL_ENDPOINT,
  REMOTE_ENDPOINT,
} from './connection.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/** 本地模式仅接受无凭据、无查询参数的 loopback HTTP 地址。 */
export function validateEndpoint(value) {
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw Error('LOOPBACK_ONLY: Pixso Desktop must be on this computer');
  if (url.protocol !== 'http:' || url.username || url.password || url.hash || url.search)
    throw Error('INVALID_ENDPOINT: expected a plain local HTTP MCP URL');
  return url;
}
/** 兼容结构化/文本结果；原生错误或 verified=false 必须继续向调用方报错。 */
export function parseToolResult(result) {
  const text = (result?.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  if (result?.isError) throw Error(`PIXSO_ERROR: ${text.slice(0, 1800)}`);
  let value = result?.structuredContent;
  if (value === undefined) {
    try {
      value = JSON.parse(text);
    } catch {
      value = text;
    }
  }
  if (value && typeof value === 'object' && (value.error || value.verified === false)) {
    const e = new Error(`PIXSO_ERROR: ${value.error ?? 'Native result was not verified'}`);
    e.rollback = value.rollback;
    throw e;
  }
  return value;
}
/** 对本地和官方远程提供统一调用接口；认证凭据不进入设计服务快照。 */
export class PixsoUpstream {
  constructor(endpoint = LOCAL_ENDPOINT, { mode = 'local', personalToken, authProvider } = {}) {
    if (!['local', 'remote'].includes(mode)) throw Error('INVALID_CONNECTION_MODE');
    this.mode = mode;
    this.url = mode === 'remote' ? validateRemoteEndpoint(endpoint) : validateEndpoint(endpoint);
    this.personalToken = personalToken;
    this.authProvider =
      mode === 'remote' && !personalToken ? authProvider || new PixsoOAuthProvider() : undefined;
  }
  /** 复用正在建立的连接，避免并发请求重复初始化与重复触发 OAuth。 */
  async connect() {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const client = new Client({ name: PLUGIN_NAME, version: PLUGIN_VERSION });
      const transport = new StreamableHTTPClientTransport(this.url, {
        authProvider: this.authProvider,
        ...(this.personalToken ? { requestInit: { headers: { Token: this.personalToken } } } : {}),
        fetch: (url, init) => fetch(url, { ...init, redirect: 'error' }),
      });
      try {
        await client.connect(transport, { timeout: 10000 });
        const inventory = [];
        let cursor;
        do {
          const batch = await client.listTools(cursor ? { cursor } : {}, { timeout: 10000 });
          inventory.push(...batch.tools);
          cursor = batch.nextCursor;
        } while (cursor);
        const tools = { tools: inventory };
        if (!tools.tools.some((t) => t.name === 'eval_script'))
          throw Error(
            'PIXSO_EVAL_UNAVAILABLE: connected server must provide editable eval_script capability',
          );
        this.toolSchemas = new Map(tools.tools.map((t) => [t.name, t]));
        this.toolNames = new Set(tools.tools.map((t) => t.name));
        this.client = client;
        return client;
      } catch (e) {
        await client.close().catch(() => {});
        if (this.mode === 'remote' && /401|Unauthorized/.test(e.message)) throw Error(AUTH_HELP);
        throw e;
      } finally {
        this.connecting = null;
      }
    })();
    return this.connecting;
  }
  async call(name, args = {}) {
    const client = await this.connect();
    if (!this.toolNames.has(name)) throw Error(`PIXSO_TOOL_UNAVAILABLE: ${name}`);
    // 超时不代表未写入；自动重试可能重复创建图层，恢复前必须由调用方读回。
    return client.callTool({ name, arguments: args }, undefined, { timeout: 60000 });
  }
  /** 仅供内部范围引擎调用；远程必须携带图层链接解析出的文件定位信息。 */
  async evaluate(script, target) {
    if (this.mode !== 'remote') return parseToolResult(await this.call('eval_script', { script }));
    const t = typeof target === 'string' ? parseLayerLink(target) : target;
    if (!t) throw Error('LAYER_LINK_REQUIRED');
    await this.connect();
    return parseToolResult(
      await this.call(
        'eval_script',
        remoteToolArguments(this.toolSchemas.get('eval_script'), t, { script }),
      ),
    );
  }
  async info() {
    await this.connect();
    return this.toolNames.has('get_mcp_server_info')
      ? parseToolResult(await this.call('get_mcp_server_info'))
      : { ...this.client.getServerVersion(), mode: this.mode, tools: [...this.toolNames] };
  }
  /** 根据工具 schema 选择节点参数，远程缺少文件定位或截图能力时拒绝猜测。 */
  async screenshot(target, nodeId) {
    if (this.mode !== 'remote') return this.call('get_screenshot', { guid: nodeId });
    await this.connect();
    const tool = this.toolSchemas.get('take_screenshot');
    if (!tool) throw Error('REMOTE_SCREENSHOT_UNAVAILABLE');
    const props = tool.inputSchema.properties || {};
    const payload = props.nodeId
      ? { nodeId }
      : props.nodeIds
        ? { nodeIds: [nodeId] }
        : props.guid
          ? { guid: nodeId }
          : null;
    if (!payload) throw Error('REMOTE_SCHEMA_UNSUPPORTED: screenshot node selector');
    return this.call('take_screenshot', remoteToolArguments(tool, target, payload));
  }
  async close() {
    if (this.client) await this.client.close();
    this.client = null;
  }
}

/** 环境配置只在创建连接时读取；默认 local，远程只使用官方 HTTPS 地址。 */
export function createUpstream(mode = process.env.PIXSO_CONNECTION_MODE || 'local') {
  return new PixsoUpstream(
    mode === 'remote' ? REMOTE_ENDPOINT : process.env.PIXSO_MCP_URL || LOCAL_ENDPOINT,
    { mode, personalToken: mode === 'remote' ? process.env.PIXSO_PERSONAL_TOKEN : undefined },
  );
}
