// 读取随插件分发的完整组件目录，精确选择真实变体；目录不包含设计稿几何数据。
import { readFileSync } from 'node:fs';
import { PLUGIN_ROOT } from '../plugin-info.js';

const catalog = JSON.parse(
  readFileSync(new URL('assets/libraries/ant-design-vue.json', PLUGIN_ROOT), 'utf8'),
);
export const LIBRARY_ID = catalog.id;
const families = new Map(catalog.families.map((family) => [family.id, family]));
const summary = (family) => ({
  familyId: family.id,
  name: family.name,
  page: family.page,
  type: family.type,
  variantCount: family.variants.length,
  publishStatus: family.publishStatus ?? 'unknown',
});

/** 分页返回目录，显式 familyId 才返回属性定义与变体，避免一次输出整个组件库。 */
export function searchLibrary({ query = '', page, familyId, offset = 0, limit = 20 } = {}) {
  if (familyId) {
    const family = families.get(familyId);
    if (!family) throw Error('LIBRARY_FAMILY_NOT_FOUND');
    return {
      libraryId: LIBRARY_ID,
      source: catalog.source,
      ...summary(family),
      definitions: family.definitions,
      total: family.variants.length,
      offset,
      nextOffset: offset + limit < family.variants.length ? offset + limit : null,
      variants: family.variants.slice(offset, offset + limit),
    };
  }
  const matches = catalog.families.filter(
    (f) =>
      (!page || f.page.toLowerCase() === page.toLowerCase()) &&
      `${f.page} ${f.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  return {
    libraryId: LIBRARY_ID,
    source: catalog.source,
    coverage: {
      pages: catalog.pages.length,
      families: catalog.families.length,
      variants: catalog.families.reduce((sum, f) => sum + f.variants.length, 0),
      publication: catalog.families.reduce((counts, f) => {
        const status = f.publishStatus ?? 'unknown';
        counts[status] = (counts[status] || 0) + 1;
        return counts;
      }, {}),
    },
    pages: catalog.pages
      .filter((p) => !page || p.name.toLowerCase() === page.toLowerCase())
      .map((p) => ({
        id: p.id,
        name: p.name,
        components: p.components,
        componentSets: p.componentSets,
        role: p.components ? 'components' : p.nodes > 1 ? 'reference' : 'separator',
        sampledPublishStatus: p.sampledPublishStatus,
        publishStatuses: p.publishStatuses,
        ...(page
          ? {
              referenceNodes: p.referenceNodes.slice(offset, offset + limit),
              referenceTotal: p.referenceNodes.length,
            }
          : {}),
      })),
    total: matches.length,
    offset,
    families: matches.slice(offset, offset + limit).map(summary),
    nextOffset: offset + limit < matches.length ? offset + limit : null,
    notice:
      'Metadata coverage is not import verification. Published library access is required across files. The UI kit declares 4.2.3; code API compatibility still needs verification.',
  };
}

/** 只允许目录中存在的组合；优先完整默认组合，不把含糊匹配静默选成第一个。 */
export function selectLibraryVariant(familyId, variants = {}, componentProperties = {}) {
  const family = families.get(familyId);
  if (!family) throw Error('LIBRARY_FAMILY_NOT_FOUND');
  const defs = family.definitions;
  for (const [name, value] of Object.entries(variants)) {
    if (defs[name]?.type !== 'VARIANT' || !defs[name].variantOptions.includes(value))
      throw Error(`LIBRARY_VARIANT_UNSUPPORTED: ${name}=${value}`);
  }
  const matches = family.variants.filter((v) =>
    Object.entries(variants).every(([name, value]) => v.properties[name] === value),
  );
  const defaults = Object.fromEntries(
    Object.entries(defs)
      .filter(([, def]) => def.type === 'VARIANT')
      .map(([name, def]) => [name, variants[name] ?? def.defaultValue]),
  );
  const preferred = matches.filter((v) =>
    Object.entries(defaults).every(([name, value]) => v.properties[name] === value),
  );
  const chosen = preferred.length === 1 ? preferred[0] : matches.length === 1 ? matches[0] : null;
  if (!chosen)
    throw Error(
      matches.length
        ? 'LIBRARY_VARIANT_AMBIGUOUS: specify remaining axes'
        : 'LIBRARY_VARIANT_COMBINATION_MISSING',
    );
  for (const [name, value] of Object.entries(componentProperties)) {
    const type = defs[name]?.type;
    if (
      !['TEXT', 'BOOLEAN'].includes(type) ||
      (type === 'TEXT' && (typeof value !== 'string' || value.length > 20000)) ||
      (type === 'BOOLEAN' && typeof value !== 'boolean')
    )
      throw Error(`LIBRARY_PROPERTY_UNSUPPORTED: ${name}`);
  }
  return {
    libraryId: LIBRARY_ID,
    sourceFileKey: catalog.source.fileKey,
    familyId,
    sourceNodeId: chosen.nodeId,
    key: chosen.key,
    name: chosen.name,
    variantProperties: chosen.properties,
    componentProperties,
    // 仅为本次覆盖保留定义；真正写入前仍核对原生实例可用属性。
    propertyDefinitions: Object.fromEntries(
      Object.keys(componentProperties).map((name) => [name, defs[name]]),
    ),
  };
}

/** 只返回目录入口，不把没有映射的推荐误报为已实例化或已核验 API。 */
export function libraryRecommendation(semantic) {
  const pages = { datePicker: 'DatePicker', datepicker: 'DatePicker' };
  const page = catalog.pages.find(
    (p) => p.name.toLowerCase() === (pages[semantic] || semantic).toLowerCase(),
  );
  return page
    ? {
        libraryId: LIBRARY_ID,
        page: page.name,
        components: page.components,
        status: page.components ? 'catalogued-not-instanced' : 'reference-only',
        tool: 'pixso_library',
      }
    : null;
}
