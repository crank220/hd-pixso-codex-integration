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
      instances = 0,
      sample = null;
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
        sample ??= { id: n.id, status: publishStatus };
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
      sampledPublishStatus: sample?.status ?? 'not-applicable',
      sampledComponentId: sample?.id ?? null,
      referenceNodes: page.children.map((n) => ({ id: n.id, name: n.name, type: n.type })),
    });
  }
  if (
    pixso.fileKey !== expectedFileKey ||
    pixso.root.children.map((p) => p.id).join(',') !== pageIds
  )
    throw Error('LIBRARY_CHANGED_DURING_INDEX');
  return { name: pixso.root.name, pages, families };
}
