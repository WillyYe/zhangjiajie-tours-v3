// 浏览器内的 *-data.mjs 解析 / 序列化。
// 只重写被编辑的 export 块，其余块（如 hotelCategories）原样保留，保证 diff 最小。

// 从 open 括号处匹配到对应的闭合括号（忽略字符串 / 模板串内的括号）
function matchBracket(text, start) {
  const open = text[start];
  const closeMap = { '{': '}', '[': ']', '(': ')' };
  const close = closeMap[open];
  if (!close) return -1;
  let depth = 0;
  let i = start;
  let inStr = null;
  let escaped = false;
  while (i < text.length) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inStr) inStr = null;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return i;
      }
    }
    i++;
  }
  return -1;
}

export function parseMjs(text) {
  const re = /export\s+const\s+(\w+)\s*=/g;
  const blocks = [];
  let m;
  let firstIndex = -1;
  while ((m = re.exec(text)) !== null) {
    if (firstIndex === -1) firstIndex = m.index;
    const name = m[1];
    let i = text.indexOf('=', m.index) + 1;
    while (i < text.length && /\s/.test(text[i])) i++;
    const close = matchBracket(text, i);
    const raw = text.slice(m.index, close + 2); // 含结尾分号
    const body = text.slice(i, close + 1);
    let value = null;
    try {
      value = new Function('"use strict"; return (' + body + ');')();
    } catch (e) {
      console.warn('parse fail for', name, e);
    }
    blocks.push({ name, raw, value });
  }
  const preamble = firstIndex === -1 ? '' : text.slice(0, firstIndex);
  return { preamble, blocks };
}

// 用编辑后的 value 替换对应块，其余原样保留，重建整文件文本
// 重写被编辑的块。edited 可以是：
//  - { name: value, ... } 映射（推荐）：只重写列出的块，其余原样保留，保证 diff 最小
//  - (兼容旧调用) editedName: string, editedValue: any → 等价于 { [editedName]: editedValue }
export function rebuild(preamble, blocks, edited, editedValue) {
  let map;
  if (typeof edited === 'string') map = { [edited]: editedValue };
  else map = edited || {};
  const serialized = blocks
    .map((b) =>
      Object.prototype.hasOwnProperty.call(map, b.name)
        ? `export const ${b.name} = ${jsSerialize(map[b.name], 0)};`
        : b.raw
    )
    .join('\n\n');
  return preamble + serialized + '\n';
}

function jsSerialize(val, indent) {
  const pad = '  '.repeat(indent);
  const pad1 = '  '.repeat(indent + 1);
  if (val === null) return 'null';
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return serializeString(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    const flat = val.every((v) => ['string', 'number', 'boolean'].includes(typeof v));
    if (flat) {
      // 扁平数组（字符串/数字/布尔）一律单行，贴合原文件风格
      return `[${val.map((v) => jsSerialize(v, 0)).join(', ')}]`;
    }
    const items = val.map((v) => pad1 + jsSerialize(v, indent + 1) + ',');
    return `[\n${items.join('\n')}\n${pad}]`;
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val);
    if (keys.length === 0) return '{}';
    const items = keys.map((k) => `${pad1}${serializeKey(k)}: ${jsSerialize(val[k], indent + 1)},`);
    return `{\n${items.join('\n')}\n${pad}}`;
  }
  return String(val);
}

function serializeKey(k) {
  return /^[A-Za-z_$][\w$]*$/.test(k) ? k : serializeString(k);
}

function serializeString(s) {
  const esc = s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `'${esc}'`;
}
