// 源库处于本地活动文件时，逐页只读更新内置目录；不会发布组件或改源画布。
import { readFile, writeFile } from 'node:fs/promises';
import { PixsoUpstream } from '../src/pixso/upstream.js';
import { indexLibraryRuntime } from '../src/library/index-runtime.js';
const registry = JSON.parse(await readFile('assets/libraries/registry.json', 'utf8'));
const entry = registry.find((row) => row.id === (process.argv[2] || 'ant-design-vue-community'));
if (!entry) throw Error('LIBRARY_NOT_FOUND');
const path = `assets/libraries/${entry.file}`;
const previous = JSON.parse(await readFile(path, 'utf8'));
const upstream = new PixsoUpstream(process.env.PIXSO_MCP_URL);
try {
  const data = await upstream.evaluate(
    `return await (${indexLibraryRuntime.toString()})(${JSON.stringify(previous.source.fileKey)});`,
  );
  if (data.name !== previous.name)
    throw Error('LIBRARY_NAME_CHANGED: review the source before updating');
  for (const page of data.pages) {
    const families = data.families.filter((f) => f.pageId === page.id);
    if (families.reduce((sum, f) => sum + f.variants.length, 0) !== page.components)
      throw Error(`LIBRARY_COMPONENT_COUNT_MISMATCH: ${page.name}`);
  }
  const next = {
    ...previous,
    source: { ...previous.source, capturedAt: new Date().toISOString().slice(0, 10) },
    pages: data.pages,
    families: data.families,
    styles: data.styles,
    variables: data.variables,
    collections: data.collections,
  };
  // 企业库仅发布资源定位元数据；示例业务画板、文案和规则正文留在受权限保护的 Pixso 源文件。
  if (entry.id !== 'ant-design-vue-community')
    for (const page of next.pages)
      page.referenceNodes = page.referenceNodes.filter((node) =>
        ['COMPONENT', 'COMPONENT_SET'].includes(node.type),
      );
  // 采集与完整性检查成功后才替换本地文件；版本声明需要人工核对封面后另行更新。
  await writeFile(path, JSON.stringify(next) + '\n');
  console.log(
    JSON.stringify({
      pages: next.pages.length,
      families: next.families.length,
      variants: next.families.reduce((sum, f) => sum + f.variants.length, 0),
      styles: next.styles.length,
      variables: next.variables.length,
    }),
  );
} finally {
  await upstream.close();
}
