// 使用真实目录条目和合成沙箱，验证库导入、原生实例读回与范围/失败边界。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fakePixso } from '../fixtures/pixso.js';
import { DesignService } from '../../src/design/design-service.js';
import { selectLibraryVariant, searchLibrary } from '../../src/library/catalog.js';

const buttonId = searchLibrary({ page: 'Button' }).families.find(
  (f) => f.name === 'Button',
).familyId;
const asset = selectLibraryVariant(buttonId);
const op = {
  op: 'library-instance',
  key: 'button',
  parentId: '1:2',
  familyId: buttonId,
  variants: {},
  componentProperties: {},
  props: { x: 20, y: 30 },
};
function setup() {
  const p = fakePixso();
  let calls = 0;
  const c = p.getNodeById('2:3');
  Object.assign(c, {
    key: asset.key,
    name: asset.name,
    variantProperties: asset.variantProperties,
  });
  // 原生实例继承主组件变体和属性。
  const create = c.createInstance.bind(c);
  c.createInstance = () => {
    delete c.createInstance;
    const n = create();
    c.createInstance = createInstance;
    n.componentProperties = { 'Text#144:0': { type: 'TEXT', value: 'Button' } };
    n.setProperties = (props) => {
      for (const [key, value] of Object.entries(props)) n.componentProperties[key].value = value;
    };
    return n;
  };
  const createInstance = c.createInstance;
  p.importComponentByKeyAsync = async (key) => {
    calls++;
    assert.equal(key, asset.key);
    return c;
  };
  const upstream = {
    async evaluate(script) {
      return vm.runInNewContext(`(async()=>{${script}})()`, { pixso: p });
    },
  };
  return { p, c, service: new DesignService(upstream), calls: () => calls };
}

test('built-in assets create real instances without a Vue project and preserve the source', async () => {
  const t = setup(),
    s = await t.service.begin({});
  const r = await t.service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: s.revision,
    operations: [{ ...op, componentProperties: { 'Text#144:0': '确认' } }],
  });
  assert.equal(r.verified, true);
  const n = t.p.getNodeById(r.created.button);
  assert.equal(n.type, 'INSTANCE');
  assert.equal(n.mainComponent.key, asset.key);
  assert.equal(n.componentProperties['Text#144:0'].value, '确认');
  assert.equal(n.parent.id, '1:2');
  assert.equal(t.calls(), 1);
  assert.equal(r.libraryInstances.button.componentKey, asset.key);
  assert.equal(r.libraryInstances.button.method, 'import-by-key');
  assert.equal(t.c.characters, '');
});

test('explicit font substitutions affect only new instances and load the requested replacement', async () => {
  const t = setup();
  const label = t.p.createText();
  label.fontName = { family: 'SF Pro', style: 'Regular' };
  label.textStyleId = 'shared-source-style';
  t.c.appendChild(label);
  const create = t.c.createInstance;
  t.c.createInstance = () => {
    const n = create();
    const text = n.children[0];
    text.setRangeFontName = (start, end, font) => {
      assert.equal(text.textStyleId, '');
      assert.equal(font.hash, 'native-cloud-font');
      assert.equal(start, 0);
      assert.equal(end, text.characters.length);
      text.fontName = font;
    };
    text.characters = 'Button';
    return n;
  };
  t.p.listAvailableFontsAsync = async () => [
    { fontName: { family: 'Noto Sans SC', style: 'Regular', hash: 'native-cloud-font' } },
  ];
  const loaded = [];
  t.p.loadFontAsync = async (font) => {
    loaded.push(font.family);
    if (font.family === 'SF Pro') throw Error('Missing source font');
  };
  const s = await t.service.begin({});
  await assert.rejects(
    t.service.patch({ scopeToken: s.scopeToken, expectedRevision: s.revision, operations: [op] }),
    /FONT_UNAVAILABLE.*SF Pro/,
  );
  const r = await t.service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: s.revision,
    operations: [
      {
        ...op,
        componentProperties: { 'Text#144:0': '确认' },
        fontSubstitutions: [
          {
            from: { family: 'SF Pro', style: 'Regular' },
            to: { family: 'Noto Sans SC', style: 'Regular' },
          },
        ],
      },
    ],
  });
  assert.equal(r.verified, true);
  const instance = t.p.getNodeById(r.created.button);
  assert.equal(instance.children[0].fontName.family, 'Noto Sans SC');
  assert.equal(label.fontName.family, 'SF Pro');
  assert.equal(label.textStyleId, 'shared-source-style');
  assert.equal(r.libraryInstances.button.fontSubstitutions[0].count, 1);
  assert.deepEqual(loaded, ['SF Pro', 'Noto Sans SC']);
});

test('font substitution rejects mixed text without altering existing content', async () => {
  const t = setup();
  const label = t.p.createText();
  label.fontName = t.p.mixed;
  label.getStyledTextSegments = () => [];
  t.c.appendChild(label);
  const s = await t.service.begin({});
  const operation = {
    ...op,
    fontSubstitutions: [
      {
        from: { family: 'SF Pro', style: 'Regular' },
        to: { family: 'Noto Sans SC', style: 'Regular' },
      },
    ],
  };
  await assert.rejects(
    t.service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: s.revision,
      operations: [operation],
    }),
    /LIBRARY_MIXED_FONT_SUBSTITUTION_UNSUPPORTED/,
  );
  assert.equal(t.p.getNodeById('1:2').children.length, 1);
});

test('native instance font rejection fails readback and restores the target', async () => {
  const t = setup();
  const label = t.p.createText();
  label.fontName = { family: 'SF Pro', style: 'Regular' };
  t.c.appendChild(label);
  const create = t.c.createInstance;
  t.c.createInstance = () => {
    const n = create();
    const set = n.setProperties;
    n.setProperties = (props) => {
      set(props);
      Object.defineProperty(n.children[0], 'fontName', {
        get: () => ({ family: 'SF Pro', style: 'Regular' }),
        set() {},
        configurable: true,
      });
    };
    return n;
  };
  const s = await t.service.begin({});
  const result = await t.service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: s.revision,
    operations: [
      {
        ...op,
        componentProperties: { 'Text#144:0': '确认' },
        fontSubstitutions: [
          {
            from: { family: 'SF Pro', style: 'Regular' },
            to: { family: 'Noto Sans SC', style: 'Regular' },
          },
        ],
      },
    ],
  });
  assert.equal(result.status, 'failed');
  assert.match(result.failure, /LIBRARY_FONT_READBACK_MISMATCH/);
  assert.equal(result.rollback.verified, true);
  assert.equal(t.p.getNodeById('1:2').children.length, 1);
  assert.equal(label.fontName.family, 'SF Pro');
});

test('out-of-scope or invalid combinations are rejected before importing a dependency', async () => {
  const t = setup(),
    s = await t.service.begin({ rootId: '1:2' });
  await assert.rejects(
    t.service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: s.revision,
      operations: [{ ...op, parentId: '2:1' }],
    }),
    /OUT_OF_SCOPE/,
  );
  await assert.rejects(
    t.service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: s.revision,
      operations: [{ ...op, variants: { State: 'nonexistent' } }],
    }),
    /LIBRARY_VARIANT_UNSUPPORTED/,
  );
  assert.equal(t.calls(), 0);
});

test('unpublished or denied library imports propagate failure and never create drawn substitutes', async () => {
  const t = setup(),
    s = await t.service.begin({});
  t.p.importComponentByKeyAsync = async () => {
    throw Error('Unpublished');
  };
  await assert.rejects(
    t.service.patch({ scopeToken: s.scopeToken, expectedRevision: s.revision, operations: [op] }),
    /LIBRARY_IMPORT_FAILED/,
  );
  assert.equal(t.p.getNodeById('1:2').children.length, 1);
});

test('wrong imported keys and hand edits during import reject before creating an instance', async () => {
  const t = setup(),
    s = await t.service.begin({});
  t.p.importComponentByKeyAsync = async () => {
    t.c.key = 'wrong';
    return t.c;
  };
  await assert.rejects(
    t.service.patch({ scopeToken: s.scopeToken, expectedRevision: s.revision, operations: [op] }),
    /LIBRARY_ASSET_CHANGED/,
  );
  t.c.key = asset.key;
  t.p.importComponentByKeyAsync = async () => {
    t.p.getNodeById('1:3').characters = '手动修改';
    return t.c;
  };
  await assert.rejects(
    t.service.patch({ scopeToken: s.scopeToken, expectedRevision: s.revision, operations: [op] }),
    /STALE_REVISION/,
  );
  assert.equal(t.p.getNodeById('1:2').children.length, 1);
});

test('native instance failures roll back target edits and do not mutate component masters', async () => {
  const t = setup(),
    s = await t.service.begin({});
  const r = await t.service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: s.revision,
    operations: [
      { op: 'update', nodeId: '1:3', props: { text: 'changed' } },
      { ...op, props: { width: 666 } },
    ],
  });
  assert.equal(r.status, 'failed');
  assert.equal(r.rollback.verified, true);
  assert.equal(t.p.getNodeById('1:3').characters, '模版');
  assert.equal(t.p.getNodeById('1:2').children.length, 1);
});

test('same-source assets reuse their native master without importing or modifying it', async () => {
  const t = setup();
  t.p.fileKey = asset.sourceFileKey;
  const get = t.p.getNodeById;
  t.p.getNodeById = (id) => (id === asset.sourceNodeId ? t.c : get(id));
  const s = await t.service.begin({ rootId: '1:2' });
  const result = await t.service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: s.revision,
    operations: [op],
  });
  assert.equal(result.verified, true);
  assert.equal(t.calls(), 0);
  assert.equal(t.p.getNodeById(result.created.button).mainComponent, t.c);
});

test('remote library instances stay within the explicitly linked target subtree', async () => {
  const t = setup();
  t.service.upstream.mode = 'remote';
  const s = await t.service.begin({
    targetUrl: 'https://pixso.cn/app/design/synthetic-file?item-id=1%3A2',
  });
  const result = await t.service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: s.revision,
    operations: [op],
  });
  assert.equal(result.verified, true);
  assert.equal(t.p.getNodeById(result.created.button).parent.id, '1:2');
  await assert.rejects(
    t.service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: result.revision,
      operations: [{ ...op, key: 'other', parentId: '2:1' }],
    }),
    /OUT_OF_SCOPE/,
  );
  assert.equal(t.p.getNodeById('2:2').characters, 'Protected text');
});
