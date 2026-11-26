import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const client = new Client({ name: 'hd-pixso-live-read', version: '0.1.0' });
try {
 await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/server.js'], stderr: 'inherit' }));
 const result = await client.callTool({ name: 'pixso_status', arguments: {} });
 if (result.isError) throw Error(result.content[0].text);
 const s = result.structuredContent;
 console.log(JSON.stringify({ connected: true, toolCount: (await client.listTools()).tools.length, server: s.server,
  currentPagePresent: Boolean(s.design.currentPage.id), selectionCount: s.design.selection.length }, null, 2));
 // Do not print or save private design text, screenshots, file names, or node IDs.
 const rootId = s.design.selection[0]?.id || s.design.frames.find(f => f.type === 'FRAME')?.id;
 if (rootId) {
  const bound = await client.callTool({ name: 'pixso_begin', arguments: { rootId } });
  if (bound.isError) throw Error(bound.content[0].text);
  const fresh = await client.callTool({ name: 'pixso_read', arguments: { scopeToken: bound.structuredContent.scopeToken, depth: 1 } });
  if (fresh.isError) throw Error(fresh.content[0].text);
  console.log(JSON.stringify({ readOnlyScope: true, nodes: fresh.structuredContent.nodeCount, stableRevision: fresh.structuredContent.revision === bound.structuredContent.revision }));
 }
} finally { await client.close(); }
