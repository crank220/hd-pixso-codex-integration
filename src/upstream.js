import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export function validateEndpoint(value) {
  const url = new URL(value);
  if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) throw Error('LOOPBACK_ONLY: Pixso Desktop must be on this computer');
  if (url.protocol !== 'http:' || url.username || url.password || url.hash || url.search) throw Error('INVALID_ENDPOINT: expected a plain local HTTP MCP URL');
  return url;
}
export function parseToolResult(result) {
  const text = (result?.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  if (result?.isError) throw Error(`PIXSO_ERROR: ${text.slice(0, 1800)}`);
  let value = result?.structuredContent;
  if (value === undefined) { try { value = JSON.parse(text); } catch { value = text; } }
  if (value && typeof value === 'object' && (value.error || value.verified === false)) {
    const e = new Error(`PIXSO_ERROR: ${value.error ?? 'Native result was not verified'}`);
    e.rollback = value.rollback; throw e;
  }
  return value;
}
export class PixsoUpstream {
  constructor(endpoint = 'http://127.0.0.1:3667/mcp') { this.url = validateEndpoint(endpoint); }
  async connect() {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const client = new Client({ name: 'hd-pixso-codex', version: '0.1.1' });
      const transport = new StreamableHTTPClientTransport(this.url, { fetch: (url, init) => fetch(url, { ...init, redirect: 'error' }) });
      try {
        await client.connect(transport, { timeout: 10000 });
        const tools = await client.listTools({}, { timeout: 10000 });
        if (!tools.tools.some(t => t.name === 'eval_script')) throw Error('PIXSO_EVAL_UNAVAILABLE: upgrade or enable Pixso Desktop MCP');
        this.toolNames = new Set(tools.tools.map(t => t.name)); this.client = client;
        return client;
      } catch (e) { await client.close().catch(() => {}); throw e; }
      finally { this.connecting = null; }
    })();
    return this.connecting;
  }
  async call(name, args = {}) {
    const client = await this.connect();
    if (!this.toolNames.has(name)) throw Error(`PIXSO_TOOL_UNAVAILABLE: ${name}`);
    // No automatic retries: a timeout may occur after a native mutation was applied.
    return client.callTool({ name, arguments: args }, undefined, { timeout: 60000 });
  }
  async evaluate(script) { return parseToolResult(await this.call('eval_script', { script })); }
  async close() { if (this.client) await this.client.close(); this.client = null; }
}
