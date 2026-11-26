// 提供最小合成 Plugin API 边界，不包含公司设计内容，也不写入原生应用。
/** 仅复现被范围引擎使用的行为；不代表原生排版、字体或截图能力已验证。 */
export function fakePixso() {
  let next = 100;
  const nodes = new Map();
  class Node {
    constructor(type, id = String(++next)) {
      Object.assign(this, {
        id,
        type,
        name: type,
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        visible: true,
        opacity: 1,
        fills: [],
        strokes: [],
        strokeWeight: 1,
        cornerRadius: 0,
        layoutMode: 'NONE',
        children: [],
        textAutoResize: 'WIDTH_AND_HEIGHT',
        fontName: { family: 'Noto Sans SC', style: 'Regular' },
        fontSize: 14,
        characters: '',
        lineHeight: { unit: 'AUTO' },
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        itemSpacing: 0,
      });
      nodes.set(id, this);
    }
    appendChild(n) {
      if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1);
      n.parent = this;
      this.children.push(n);
    }
    resize(w, h) {
      // 约定 666px 触发一次原生尺寸写入失败，用于验证前序写入是否被完整补偿。
      if (w === 666) throw Error('Native resize failed');
      this.width = w;
      this.height = h;
    }
    remove() {
      if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
      nodes.delete(this.id);
      this.removed = true;
    }
    clone() {
      const n = new Node(this.type);
      for (const key of Object.keys(this))
        if (!['id', 'parent', 'children', 'removed'].includes(key))
          n[key] = structuredClone(this[key]);
      for (const c of this.children) n.appendChild(c.clone());
      if (this.parent) this.parent.appendChild(n);
      return n;
    }
    createInstance() {
      const n = this.clone();
      n.type = 'INSTANCE';
      n.mainComponent = this;
      return n;
    }
  }
  const root = new Node('DOCUMENT', '0:0');
  root.name = 'Synthetic design';
  const p = new Node('PAGE', '1:1');
  p.name = 'gpt测试';
  root.appendChild(p);
  const other = new Node('PAGE', '2:1');
  other.name = 'Protected';
  root.appendChild(other);
  const frame = new Node('FRAME', '1:2');
  frame.name = 'Task list';
  p.appendChild(frame);
  const t = new Node('TEXT', '1:3');
  t.name = 'Type';
  t.characters = '模版';
  frame.appendChild(t);
  const outside = new Node('TEXT', '2:2');
  outside.characters = 'Protected text';
  other.appendChild(outside);
  const component = new Node('COMPONENT', '2:3');
  component.name = 'Project/Button';
  other.appendChild(component);
  const api = {
    root,
    currentPage: p,
    fileKey: 'synthetic-file',
    mixed: Symbol('mixed'),
    getNodeById: (id) => nodes.get(id) ?? null,
    loadFontAsync: async () => {},
    createFrame: () => new Node('FRAME'),
    createRectangle: () => new Node('RECTANGLE'),
    createText: () => new Node('TEXT'),
    viewport: { scrollAndZoomIntoView() {} },
  };
  p.selection = [frame];
  other.selection = [];
  return api;
}
