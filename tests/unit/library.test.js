// 验证全页目录、严格变体选择及文本/布尔属性边界，不把视觉状态误当代码能力。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { indexLibraryRuntime } from '../../src/library/index-runtime.js';
import { searchLibrary, selectLibraryVariant } from '../../src/library/catalog.js';
const catalog = JSON.parse(
  readFileSync(new URL('../../assets/libraries/ant-design-vue.json', import.meta.url)),
);

test('publication is read from component families instead of unpublished variant children', async () => {
  const page = { id: 'page', name: 'Button', type: 'PAGE', children: [] };
  const family = {
    id: 'family',
    name: 'Button',
    type: 'COMPONENT_SET',
    key: 'family-key',
    parent: page,
    componentPropertyDefinitions: {},
    children: [],
    getPublishStatusAsync: async () => 'CURRENT',
  };
  const variant = {
    id: 'variant',
    name: 'default',
    type: 'COMPONENT',
    key: 'variant-key',
    parent: family,
    getPublishStatusAsync: async () => {
      throw Error('Variant status is not family publication');
    },
  };
  const helper = {
    id: 'helper',
    name: '_helper',
    type: 'COMPONENT',
    key: 'helper-key',
    parent: page,
    getPublishStatusAsync: async () => 'UNPUBLISHED',
  };
  family.children.push(variant);
  page.children.push(family, helper);
  const result = await vm.runInNewContext(`(${indexLibraryRuntime.toString()})('source')`, {
    pixso: { fileKey: 'source', root: { name: 'Library', children: [page] } },
  });
  assert.equal(result.families.find((f) => f.id === 'family').publishStatus, 'CURRENT');
  assert.equal(result.families.find((f) => f.id === 'helper').publishStatus, 'UNPUBLISHED');
  assert.deepEqual(JSON.parse(JSON.stringify(result.pages[0].publishStatuses)), {
    UNPUBLISHED: 1,
    CURRENT: 1,
  });
});

test('catalog accounts for every source page and all native component definitions', () => {
  const index = searchLibrary({ limit: 1 });
  assert.equal(index.coverage.pages, catalog.pages.length);
  assert.equal(new Set(catalog.pages.map((p) => p.id)).size, catalog.pages.length);
  assert.equal(new Set(catalog.families.map((f) => f.id)).size, catalog.families.length);
  for (const page of catalog.pages) {
    const families = catalog.families.filter((f) => f.pageId === page.id);
    assert.equal(
      families.reduce((sum, f) => sum + f.variants.length, 0),
      page.components,
      page.name,
    );
    assert.equal(families.filter((f) => f.type === 'COMPONENT_SET').length, page.componentSets);
    assert.ok(Array.isArray(page.referenceNodes));
  }
  const keys = catalog.families.flatMap((f) => f.variants.map((v) => v.key));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every((key) => typeof key === 'string' && key.length > 0));
  assert.ok(index.families.length <= 1);
  assert.ok(searchLibrary({ page: 'ConfigProvider' }).pages.length);
  assert.equal(searchLibrary({ page: 'ConfigProvider' }).total, 0);
});

test('variant selection resolves actual hover and disabled sources and rejects invented axes', () => {
  const button = searchLibrary({ page: 'Button' }).families.find((f) => f.name === 'Button');
  const hover = selectLibraryVariant(button.familyId, {
    Type: 'primary',
    State: 'hover',
    Size: 'default',
    Shape: 'default',
    Status: 'default',
  });
  const disabled = selectLibraryVariant(button.familyId, {
    Type: 'primary',
    State: 'disabled',
    Size: 'default',
    Shape: 'default',
    Status: 'default',
  });
  assert.notEqual(hover.key, disabled.key);
  assert.equal(hover.variantProperties.State, 'hover');
  assert.throws(
    () => selectLibraryVariant(button.familyId, { State: 'hovered' }),
    /LIBRARY_VARIANT_UNSUPPORTED/,
  );
  assert.throws(
    () => selectLibraryVariant(button.familyId, { NotReal: 'true' }),
    /LIBRARY_VARIANT_UNSUPPORTED/,
  );
  assert.throws(() => selectLibraryVariant('not-real'), /LIBRARY_FAMILY_NOT_FOUND/);
});

test('text and boolean overrides must match recorded native property definitions', () => {
  const family = catalog.families.find((f) => f.page === 'Button');
  const text = Object.keys(family.definitions).find(
    (key) => family.definitions[key].type === 'TEXT',
  );
  const bool = Object.keys(family.definitions).find(
    (key) => family.definitions[key].type === 'BOOLEAN',
  );
  const asset = selectLibraryVariant(family.id, {}, { [text]: '确认', [bool]: false });
  assert.equal(asset.componentProperties[text], '确认');
  assert.throws(
    () => selectLibraryVariant(family.id, {}, { [bool]: 'false' }),
    /LIBRARY_PROPERTY_UNSUPPORTED/,
  );
  assert.throws(
    () => selectLibraryVariant(family.id, {}, { [text]: true }),
    /LIBRARY_PROPERTY_UNSUPPORTED/,
  );
});

test('every captured component resolves back to its exact native variant key', () => {
  for (const family of catalog.families)
    for (const variant of family.variants)
      assert.equal(
        selectLibraryVariant(family.id, variant.properties).key,
        variant.key,
        `${family.page}/${family.name}/${variant.name}`,
      );
});
