// 源库处于本地活动文件时，逐页只读更新内置目录；不会发布组件或改源画布。
import { readFile, writeFile } from 'node:fs/promises';
import { PixsoUpstream } from '../src/pixso/upstream.js';
import { indexLibraryRuntime } from '../src/library/index-runtime.js';
const path = 'assets/libraries/ant-design-vue.json';
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
  };
  // 采集与完整性检查成功后才替换本地文件；版本声明需要人工核对封面后另行更新。
  await writeFile(path, JSON.stringify(next) + '\n');
  console.log(
    JSON.stringify({
      pages: next.pages.length,
      families: next.families.length,
      variants: next.families.reduce((sum, f) => sum + f.variants.length, 0),
    }),
  );
} finally {
  await upstream.close();
}
