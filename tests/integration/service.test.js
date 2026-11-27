// 通过合成 Pixso 沙箱验证设计服务的完整读写与错误传播契约。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fakePixso } from '../fixtures/pixso.js';
import { DesignService } from '../../src/design/design-service.js';
import { parseToolResult, validateEndpoint } from '../../src/pixso/upstream.js';
const api = () => {
  const p = fakePixso();
  return {
    p,
    upstream: {
      async evaluate(script) {
        return vm.runInNewContext(`(async()=>{${script}})()`, { pixso: p });
      },
      async info() {
        return { version: 'test' };
      },
    },
  };
};
test('service requires the current revision, refreshes hand edits, then applies a scoped patch', async () => {
  const { p, upstream } = api(),
    service = new DesignService(upstream);
  const s = await service.begin({ pageName: 'gpt测试' });
  p.getNodeById('1:3').characters = '手工';
  await assert.rejects(
    service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: s.revision,
      operations: [{ op: 'update', nodeId: '1:3', props: { text: '图片' } }],
    }),
    /STALE_REVISION/,
  );
  const fresh = await service.read({ scopeToken: s.scopeToken });
  assert.notEqual(fresh.revision, s.revision);
  const result = await service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: fresh.revision,
    operations: [{ op: 'update', nodeId: '1:3', props: { text: '图片' } }],
  });
  assert.equal(result.verified, true);
  assert.equal(p.getNodeById('1:3').characters, '图片');
});
test('compensated failures stay failures at the tool boundary', async () => {
  const { p, upstream } = api(),
    service = new DesignService(upstream);
  const s = await service.begin({});
  const result = await service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: s.revision,
    operations: [
      { op: 'update', nodeId: '1:3', props: { text: '视频' } },
      { op: 'insert', key: 'bad', kind: 'frame', parentId: '1:1', props: { width: 666 } },
    ],
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.rollback.verified, true);
  assert.equal(p.getNodeById('1:3').characters, '模版');
});
test('native upstream errors and unverified rollback cannot become successful results', () => {
  assert.throws(
    () => parseToolResult({ isError: true, content: [{ type: 'text', text: 'Native failure' }] }),
    /Native failure/,
  );
  assert.throws(
    () =>
      parseToolResult({
        content: [
          { type: 'text', text: '{"error":"bad native call","rollback":{"status":"attempted"}}' },
        ],
      }),
    /bad native call/,
  );
});
test('connection accepts loopback only and rejects credentials or arbitrary remote endpoints', () => {
  assert.equal(validateEndpoint('http://127.0.0.1:3667/mcp').hostname, '127.0.0.1');
  assert.throws(() => validateEndpoint('https://example.com/mcp'), /LOOPBACK_ONLY/);
  assert.throws(
    () => validateEndpoint('http://user:secret@127.0.0.1:3667/mcp'),
    /INVALID_ENDPOINT/,
  );
});
test('audit reports unverified company standards instead of claiming compliance', async () => {
  const { upstream } = api(),
    service = new DesignService(upstream),
    s = await service.begin({});
  const a = await service.audit({ scopeToken: s.scopeToken });
  assert.equal(a.annotation.status, 'not-read');
  assert.equal(a.visualReviewRequired, true);
});

test('bare component IDs cannot bypass the confirmed mapping requirement', async () => {
  const { upstream } = api(),
    service = new DesignService(upstream),
    s = await service.begin({});
  await assert.rejects(
    service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: s.revision,
      operations: [
        { op: 'instance', key: 'button', parentId: '1:2', componentId: '2:3', props: {} },
      ],
    }),
    /MAPPING_REQUIRED/,
  );
});

test('confirmed mappings allow the matching component and reject a renamed source', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'pixso-mapping-'));
  try {
    await writeFile(
      join(dir, '.pixso-codex.json'),
      JSON.stringify({
        mappings: [
          {
            semantic: 'button',
            provider: 'project',
            code: { name: 'ProjectButton', importFrom: '@/components/ProjectButton.vue' },
            design: {
              componentId: '2:3',
              documentName: 'Synthetic design',
              componentName: 'Project/Button',
            },
          },
        ],
      }),
    );
    const { p, upstream } = api(),
      service = new DesignService(upstream),
      s = await service.begin({});
    const op = {
      op: 'instance',
      semantic: 'button',
      key: 'button',
      parentId: '1:2',
      componentId: '2:3',
      props: {},
    };
    const result = await service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: s.revision,
      projectRoot: dir,
      operations: [op],
    });
    assert.equal(result.verified, true);
    assert.equal(p.getNodeById(result.created.button).type, 'INSTANCE');
    p.getNodeById('2:3').name = 'Different button';
    await assert.rejects(
      service.patch({
        scopeToken: s.scopeToken,
        expectedRevision: result.revision,
        projectRoot: dir,
        operations: [{ ...op, key: 'wrong' }],
      }),
      /MAPPING_COMPONENT_MISMATCH/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('local page changes during font loading still reject before any mutation', async () => {
  const { p, upstream } = api(),
    service = new DesignService(upstream),
    s = await service.begin({});
  p.loadFontAsync = async () => {
    p.currentPage = p.getNodeById('2:1');
  };
  await assert.rejects(
    service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: s.revision,
      operations: [{ op: 'update', nodeId: '1:3', props: { text: 'must not apply' } }],
    }),
    /PAGE_CHANGED/,
  );
  assert.equal(p.getNodeById('1:3').characters, '模版');
});
