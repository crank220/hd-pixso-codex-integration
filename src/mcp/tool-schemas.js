// 定义 MCP 图层编辑的输入契约，仅接受声明式操作和明确列出的属性。
import { z } from 'zod';

/** 编辑属性白名单：坐标/尺寸以 px 为单位，opacity 为 0–1，颜色为六位 HEX。 */
export const layerPropsSchema = z
  .object({
    name: z.string().max(20000).optional(),
    text: z.string().max(20000).optional(),
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    width: z.number().positive().max(100000).optional(),
    height: z.number().positive().max(100000).optional(),
    visible: z.boolean().optional(),
    opacity: z.number().min(0).max(1).optional(),
    fill: z
      .string()
      .regex(/^#[a-fA-F0-9]{6}$/)
      .optional(),
    stroke: z
      .string()
      .regex(/^#[a-fA-F0-9]{6}$/)
      .optional(),
    strokeWeight: z.number().min(0).optional(),
    cornerRadius: z.number().min(0).optional(),
    fontSize: z.number().min(1).max(512).optional(),
    fontName: z.object({ family: z.string(), style: z.string() }).strict().optional(),
    textAutoResize: z.enum(['NONE', 'HEIGHT', 'WIDTH_AND_HEIGHT']).optional(),
    textAlignHorizontal: z.enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']).optional(),
    layoutMode: z.enum(['NONE', 'HORIZONTAL', 'VERTICAL']).optional(),
    paddingLeft: z.number().min(0).optional(),
    paddingRight: z.number().min(0).optional(),
    paddingTop: z.number().min(0).optional(),
    paddingBottom: z.number().min(0).optional(),
    itemSpacing: z.number().min(0).optional(),
    clipsContent: z.boolean().optional(),
  })
  .strict();
/** 原生节点 ID、范围 token 及批内 $key 引用的长度边界；具体归属由引擎验证。 */
export const nodeIdSchema = z.string().min(1).max(300);
const base = {
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),
  parentId: nodeIdSchema,
  props: layerPropsSchema.default({}),
};
const font = z
  .object({ family: z.string().min(1).max(200), style: z.string().min(1).max(200) })
  .strict();
/** 严格区分声明式操作；不暴露任意脚本、删除、跨页移动或全局样式写入口。 */
export const patchOperationSchema = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('library-style'),
      nodeId: nodeIdSchema,
      libraryId: nodeIdSchema,
      styleKey: nodeIdSchema,
      slot: z.enum(['fill', 'stroke', 'text', 'effect', 'grid']),
    })
    .strict(),
  z
    .object({
      op: z.literal('library-variable'),
      nodeId: nodeIdSchema,
      libraryId: nodeIdSchema,
      variableKey: nodeIdSchema,
      field: z.literal('visible'),
    })
    .strict(),
  z
    .object({
      op: z.literal('library-instance'),
      ...base,
      familyId: nodeIdSchema,
      libraryId: nodeIdSchema.default('ant-design-vue-community'),
      fontSubstitutions: z
        .array(z.object({ from: font, to: font }).strict())
        .max(32)
        .default([]),
      variants: z.record(z.string().max(200), z.string().max(300)).default({}),
      componentProperties: z
        .record(z.string().max(300), z.union([z.string().max(20000), z.boolean()]))
        .default({}),
    })
    .strict(),
  z.object({ op: z.literal('update'), nodeId: nodeIdSchema, props: layerPropsSchema }).strict(),
  z
    .object({ op: z.literal('insert'), ...base, kind: z.enum(['frame', 'text', 'rectangle']) })
    .strict(),
  z.object({ op: z.literal('clone'), ...base, sourceId: nodeIdSchema }).strict(),
  z
    .object({
      op: z.literal('instance'),
      ...base,
      componentId: nodeIdSchema,
      semantic: z.string().min(1),
    })
    .strict(),
]);
