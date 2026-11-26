import { readFile, readdir, realpath, stat, lstat } from 'node:fs/promises';
import { resolve, relative, join, dirname, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export const DEFAULT_TARGET = { framework: 'vue', dependency: { 'ant-design-vue': '^4.1.0' } };
export const DEFAULT_TOKENS = { colorPrimary: '#1677FF', colorText: '#000000', colorBorder: '#D9D9D9', borderRadius: 6, fontSize: 14, controlHeight: 32 };
const design = z.object({ componentId: z.string().min(1), documentName: z.string().min(1), componentName: z.string().min(1) }).strict();
const mapping = z.object({ semantic: z.string().min(1), provider: z.enum(['project','ant-design-vue','custom']), code: z.object({ name: z.string().min(1), importFrom: z.string().min(1) }).strict(), design: design.optional() }).strict();
export const configSchema = z.object({ schemaVersion: z.literal(1).default(1),
  tokens: z.object({ colorPrimary: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(), colorText: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(), colorBorder: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(), borderRadius: z.number().min(0).max(100).optional(), fontSize: z.number().min(12).max(100).optional(), controlHeight: z.number().min(20).max(100).optional() }).strict().default({}),
  mappings: z.array(mapping).default([]),
  annotation: z.object({ documentName: z.string().min(1), nodeId: z.string().optional() }).strict().optional()
}).strict();

async function safeRead(root, file, max = 2_000_000) {
  const path = resolve(root, file);
  let actual;
  try { actual = await realpath(path); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  const rel = relative(root, actual);
  if (rel.startsWith('..' + sep) || rel === '..' || resolve(root, rel) !== actual) throw Error('PATH_OUTSIDE_PROJECT');
  if ((await stat(actual)).size > max) throw Error(`FILE_TOO_LARGE: ${file}`);
  return readFile(actual, 'utf8');
}
const normalizeVersion = v => typeof v === 'string' ? v.replace(/^\/?ant-design-vue[@/]/, '').match(/^(\d+\.\d+\.\d+(?:-[\w.-]+)?)/)?.[1] ?? null : null;
export async function loadProjectConfig(projectRoot) {
  const root = await realpath(projectRoot);
  const raw = await safeRead(root, '.pixso-codex.json', 200_000);
  const config = configSchema.parse(raw ? JSON.parse(raw) : {});
  return { ...config, tokens: { ...DEFAULT_TOKENS, ...config.tokens }, source: raw ? '.pixso-codex.json' : 'defaults' };
}

async function lockedVersion(root, declared) {
  const lock = await safeRead(root, 'package-lock.json', 8_000_000);
  if (lock) {
    const p = JSON.parse(lock), value = p.packages?.['node_modules/ant-design-vue']?.version ?? p.dependencies?.['ant-design-vue']?.version;
    return { resolved: normalizeVersion(value), source: 'package-lock.json' };
  }
  const pnpm = await safeRead(root, 'pnpm-lock.yaml', 8_000_000);
  if (pnpm) {
    const data = parseYaml(pnpm), importer = data.importers?.['.'] ?? data;
    const ref = importer.dependencies?.['ant-design-vue'] ?? importer.devDependencies?.['ant-design-vue'];
    const value = typeof ref === 'object' ? ref.version : ref;
    return { resolved: normalizeVersion(value), source: 'pnpm-lock.yaml' };
  }
  const yarn = await safeRead(root, 'yarn.lock', 8_000_000);
  if (yarn) {
    const blocks = yarn.split(/\n(?=[^\s#])/);
    const matches = [];
    for (const block of blocks) {
      const header = block.slice(0, block.indexOf('\n'));
      const descriptors = header.replace(/:\s*$/, '').replace(/[\"']/g, '').split(/,\s*/).map(x => x.trim());
      const expected = [`ant-design-vue@${declared}`, `ant-design-vue@npm:${declared}`];
      if (!descriptors.some(d => declared ? expected.includes(d) : d.startsWith('ant-design-vue@'))) continue;
      const version = block.match(/\n\s+version\s*:?\s*["']?(\d+\.\d+\.\d+(?:-[\w.-]+)?)/)?.[1];
      if (version) matches.push(version);
    }
    const unique = [...new Set(matches)];
    return { resolved: unique.length === 1 ? unique[0] : null, source: 'yarn.lock' };
  }
  return { resolved: null, source: null };
}
export async function inspectProject(projectRoot) {
  const root = await realpath(projectRoot);
  const pkg = JSON.parse(await safeRead(root, 'package.json') ?? '{}');
  const deps = { ...pkg.devDependencies, ...pkg.dependencies };
  const declared = deps['ant-design-vue'] ?? null;
  const lock = await lockedVersion(root, declared);
  const components = [], limits = { truncated: false }; let entries = 0;
  async function walk(folder, depth) {
    if (depth > 7) { limits.truncated = true; return; }
    let dir; try { dir = await readdir(folder, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    for (const e of dir.sort((a,b) => a.name.localeCompare(b.name))) {
      if (++entries > 5000) { limits.truncated = true; return; }
      if (e.name.startsWith('.') || ['node_modules','dist','coverage','build'].includes(e.name) || e.isSymbolicLink()) continue;
      const path = join(folder, e.name);
      if (e.isDirectory()) await walk(path, depth + 1);
      else if (/\.(vue|tsx)$/.test(e.name)) {
        const text = await safeRead(root, relative(root, path), 300_000);
        components.push({ name: e.name.replace(/\.(vue|tsx)$/, ''), path: relative(root, path).split(sep).join('/'),
          antDesignUsage: [...new Set((text.match(/<a-[a-z-]+/g) || []).map(x => x.slice(1)))] });
      }
    }
  }
  // Search component directories only; never recursively read arbitrary user files.
  for (const folder of ['src/components','components','src/ui']) {
    const dir = join(root, folder);
    try { if ((await lstat(dir)).isSymbolicLink()) continue; } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    await walk(dir, 0);
  }
  return { projectRoot: root, framework: deps.vue ? 'vue' : 'unverified', vue: deps.vue ?? null,
    antDesignVue: { declared, ...lock, defaultRange: '^4.1.0', capabilityCheck: lock.resolved?.startsWith('4.') ? 'Verify requested APIs against this exact 4.x version' : 'unverified' },
    components, limits, config: await loadProjectConfig(root) };
}
const catalog = { table: 'a-table', select: 'a-select', button: 'a-button', input: 'a-input', modal: 'a-modal', pagination: 'a-pagination', tag: 'a-tag', tabs: 'a-tabs', form: 'a-form', empty: 'a-empty', tooltip: 'a-tooltip', datePicker: 'a-date-picker' };
export function chooseComponent(semantic, config = {}, project = null) {
  const priority = { project: 0, 'ant-design-vue': 1, custom: 2 };
  const mappings = (config.mappings || []).filter(m => m.semantic === semantic).sort((a,b) => priority[a.provider] - priority[b.provider]);
  if (mappings[0]?.provider === 'project') return { ...mappings[0], status: mappings[0].design ? 'mapped' : 'needs-design-mapping', evidence: 'explicit-config' };
  const candidates = (project?.components || []).filter(c => c.name.toLowerCase().includes(semantic.toLowerCase()) || c.antDesignUsage.includes(catalog[semantic]));
  if (candidates.length) return { semantic, provider: 'project', status: 'needs-mapping', candidates,
    reason: 'Confirm the project wrapper before falling back to Ant Design Vue' };
  if (mappings[0]?.provider === 'ant-design-vue') return { ...mappings[0], status: mappings[0].design ? 'mapped' : 'needs-design-mapping', evidence: 'explicit-config' };
  if (catalog[semantic]) return { semantic, provider: 'ant-design-vue', status: 'needs-design-mapping', code: { name: catalog[semantic], importFrom: 'ant-design-vue' },
    version: project?.antDesignVue.resolved ?? null, defaultRange: '^4.1.0', evidence: 'baseline-catalog',
    reason: 'Code component recommendation; a verified Pixso component ID is still required for instancing' };
  if (mappings.length) return { ...mappings[0], status: mappings[0].design ? 'mapped' : 'needs-design-mapping', evidence: 'explicit-config' };
  return { semantic, provider: 'custom', status: 'design-needed', reason: 'No matching project or baseline component; explain why a new component is needed' };
}
