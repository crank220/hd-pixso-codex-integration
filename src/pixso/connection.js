// 校验连接地址与图层链接，并按上游 schema 构造明确绑定文件的参数。
export const LOCAL_ENDPOINT = 'http://127.0.0.1:3667/mcp';
export const REMOTE_ENDPOINT = 'https://pixso.cn/mcp';
/** 只开放官方公网 MCP 地址；不通过查询参数接收 token 或任意中转端点。 */
export function validateRemoteEndpoint(value = REMOTE_ENDPOINT) {
  const u = new URL(value);
  if (
    u.origin !== 'https://pixso.cn' ||
    u.pathname !== '/mcp' ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw Error('INVALID_REMOTE_ENDPOINT: use https://pixso.cn/mcp');
  return u;
}
/**
 * 将容器链接归一为 fileKey、nodeId 和无额外参数的 URL。
 * item-id 必须唯一且符合 123:456 形式；分享链接和仅 page-id 链接会被拒绝。
 */
export function parseLayerLink(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw Error('LAYER_LINK_REQUIRED: copy the container link with item-id');
  }
  const match = u.pathname.match(/^\/app\/design\/([A-Za-z0-9_-]+)\/?$/);
  const ids = u.searchParams.getAll('item-id');
  if (
    u.origin !== 'https://pixso.cn' ||
    u.username ||
    u.password ||
    u.hash ||
    !match ||
    ids.length !== 1 ||
    !/^\d+:\d+$/.test(ids[0])
  )
    throw Error(
      'LAYER_LINK_REQUIRED: expected https://pixso.cn/app/design/<fileKey>?item-id=<nodeId>; page-id/share links are insufficient',
    );
  return {
    fileKey: match[1],
    nodeId: ids[0],
    url: `https://pixso.cn/app/design/${match[1]}?item-id=${encodeURIComponent(ids[0])}`,
  };
}
/** 仅发送已授权服务公开的参数；无明确文件参数时拒绝调用，不能降级到活动文件。 */
export function remoteToolArguments(tool, target, payload = {}) {
  if (!tool?.inputSchema) throw Error('REMOTE_TOOL_UNAVAILABLE');
  const props = tool.inputSchema.properties || {},
    args = {};
  const isString = (s) =>
    s?.type === 'string' || s?.anyOf?.some(isString) || s?.oneOf?.some(isString);
  const selector = ['fileUrl', 'file_url', 'url', 'fileKey', 'file_key', 'fileId', 'file_id'].find(
    (k) => isString(props[k]),
  );
  if (!selector)
    throw Error(
      `REMOTE_SCHEMA_UNSUPPORTED: ${tool.name} has no explicit file selector; no write was sent`,
    );
  args[selector] = /url/i.test(selector) ? target.url : target.fileKey;
  for (const [k, v] of Object.entries(payload)) {
    if (!props[k]) throw Error(`REMOTE_SCHEMA_UNSUPPORTED: ${tool.name}.${k}`);
    args[k] = v;
  }
  for (const key of tool.inputSchema.required || [])
    if (!(key in args))
      throw Error(`REMOTE_SCHEMA_UNSUPPORTED: missing required ${tool.name}.${key}`);
  return args;
}
