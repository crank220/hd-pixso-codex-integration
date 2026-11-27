// 读取随插件分发的完整组件目录，精确选择真实变体；目录不包含设计稿几何数据。
import { readFileSync } from 'node:fs';
import { PLUGIN_ROOT } from '../plugin-info.js';

const registry = JSON.parse(
  readFileSync(new URL('assets/libraries/registry.json', PLUGIN_ROOT), 'utf8'),
);
const catalogs = new Map(
  registry.map((entry) => {
    const data = JSON.parse(
      readFileSync(new URL(`assets/libraries/${entry.file}`, PLUGIN_ROOT), 'utf8'),
    );
    return [entry.id, { ...data, purpose: entry.purpose }];
  }),
);
const ANT_LIBRARY_ID = 'ant-design-vue-community';
const getCatalog = (id) => {
  // 多库节点 ID 可重复；不再为缺失的库标识静默选择 Ant 库。
  if (!id) throw Error('LIBRARY_ID_REQUIRED');
  const catalog = catalogs.get(id);
  if (!catalog) throw Error('LIBRARY_NOT_FOUND');
  return catalog;
};
// 注册顺序即资源使用顺序：公司样式、公司标注、Ant UI；不按名称重新排序。
const libraries = () =>
  [...catalogs.values()].map((c) => ({
    id: c.id,
    name: c.name,
    purpose: c.purpose,
    pages: c.pages.length,
    families: c.families.length,
    styles: (c.styles || []).length,
    variables: (c.variables || []).length,
  }));
const summary = (family) => ({
  familyId: family.id,
  name: family.name,
  page: family.page,
  type: family.type,
  variantCount: family.variants.length,
  publishStatus: family.publishStatus ?? 'unknown',
});

/** libraryId 必填；分页返回目录，显式 familyId 才返回属性与变体。 */
export function searchLibrary({
  libraryId,
  kind = 'components',
  query = '',
  page,
  familyId,
  offset = 0,
  limit = 20,
} = {}) {
  const catalog = getCatalog(libraryId);
  if (!['components', 'styles', 'variables'].includes(kind))
    throw Error('LIBRARY_RESOURCE_KIND_UNSUPPORTED');
  if (kind !== 'components') {
    if (familyId || page) throw Error('LIBRARY_RESOURCE_FILTER_UNSUPPORTED');
    const matches = (catalog[kind] || []).filter((row) =>
      `${row.name} ${row.key}`.toLowerCase().includes(query.toLowerCase()),
    );
    return {
      libraryId,
      source: catalog.source,
      libraries: libraries(),
      kind,
      total: matches.length,
      offset,
      nextOffset: offset + limit < matches.length ? offset + limit : null,
      resources: matches.slice(offset, offset + limit),
    };
  }
  if (familyId) {
    const family = catalog.families.find((row) => row.id === familyId);
    if (!family) throw Error('LIBRARY_FAMILY_NOT_FOUND');
    return {
      libraryId,
      libraries: libraries(),
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
    libraryId,
    libraries: libraries(),
    source: catalog.source,
    coverage: {
      styles: (catalog.styles || []).length,
      variables: (catalog.variables || []).length,
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
      'Catalog values are captured metadata. Native library access and imported versions must be verified; annotation instances do not create native comments.',
  };
}

/** 只允许目录中存在的组合；优先完整默认组合，不把含糊匹配静默选成第一个。 */
export function selectLibraryVariant(libraryId, familyId, variants = {}, componentProperties = {}) {
  const catalog = getCatalog(libraryId);
  const family = catalog.families.find((row) => row.id === familyId);
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
    libraryId,
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
  const catalog = getCatalog(ANT_LIBRARY_ID);
  const page = catalog.pages.find((p) => p.name.toLowerCase() === semantic.toLowerCase());
  return page
    ? {
        libraryId: ANT_LIBRARY_ID,
        page: page.name,
        components: page.components,
        status: page.components ? 'catalogued-not-instanced' : 'reference-only',
        tool: 'pixso_library',
      }
    : null;
}

/** 资源按库和真实 key 精确定位；调用方不能注入任意共享样式或变量。 */
export function selectLibraryResource(libraryId, kind, key) {
  const catalog = getCatalog(libraryId);
  if (!['styles', 'variables'].includes(kind)) throw Error('LIBRARY_RESOURCE_KIND_UNSUPPORTED');
  const asset = (catalog[kind] || []).find((row) => row.key === key);
  if (!asset) throw Error('LIBRARY_RESOURCE_NOT_FOUND');
  return { ...asset, libraryId, sourceFileKey: catalog.source.fileKey, sourceNodeId: asset.id };
}
