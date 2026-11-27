// 通过合成原生资源验证多库选择、样式/变量真实绑定、越界与补偿恢复。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fakePixso } from '../fixtures/pixso.js';
import { DesignService } from '../../src/design/design-service.js';
import {
  searchLibrary,
  selectLibraryResource,
  selectLibraryVariant,
} from '../../src/library/catalog.js';

const brand = searchLibrary({
  libraryId: 'hd-company-styles',
  kind: 'styles',
  query: '品牌色/常规',
}).resources[0];
const boolean = searchLibrary({ libraryId: 'hd-annotations', kind: 'variables' }).resources[0];
const paintOp = {
  op: 'library-style',
  libraryId: 'hd-company-styles',
  styleKey: brand.key,
  nodeId: '1:2',
  slot: 'fill',
};
const variableOp = {
  op: 'library-variable',
  libraryId: 'hd-annotations',
  variableKey: boolean.key,
  nodeId: '1:2',
  field: 'visible',
};
function setup() {
  const p = fakePixso();
  const style = { ...brand, id: 'imported-style' };
  const variable = { ...boolean, id: 'imported-variable' };
  const frame = p.getNodeById('1:2');
  let styleId = '';
  Object.defineProperty(frame, 'fillStyleId', {
    enumerable: true,
    configurable: true,
    get: () => styleId,
    set: (value) => {
      styleId = value;
      if (value === style.id) frame.fills = structuredClone(style.paints);
    },
  });
  frame.boundVariables = {};
  frame.setBoundVariable = (field, value) => {
    if (!value) delete frame.boundVariables[field];
    else {
      frame.boundVariables[field] = { type: 'VARIABLE_ALIAS', id: value.id };
      frame.visible = true;
    }
  };
  let imports = 0;
  p.importStyleByKeyAsync = async (key) => {
    assert.equal(key, brand.key);
    imports++;
    return style;
  };
  p.variables = {
    importVariableByKeyAsync: async (key) => {
      assert.equal(key, boolean.key);
      imports++;
      return variable;
    },
    getVariableById: (id) => (id === variable.id ? variable : null),
  };
  const service = new DesignService({
    evaluate: (script) => vm.runInNewContext(`(async()=>{${script}})()`, { pixso: p }),
  });
  return { p, frame, style, variable, service, imports: () => imports };
}

test('company styles and annotation variables retain native references on the bound target', async () => {
  const t = setup(),
    s = await t.service.begin({ rootId: '1:2' });
  const result = await t.service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: s.revision,
    operations: [paintOp, variableOp],
  });
  assert.equal(result.verified, true);
  assert.equal(t.frame.fillStyleId, t.style.id);
  assert.deepEqual(t.frame.fills, brand.paints);
  assert.equal(t.frame.boundVariables.visible.id, t.variable.id);
  assert.equal(t.style.key, brand.key);
});

test('Pixso array-shaped variable aliases are read back and prior bindings restore after failure', async () => {
  const t = setup();
  t.frame.setBoundVariable = (field, value) => {
    if (!value) delete t.frame.boundVariables[field];
    else t.frame.boundVariables[field] = [{ type: 'VARIABLE_ALIAS', id: value.id }];
  };
  const s = await t.service.begin({ rootId: '1:2' });
  const first = await t.service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: s.revision,
    operations: [variableOp],
  });
  assert.equal(first.verified, true);
  assert.equal(t.frame.boundVariables.visible[0].id, t.variable.id);
  const failed = await t.service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: first.revision,
    operations: [variableOp, { op: 'update', nodeId: '1:2', props: { width: 666 } }],
  });
  assert.equal(failed.rollback.verified, true);
  assert.equal(t.frame.boundVariables.visible[0].id, t.variable.id);
});

test('resource preflight rejects the wrong library, incompatible style slots and out-of-scope targets before import', async () => {
  const t = setup(),
    s = await t.service.begin({ rootId: '1:2' });
  for (const [op, pattern] of [
    [{ ...paintOp, libraryId: 'hd-annotations' }, /LIBRARY_RESOURCE_NOT_FOUND/],
    [{ ...paintOp, slot: 'text' }, /LIBRARY_STYLE_TYPE_MISMATCH/],
    [{ ...paintOp, nodeId: '2:2' }, /OUT_OF_SCOPE/],
    [{ ...variableOp, field: 'opacity' }, /LIBRARY_VARIABLE_TYPE_MISMATCH/],
  ])
    await assert.rejects(
      t.service.patch({ scopeToken: s.scopeToken, expectedRevision: s.revision, operations: [op] }),
      pattern,
    );
  assert.equal(t.imports(), 0);
});

test('stale edits during resource import are preserved and imported identity mismatches reject the write', async () => {
  const t = setup(),
    s = await t.service.begin({ rootId: '1:2' });
  t.p.importStyleByKeyAsync = async () => {
    t.frame.name = 'Designer edit';
    return t.style;
  };
  await assert.rejects(
    t.service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: s.revision,
      operations: [paintOp],
    }),
    /STALE_REVISION/,
  );
  assert.equal(t.frame.name, 'Designer edit');
  assert.equal(t.frame.fillStyleId, '');
  const fresh = await t.service.read({ scopeToken: s.scopeToken });
  t.p.importStyleByKeyAsync = async () => ({ ...t.style, key: 'wrong' });
  await assert.rejects(
    t.service.patch({
      scopeToken: s.scopeToken,
      expectedRevision: fresh.revision,
      operations: [paintOp],
    }),
    /LIBRARY_STYLE_CHANGED/,
  );
});

test('resource bindings and target appearance restore when a later native operation fails', async () => {
  const t = setup(),
    s = await t.service.begin({ rootId: '1:2' });
  const before = JSON.stringify({
    fills: t.frame.fills,
    visible: t.frame.visible,
    boundVariables: t.frame.boundVariables,
  });
  const result = await t.service.patch({
    scopeToken: s.scopeToken,
    expectedRevision: s.revision,
    operations: [paintOp, variableOp, { op: 'update', nodeId: '1:2', props: { width: 666 } }],
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.rollback.verified, true);
  assert.equal(t.frame.fillStyleId, '');
  assert.equal(
    JSON.stringify({
      fills: t.frame.fills,
      visible: t.frame.visible,
      boundVariables: t.frame.boundVariables,
    }),
    before,
  );
});

test('all registered libraries retain page coverage and resources cannot be resolved across library IDs', () => {
  const company = searchLibrary({ libraryId: 'hd-company-styles', kind: 'styles', limit: 50 });
  assert.equal(company.total, 36);
  assert.equal(company.resources.filter((row) => row.type === 'PAINT').length, 15);
  assert.equal(company.resources.filter((row) => row.type === 'TEXT').length, 14);
  assert.equal(company.resources.filter((row) => row.type === 'EFFECT').length, 7);
  assert.equal(searchLibrary({ libraryId: 'hd-company-styles' }).coverage.pages, 1);
  assert.equal(searchLibrary({ libraryId: 'hd-annotations' }).coverage.pages, 4);
  assert.equal(searchLibrary({ libraryId: 'hd-annotations' }).coverage.families, 9);
  assert.deepEqual(
    company.libraries.map((library) => library.id),
    ['hd-company-styles', 'hd-annotations', 'ant-design-vue-community'],
  );
  const marker = selectLibraryVariant(
    'hd-annotations',
    '14:3128',
    { 应用场景: '功能说明（蓝）', 样式: '数字' },
    {},
  );
  assert.equal(marker.libraryId, 'hd-annotations');
  assert.equal(marker.key, '0b174a0f50bb0ea85a477f326bff6bf2146cf925');
  assert.throws(
    () => selectLibraryVariant('ant-design-vue-community', '14:3128'),
    /LIBRARY_FAMILY_NOT_FOUND/,
  );
  assert.throws(
    () => selectLibraryResource('hd-annotations', 'styles', brand.key),
    /LIBRARY_RESOURCE_NOT_FOUND/,
  );
  assert.throws(() => searchLibrary({ libraryId: 'missing' }), /LIBRARY_NOT_FOUND/);
});
