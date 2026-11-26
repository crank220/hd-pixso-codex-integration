// 验证自包含画布引擎的范围、快照、字体竞态与补偿恢复边界。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fakePixso } from '../fixtures/pixso.js';
import { canvasRuntime } from '../../src/design/canvas-runtime.js';
const run = (pixso, input) =>
  vm.runInNewContext(`(${canvasRuntime.toString()})(${JSON.stringify(input)})`, { pixso });
async function open(pixso, rootId = '1:1') {
  return run(pixso, { action: 'open', rootId });
}

test('updates only the bound page and rejects out-of-scope targets before any mutation', async () => {
  const p = fakePixso(),
    s = await open(p);
  await assert.rejects(
    run(p, {
      action: 'apply',
      scope: s.scope,
      expectedState: s.state,
      operations: [
        { op: 'update', nodeId: '1:3', props: { text: '图片' } },
        { op: 'update', nodeId: '2:2', props: { text: 'bad' } },
      ],
    }),
    /OUT_OF_SCOPE/,
  );
  assert.equal(p.getNodeById('1:3').characters, '模版');
  assert.equal(p.getNodeById('2:2').characters, 'Protected text');
  const a = await run(p, {
    action: 'apply',
    scope: s.scope,
    expectedState: s.state,
    operations: [{ op: 'update', nodeId: '1:3', props: { text: '图片' } }],
  });
  assert.equal(a.verified, true);
  assert.equal(p.getNodeById('1:3').characters, '图片');
});
test('hand edits invalidate a stale write and a fresh read becomes the next input', async () => {
  const p = fakePixso(),
    s = await open(p);
  p.getNodeById('1:3').characters = '手工调整';
  await assert.rejects(
    run(p, {
      action: 'apply',
      scope: s.scope,
      expectedState: s.state,
      operations: [{ op: 'update', nodeId: '1:3', props: { text: '覆盖' } }],
    }),
    /STALE_REVISION/,
  );
  const fresh = await run(p, { action: 'read', scope: s.scope });
  assert.ok(fresh.state.includes('手工调整'));
  assert.equal(p.getNodeById('1:3').characters, '手工调整');
});
test('switching documents or pages rejects a bound write', async () => {
  const p = fakePixso(),
    s = await open(p);
  p.currentPage = p.getNodeById('2:1');
  await assert.rejects(run(p, { action: 'read', scope: s.scope }), /PAGE_CHANGED/);
  p.currentPage = p.getNodeById('1:1');
  p.fileKey = 'different-file';
  await assert.rejects(run(p, { action: 'read', scope: s.scope }), /DOCUMENT_CHANGED/);
});
test('reuses a component from another page without changing the source', async () => {
  const p = fakePixso(),
    s = await open(p, '1:2');
  const result = await run(p, {
    action: 'apply',
    scope: s.scope,
    expectedState: s.state,
    operations: [
      {
        op: 'instance',
        key: 'button',
        parentId: '1:2',
        componentId: '2:3',
        props: { x: 120, name: 'Submit' },
      },
    ],
  });
  const inst = p.getNodeById(result.created.button);
  assert.equal(inst.type, 'INSTANCE');
  assert.equal(inst.parent.id, '1:2');
  assert.equal(inst.mainComponent.id, '2:3');
  assert.equal(p.getNodeById('2:3').name, 'Project/Button');
  assert.equal(p.getNodeById('2:1').children.length, 2);
});
test('new editable layers can reference an earlier insertion in the same batch', async () => {
  const p = fakePixso(),
    s = await open(p);
  const result = await run(p, {
    action: 'apply',
    scope: s.scope,
    expectedState: s.state,
    operations: [
      {
        op: 'insert',
        key: 'panel',
        kind: 'frame',
        parentId: '1:1',
        props: { width: 300, height: 100 },
      },
      {
        op: 'insert',
        key: 'label',
        kind: 'text',
        parentId: '$panel',
        props: { text: '视频', x: 16, y: 16 },
      },
    ],
  });
  assert.equal(p.getNodeById(result.created.label).parent.id, result.created.panel);
  assert.equal(p.getNodeById(result.created.label).characters, '视频');
});
test('native errors roll back earlier mutations and remove inserted layers', async () => {
  const p = fakePixso(),
    s = await open(p);
  const result = await run(p, {
    action: 'apply',
    scope: s.scope,
    expectedState: s.state,
    operations: [
      { op: 'update', nodeId: '1:3', props: { text: '图片' } },
      { op: 'insert', key: 'broken', kind: 'frame', parentId: '1:1', props: { width: 666 } },
    ],
  });
  assert.equal(result.operationVerified, false);
  assert.equal(result.rollback.verified, true);
  assert.equal(p.getNodeById('1:3').characters, '模版');
  assert.equal(p.getNodeById('1:1').children.length, 1);
});
test('rejects parent cycles and arbitrary properties before a write', async () => {
  const p = fakePixso(),
    s = await open(p);
  await assert.rejects(
    run(p, {
      action: 'apply',
      scope: s.scope,
      expectedState: s.state,
      operations: [{ op: 'update', nodeId: '1:3', props: { __notAllowed: 'value' } }],
    }),
    /INVALID_PROPERTY/,
  );
  await assert.rejects(
    run(p, {
      action: 'apply',
      scope: s.scope,
      expectedState: s.state,
      operations: [{ op: 'clone', key: 'cycle', parentId: '1:2', sourceId: '1:1', props: {} }],
    }),
    /INVALID_SOURCE/,
  );
});

test('main component edits are rejected because they can affect instances outside the bound page', async () => {
  const p = fakePixso();
  const component = p.getNodeById('2:3');
  p.getNodeById('1:1').appendChild(component);
  const inst = component.createInstance();
  p.getNodeById('2:1').appendChild(inst);
  const s = await open(p);
  await assert.rejects(
    run(p, {
      action: 'apply',
      scope: s.scope,
      expectedState: s.state,
      operations: [{ op: 'update', nodeId: '2:3', props: { fill: '#123456' } }],
    }),
    /COMPONENT_DEFINITION_READ_ONLY/,
  );
  assert.equal(component.fills.length, 0);
});
test('mixed text ranges participate in stale revision detection', async () => {
  const p = fakePixso(),
    t = p.getNodeById('1:3');
  t.fontName = p.mixed;
  let size = 14;
  t.getStyledTextSegments = () => [
    { start: 0, end: 2, fontName: { family: 'Noto Sans SC', style: 'Regular' }, fontSize: size },
  ];
  const s = await open(p);
  size = 18;
  await assert.rejects(
    run(p, {
      action: 'apply',
      scope: s.scope,
      expectedState: s.state,
      operations: [{ op: 'update', nodeId: '1:2', props: { x: 10 } }],
    }),
    /STALE_REVISION/,
  );
  assert.equal(p.getNodeById('1:2').x, 0);
});

test('a hand edit during asynchronous font loading invalidates the patch before mutation', async () => {
  const p = fakePixso(),
    s = await open(p);
  p.loadFontAsync = async () => {
    p.getNodeById('1:3').characters = '用户最新改字';
  };
  await assert.rejects(
    run(p, {
      action: 'apply',
      scope: s.scope,
      expectedState: s.state,
      operations: [{ op: 'update', nodeId: '1:3', props: { text: '应拒绝覆盖' } }],
    }),
    /STALE_REVISION/,
  );
  assert.equal(p.getNodeById('1:3').characters, '用户最新改字');
});
