import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectProject, chooseComponent, loadProjectConfig } from '../src/project.js';
async function fixture(fn) { const dir = await mkdtemp(join(tmpdir(), 'pixso-project-')); try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); } }
const json = (dir, path, value) => writeFile(join(dir,path), JSON.stringify(value));

test('resolves the actual npm lock version instead of the declared dependency range', () => fixture(async dir => {
  await json(dir, 'package.json', { dependencies: { vue: '^3.4.0', 'ant-design-vue': '^4.1.0' } });
  await json(dir, 'package-lock.json', { lockfileVersion: 3, packages: { 'node_modules/ant-design-vue': { version: '4.2.6' } } });
  const p = await inspectProject(dir);
  assert.equal(p.antDesignVue.declared, '^4.1.0'); assert.equal(p.antDesignVue.resolved, '4.2.6');
  assert.equal(p.antDesignVue.source, 'package-lock.json');
}));
test('pnpm workspace importer picks the selected project resolution, not an unrelated version', () => fixture(async dir => {
  await json(dir, 'package.json', { dependencies: { 'ant-design-vue': '^4.1.0' } });
  await writeFile(join(dir,'pnpm-lock.yaml'), "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      ant-design-vue:\n        specifier: ^4.1.0\n        version: 4.1.2(vue@3.4.0)\npackages:\n  ant-design-vue@4.2.6: {}\n");
  assert.equal((await inspectProject(dir)).antDesignVue.resolved, '4.1.2');
}));
test('reads yarn classic lock and reports unknown when a dependency is not locked', () => fixture(async dir => {
  await json(dir, 'package.json', { dependencies: { 'ant-design-vue': '^4.1.0' } });
  await writeFile(join(dir,'yarn.lock'), '"ant-design-vue@^4.1.0":\n  version "4.1.2"\n');
  assert.equal((await inspectProject(dir)).antDesignVue.resolved, '4.1.2');
  await rm(join(dir,'yarn.lock'));
  assert.equal((await inspectProject(dir)).antDesignVue.resolved, null);
}));
test('project mapping wins over Ant Design Vue even if the config order is reversed', () => {
  const component = chooseComponent('table', { mappings: [
    { semantic: 'table', provider: 'ant-design-vue', code: { name: 'a-table', importFrom: 'ant-design-vue' } },
    { semantic: 'table', provider: 'project', code: { name: 'BusinessTable', importFrom: '@/components/BusinessTable.vue' } }
  ] });
  assert.equal(component.provider, 'project'); assert.equal(component.code.name, 'BusinessTable');
});
test('company tokens override baseline values without replacing the other defaults', () => fixture(async dir => {
  await json(dir, '.pixso-codex.json', { schemaVersion: 1, tokens: { colorPrimary: '#123456' }, mappings: [] });
  const c = await loadProjectConfig(dir);
  assert.equal(c.tokens.colorPrimary, '#123456'); assert.equal(c.tokens.controlHeight, 32);
}));
test('component discovery is read only and does not traverse symlinks out of the project', () => fixture(async dir => {
  await json(dir,'package.json', { dependencies: { vue: '^3.4.0' } });
  await mkdir(join(dir,'src/components'), { recursive: true });
  await writeFile(join(dir,'src/components/BusinessTable.vue'), '<template><a-table /></template>');
  await symlink(tmpdir(), join(dir,'src/components/outside'));
  const p = await inspectProject(dir);
  assert.ok(p.components.some(c => c.name === 'BusinessTable'));
  assert.ok(p.components.every(c => !c.path.includes('outside/')));
}));

test('a discovered project wrapper takes precedence over an Ant Design Vue mapping', () => {
 const result = chooseComponent('table', { mappings: [{ semantic: 'table', provider: 'ant-design-vue', code: { name: 'a-table', importFrom: 'ant-design-vue' } }] },
  { components: [{ name: 'BusinessTable', path: 'src/components/BusinessTable.vue', antDesignUsage: ['a-table'] }] });
 assert.equal(result.provider, 'project'); assert.equal(result.status, 'needs-mapping');
});

test('yarn descriptors are matched exactly, not by prefix', () => fixture(async dir => {
 await json(dir,'package.json', { dependencies: { 'ant-design-vue': '^4.1' } });
 await writeFile(join(dir,'yarn.lock'), '"ant-design-vue@^4.10":\n  version "4.10.2"\n');
 assert.equal((await inspectProject(dir)).antDesignVue.resolved, null);
}));
