// 在合成远程协议和 OAuth 服务上验证链接、授权、范围和截图，不调用真实账号。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseLayerLink,
  validateRemoteEndpoint,
  remoteToolArguments,
} from '../../src/pixso/connection.js';
import { PixsoOAuthProvider, validateCallback } from '../../src/auth/oauth-provider.js';
import { PixsoUpstream } from '../../src/pixso/upstream.js';
import { DesignService } from '../../src/design/design-service.js';
import { fakePixso } from '../fixtures/pixso.js';
const link = 'https://pixso.cn/app/design/synthetic-file?item-id=1%3A2';
function remoteFixture() {
  const p = fakePixso();
  p.currentPage = p.getNodeById('2:1');
  const calls = [];
  const upstream = {
    mode: 'remote',
    info: async () => ({ name: 'synthetic remote' }),
    evaluate: async (script, target) => {
      calls.push(target);
      return vm.runInNewContext(`(async()=>{${script}})()`, { pixso: p });
    },
    screenshot: async (target, nodeId) => ({
      content: [{ type: 'text', text: JSON.stringify({ target, nodeId }) }],
    }),
  };
  return { p, calls, service: new DesignService(upstream) };
}
test('remote accepts only official HTTPS and a single explicit item-id layer URL', () => {
  assert.equal(validateRemoteEndpoint().href, 'https://pixso.cn/mcp');
  for (const u of [
    'http://pixso.cn/mcp',
    'https://pixso.cn.evil.test/mcp',
    'https://pixso.cn/mcp?token=secret',
  ])
    assert.throws(() => validateRemoteEndpoint(u));
  assert.equal(parseLayerLink(link).nodeId, '1:2');
  for (const u of [
    'https://pixso.cn/app/design/synthetic-file?page-id=1:1',
    'https://pixso.cn/app/share/a',
    'https://evil.test/app/design/a?item-id=1:2',
    'https://pixso.cn/app/design/a?item-id=1:2&item-id=2:3',
  ])
    assert.throws(() => parseLayerLink(u), /LAYER_LINK_REQUIRED/);
});
test('remote schema adapter sends explicit file selector and refuses active-file-only tools', () => {
  const t = parseLayerLink(link);
  assert.deepEqual(
    remoteToolArguments(
      {
        name: 'eval_script',
        inputSchema: {
          properties: { script: { type: 'string' }, fileKey: { type: 'string' } },
          required: ['script', 'fileKey'],
        },
      },
      t,
      { script: 'return 1;' },
    ),
    { fileKey: 'synthetic-file', script: 'return 1;' },
  );
  assert.equal(
    remoteToolArguments(
      {
        name: 'eval_script',
        inputSchema: { properties: { script: { type: 'string' }, url: { type: 'string' } } },
      },
      t,
      { script: 'return 1;' },
    ).url,
    t.url,
  );
  assert.throws(
    () =>
      remoteToolArguments(
        { name: 'eval_script', inputSchema: { properties: { script: { type: 'string' } } } },
        t,
        { script: 'return 1;' },
      ),
    /REMOTE_SCHEMA_UNSUPPORTED/,
  );
  assert.throws(
    () =>
      remoteToolArguments(
        {
          name: 'eval_script',
          inputSchema: {
            properties: { fileKey: { type: 'string' }, script: { type: 'string' } },
            required: ['sessionKey'],
          },
        },
        t,
        { script: 'return 1;' },
      ),
    /missing required/,
  );
});
test('remote scope targets linked page even when another page is active, and isolates writes', async () => {
  const { service, p, calls } = remoteFixture();
  const s = await service.begin({ targetUrl: link, pageName: 'gpt测试' });
  assert.equal(s.scope.pageId, '1:1');
  assert.equal(s.scope.rootId, '1:2');
  assert.equal(p.currentPage.id, '2:1');
  const a = await service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: s.revision,
    operations: [{ op: 'update', nodeId: '1:3', props: { text: '图片' } }],
  });
  assert.equal(a.verified, true);
  assert.equal(p.getNodeById('1:3').characters, '图片');
  await assert.rejects(
    service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: a.revision,
      operations: [{ op: 'update', nodeId: '2:2', props: { text: 'not allowed' } }],
    }),
    /OUT_OF_SCOPE/,
  );
  assert.equal(p.getNodeById('2:2').characters, 'Protected text');
  assert.ok(calls.every((t) => t.fileKey === 'synthetic-file'));
  p.getNodeById('1:3').characters = '手改';
  await assert.rejects(
    service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: a.revision,
      operations: [{ op: 'update', nodeId: '1:3', props: { text: 'stale' } }],
    }),
    /STALE_REVISION/,
  );
  const fresh = await service.read({ scopeToken: s.scopeToken });
  assert.notEqual(fresh.revision, a.revision);
});
test('remote prevents ambiguous roots and wrong runtime file before writing', async () => {
  const { service, p } = remoteFixture();
  await assert.rejects(service.begin({}), /LAYER_LINK_REQUIRED/);
  await assert.rejects(service.begin({ targetUrl: link, rootId: '1:1' }), /LINK_SCOPE_MISMATCH/);
  await assert.rejects(
    service.begin({ targetUrl: link.replace('synthetic-file', 'different-file') }),
    /REMOTE_FILE_MISMATCH/,
  );
  assert.equal(p.getNodeById('1:3').characters, '模版');
});
test('remote standards and screenshots carry their own file and node binding', async () => {
  const { service } = remoteFixture();
  const s = await service.begin({ targetUrl: link });
  await assert.rejects(
    service.reference({ documentName: 'Synthetic design' }),
    /REFERENCE_LINK_REQUIRED/,
  );
  const ref = await service.reference({ documentName: 'Synthetic design', targetUrl: link });
  assert.equal(ref.node.id, '1:2');
  const image = JSON.parse(
    (await service.preview({ scopeToken: s.scopeToken, nodeId: '1:3' })).content[0].text,
  );
  assert.equal(image.nodeId, '1:3');
  assert.equal(image.target.fileKey, 'synthetic-file');
  await assert.rejects(
    service.preview({ scopeToken: s.scopeToken, nodeId: '2:2' }),
    /OUT_OF_SCOPE/,
  );
});
test('remote adapter calls discovered tool parameters and never retries a failed write', async () => {
  const up = new PixsoUpstream('https://pixso.cn/mcp', {
    mode: 'remote',
    personalToken: 'test-only',
  });
  let attempts = 0;
  up.connect = async () => {};
  up.toolSchemas = new Map([
    [
      'eval_script',
      {
        name: 'eval_script',
        inputSchema: { properties: { script: { type: 'string' }, fileKey: { type: 'string' } } },
      },
    ],
  ]);
  up.call = async (name, args) => {
    attempts++;
    assert.equal(args.fileKey, 'synthetic-file');
    throw Error('timeout after write');
  };
  await assert.rejects(up.evaluate('return 1;', parseLayerLink(link)), /timeout/);
  assert.equal(attempts, 1);
});
test('OAuth persists issuer-bound objects privately, and validates state and callback path', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hd-oauth-'));
  try {
    const p = new PixsoOAuthProvider({ directory: dir });
    const tokens = {
      access_token: 'test-access',
      refresh_token: 'test-refresh',
      token_type: 'Bearer',
      issuer: 'https://pixso.cn',
      expires_in: 3600,
    };
    await p.saveClientInformation({ client_id: 'test-client', issuer: 'https://pixso.cn' });
    await p.saveTokens(tokens);
    assert.deepEqual(await p.tokens(), tokens);
    assert.equal((await p.clientInformation()).issuer, 'https://pixso.cn');
    if (process.platform !== 'win32') assert.equal((await stat(p.file)).mode & 0o777, 0o600);
    assert.equal(
      validateCallback(
        new URL(`http://127.0.0.1:9417/callback?code=test-code&state=${p.nonce}`),
        p,
      ),
      'test-code',
    );
    assert.throws(
      () => validateCallback(new URL('http://127.0.0.1:9417/callback?code=x&state=wrong'), p),
      /STATE/,
    );
    assert.throws(
      () => validateCallback(new URL(`http://127.0.0.1:9417/wrong?code=x&state=${p.nonce}`), p),
      /STATE/,
    );
    await p.invalidateCredentials('tokens');
    assert.equal(await p.tokens(), undefined);
    assert.equal((await p.clientInformation()).client_id, 'test-client');
    const body = await readFile(p.file, 'utf8');
    assert.ok(!body.includes('test-refresh'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('precision audit detects mismatched peer dimensions and refuses out-of-scope peer IDs', async () => {
  const { service, p } = remoteFixture(),
    s = await service.begin({ targetUrl: link });
  const n = p.createRectangle();
  p.getNodeById('1:2').appendChild(n);
  n.width = 88;
  const audit = await service.audit({
    scopeToken: s.scopeToken,
    checks: [{ nodeIds: ['1:3', n.id], property: 'width', tolerance: 1 }],
  });
  assert.equal(audit.checks[0].status, 'mismatch');
  assert.equal(audit.checks[0].delta, 12);
  assert.equal(audit.quality.iconStates, 'review-required');
  await assert.rejects(
    service.audit({
      scopeToken: s.scopeToken,
      checks: [{ nodeIds: ['1:3', '2:2'], property: 'width' }],
    }),
    /OUT_OF_SCOPE/,
  );
});

test('SDK OAuth authorization-code and refresh flows preserve PKCE and issuer binding', async () => {
  const { auth } = await import('@modelcontextprotocol/sdk/client/auth.js');
  const dir = await mkdtemp(join(tmpdir(), 'hd-oauth-flow-'));
  let authorizationUrl;
  const grants = [];
  const provider = new PixsoOAuthProvider({
    directory: dir,
    onRedirect: (u) => {
      authorizationUrl = u;
    },
  });
  const response = (o) =>
    new Response(JSON.stringify(o), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  const fetchFn = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('oauth-protected-resource'))
      return response({
        resource: 'https://pixso.cn/mcp',
        authorization_servers: ['https://pixso.cn'],
        scopes_supported: ['mcp:connect'],
      });
    if (u.includes('oauth-authorization-server') || u.includes('openid-configuration'))
      return response({
        issuer: 'https://pixso.cn',
        authorization_endpoint: 'https://pixso.cn/authorize',
        token_endpoint: 'https://pixso.cn/token',
        registration_endpoint: 'https://pixso.cn/register',
        response_types_supported: ['code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
      });
    if (u === 'https://pixso.cn/register')
      return response({
        client_id: 'synthetic-client',
        redirect_uris: [provider.redirectUrl],
        token_endpoint_auth_method: 'none',
      });
    if (u === 'https://pixso.cn/token') {
      const body = new URLSearchParams(init.body);
      grants.push(body.get('grant_type'));
      if (body.get('grant_type') === 'authorization_code') {
        assert.equal(body.get('code'), 'synthetic-code');
        assert.equal(body.get('code_verifier'), provider.codeVerifier());
        assert.equal(body.get('redirect_uri'), provider.redirectUrl);
      } else assert.equal(body.get('refresh_token'), 'synthetic-refresh');
      return response({
        access_token: 'synthetic-access',
        refresh_token: 'synthetic-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }
    throw Error('Unexpected OAuth URL ' + u);
  };
  try {
    assert.equal(await auth(provider, { serverUrl: 'https://pixso.cn/mcp', fetchFn }), 'REDIRECT');
    assert.equal(authorizationUrl.origin, 'https://pixso.cn');
    assert.equal(authorizationUrl.searchParams.get('state'), provider.nonce);
    assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(
      await auth(provider, {
        serverUrl: 'https://pixso.cn/mcp',
        authorizationCode: 'synthetic-code',
        fetchFn,
      }),
      'AUTHORIZED',
    );
    assert.equal((await provider.tokens()).issuer, 'https://pixso.cn');
    assert.equal(
      await auth(provider, { serverUrl: 'https://pixso.cn/mcp', fetchFn }),
      'AUTHORIZED',
    );
    assert.deepEqual(grants, ['authorization_code', 'refresh_token']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('remote StreamableHTTP wire preserves authentication, file binding and scoped edit readback', async () => {
  const nativeFetch = globalThis.fetch,
    p = fakePixso(),
    requests = [];
  p.currentPage = p.getNodeById('2:1');
  const inventory = [
    {
      name: 'eval_script',
      inputSchema: {
        type: 'object',
        properties: { fileKey: { type: 'string' }, script: { type: 'string' } },
        required: ['fileKey', 'script'],
      },
    },
    {
      name: 'take_screenshot',
      inputSchema: {
        type: 'object',
        properties: { fileKey: { type: 'string' }, nodeId: { type: 'string' } },
        required: ['fileKey', 'nodeId'],
      },
    },
  ];
  globalThis.fetch = async (url, init = {}) => {
    assert.equal(String(url), 'https://pixso.cn/mcp');
    assert.equal(new Headers(init.headers).get('Token'), 'synthetic-pat');
    if (init.method === 'GET') return new Response(null, { status: 405 });
    if (init.method === 'DELETE') return new Response(null, { status: 200 });
    const req = JSON.parse(init.body);
    requests.push(req);
    if (req.id === undefined) return new Response(null, { status: 202 });
    let result;
    if (req.method === 'initialize')
      result = {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'synthetic-cloud', version: '1.0' },
      };
    else if (req.method === 'tools/list') result = { tools: inventory };
    else if (req.method === 'tools/call') {
      assert.equal(req.params.arguments.fileKey, 'synthetic-file');
      if (req.params.name === 'eval_script') {
        const value = await vm.runInNewContext(`(async()=>{${req.params.arguments.script}})()`, {
          pixso: p,
        });
        result = {
          content: [{ type: 'text', text: JSON.stringify(value) }],
          structuredContent: value,
        };
      } else
        result = {
          content: [
            { type: 'text', text: JSON.stringify({ nodeId: req.params.arguments.nodeId }) },
          ],
        };
    } else throw Error('Unexpected protocol method');
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const upstream = new PixsoUpstream('https://pixso.cn/mcp', {
      mode: 'remote',
      personalToken: 'synthetic-pat',
    }),
    service = new DesignService(upstream);
  try {
    const status = await service.status();
    assert.equal(status.mode, 'remote');
    assert.equal(status.targetRequired, true);
    const s = await service.begin({ targetUrl: link });
    const edit = await service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: s.revision,
      operations: [{ op: 'update', nodeId: '1:3', props: { text: '云端合成改稿' } }],
    });
    assert.equal(edit.verified, true);
    assert.equal(p.getNodeById('1:3').characters, '云端合成改稿');
    assert.equal(p.getNodeById('2:2').characters, 'Protected text');
    assert.equal(
      JSON.parse((await service.preview({ scopeToken: s.scopeToken })).content[0].text).nodeId,
      '1:2',
    );
    assert.ok(
      requests.some((r) => r.method === 'tools/call' && r.params.name === 'take_screenshot'),
    );
  } finally {
    await upstream.close();
    globalThis.fetch = nativeFetch;
  }
});
