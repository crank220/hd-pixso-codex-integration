// 在 Pixso 沙箱内只读采集所有页面、组件族和变体；不得修改源库或创建实例。
export async function indexLibraryRuntime(expectedFileKey) {
  if (pixso.fileKey !== expectedFileKey) throw Error('LIBRARY_SOURCE_MISMATCH');
  const pageIds = pixso.root.children.map((p) => p.id).join(','),
    pages = [],
    families = [];
  let total = 0;
  for (const page of pixso.root.children) {
    let nodes = 0,
      components = 0,
      sets = 0,
      instances = 0;
    const publishStatuses = {};
    const stack = [page];
    while (stack.length) {
      const n = stack.pop();
      nodes++;
      if (++total > 500000) throw Error('LIBRARY_TOO_LARGE');
      if (n.type === 'COMPONENT') {
        components++;
      }
      if (n.type === 'COMPONENT_SET') sets++;
      if (n.type === 'INSTANCE') instances++;
      if (
        n.type === 'COMPONENT_SET' ||
        (n.type === 'COMPONENT' && n.parent?.type !== 'COMPONENT_SET')
      ) {
        // Pixso 不允许在单个变体上读取 componentPropertyDefinitions，读取其父组件集。
        const definitions = n.componentPropertyDefinitions || {};
        // 变体子节点可能返回 UNPUBLISHED；发布单位是组件集或独立主组件。
        const publishStatus =
          typeof n.getPublishStatusAsync === 'function'
            ? await n.getPublishStatusAsync()
            : 'unknown';
        publishStatuses[publishStatus] = (publishStatuses[publishStatus] || 0) + 1;
        const variants = (n.type === 'COMPONENT_SET' ? n.children : [n])
          .filter((c) => c.type === 'COMPONENT')
          .map((c) => ({
            nodeId: c.id,
            key: c.key,
            name: c.name,
            width: c.width,
            height: c.height,
            properties: c.variantProperties || {},
          }));
        families.push({
          id: n.id,
          pageId: page.id,
          page: page.name.trim(),
          name: n.name,
          type: n.type,
          key: n.key,
          publishStatus,
          definitions,
          variants,
        });
      }
      if (n.children) stack.push(...n.children);
    }
    pages.push({
      id: page.id,
      name: page.name.trim(),
      nodes,
      components,
      componentSets: sets,
      instances,
      publishStatuses,
      referenceNodes: page.children
        .filter((n) => n.type !== 'TEXT')
        .map((n) => ({ id: n.id, name: n.name, type: n.type })),
    });
  }
  const styles = [];
  for (const method of [
    'getLocalPaintStyles',
    'getLocalTextStyles',
    'getLocalEffectStyles',
    'getLocalGridStyles',
  ]) {
    if (typeof pixso[method] !== 'function') continue;
    for (const style of pixso[method]()) {
      const row = {
        id: style.id,
        key: style.key,
        name: style.name,
        type: style.type,
        publishStatus:
          typeof style.getPublishStatusAsync === 'function'
            ? await style.getPublishStatusAsync()
            : 'unknown',
      };
      for (const key of [
        'paints',
        'fontName',
        'fontSize',
        'lineHeight',
        'letterSpacing',
        'paragraphSpacing',
        'paragraphIndent',
        'textDecoration',
        'textCase',
        'effects',
        'layoutGrids',
      ])
        if (style[key] !== undefined) row[key] = style[key];
      styles.push(row);
    }
  }
  const variables =
    typeof pixso.variables?.getLocalVariablesAsync === 'function'
      ? (await pixso.variables.getLocalVariablesAsync()).map((v) => ({
          id: v.id,
          key: v.key,
          name: v.name,
          resolvedType: v.resolvedType,
          valuesByMode: v.valuesByMode,
          variableCollectionId: v.variableCollectionId,
          scopes: v.scopes,
          hiddenFromPublishing: v.hiddenFromPublishing,
        }))
      : [];
  const collections =
    typeof pixso.variables?.getLocalVariableCollectionsAsync === 'function'
      ? (await pixso.variables.getLocalVariableCollectionsAsync()).map((c) => ({
          id: c.id,
          key: c.key,
          name: c.name,
          modes: c.modes,
          defaultModeId: c.defaultModeId,
          hiddenFromPublishing: c.hiddenFromPublishing,
        }))
      : [];
  if (
    pixso.fileKey !== expectedFileKey ||
    pixso.root.children.map((p) => p.id).join(',') !== pageIds
  )
    throw Error('LIBRARY_CHANGED_DURING_INDEX');
  return { name: pixso.root.name, pages, families, styles, variables, collections };
}
