#!/usr/bin/env node
// 在本机接收一次性 OAuth 回调，将浏览器授权结果交给 Pixso SDK。
import { createServer } from 'node:http';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { PixsoOAuthProvider, validateCallback } from '../auth/oauth-provider.js';
const provider = new PixsoOAuthProvider({
  onRedirect: (url) =>
    process.stderr.write(
      `在浏览器打开此地址完成 Pixso 授权（不要分享此授权地址）：\n${url.href}\n`,
    ),
});
// 只接收一个有效回调；state/path 由 provider 校验，浏览器页面不展示令牌。
let resolveDone,
  rejectDone,
  consumed = false;
const done = new Promise((resolve, reject) => {
  resolveDone = resolve;
  rejectDone = reject;
});
const server = createServer(async (req, res) => {
  if (req.method !== 'GET' || consumed) {
    res.writeHead(400).end('Invalid callback');
    return;
  }
  let code;
  try {
    code = validateCallback(new URL(req.url, provider.redirectUrl), provider);
  } catch (e) {
    res
      .writeHead(400, { 'Content-Type': 'text/plain;charset=utf-8' })
      .end('授权回调无效，请回到终端重试。');
    return;
  }
  consumed = true;
  try {
    const result = await auth(provider, {
      serverUrl: 'https://pixso.cn/mcp',
      authorizationCode: code,
    });
    if (result !== 'AUTHORIZED') throw Error('OAUTH_NOT_AUTHORIZED');
    res
      .writeHead(200, { 'Content-Type': 'text/plain;charset=utf-8' })
      .end('HD Design 已连接 Pixso。可关闭此页面，回到 Codex 重试远程连接。');
    resolveDone();
  } catch (e) {
    res.writeHead(400).end('Authorization failed');
    rejectDone(e);
  }
});
let timer;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(9417, '127.0.0.1', resolve);
  });
  // 单位 ms；五分钟后结束等待并关闭 loopback 回调服务。
  timer = setTimeout(() => rejectDone(Error('OAUTH_TIMEOUT: retry login')), 300000);
  const result = await auth(provider, { serverUrl: 'https://pixso.cn/mcp', scope: 'mcp:connect' });
  if (result !== 'AUTHORIZED') await done;
  process.stderr.write('Pixso OAuth 授权完成。令牌仅保存在本机用户目录。\n');
} catch (e) {
  process.stderr.write(`${e.message}\n`);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
