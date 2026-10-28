// コードのプレビューの「構成」欄：関数・クラス・見出しを正規表現で拾う（厳密な構文解析はしない）

export type OutlineItem = {
  // f：関数、c：クラス・型、h：見出し
  kind: 'f' | 'c' | 'h';
  name: string;
  line: number;
};

const MAX_ITEMS = 12;

type Rule = { kind: OutlineItem['kind']; pattern: RegExp };

const js: Rule[] = [
  { kind: 'c', pattern: /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'c', pattern: /^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'f', pattern: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/ },
  { kind: 'f', pattern: /^\s*(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/ },
];
const cLike: Rule[] = [
  { kind: 'c', pattern: /^\s*(?:public\s+|private\s+|protected\s+|internal\s+)?(?:static\s+|abstract\s+|final\s+|sealed\s+|partial\s+)*(?:class|interface|struct|enum|record)\s+([A-Za-z_]\w*)/ },
  // 戻り値の型＋名前＋( で始まり、制御文ではない行
  { kind: 'f', pattern: /^\s*(?:public\s+|private\s+|protected\s+|static\s+|inline\s+|virtual\s+|override\s+|async\s+|final\s+|const\s+|unsigned\s+)*[A-Za-z_][\w<>,\s*&:\[\]]*\s+\**([A-Za-z_]\w*)\s*\([^;]*$/ },
];

const rules: Record<string, Rule[]> = {
  py: [
    { kind: 'c', pattern: /^\s*class\s+([A-Za-z_]\w*)/ },
    { kind: 'f', pattern: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/ },
  ],
  js, mjs: js, cjs: js, jsx: js, ts: js, tsx: js,
  java: cLike, cs: cLike, c: cLike, h: cLike, cpp: cLike, cc: cLike, hpp: cLike,
  kt: [
    { kind: 'c', pattern: /^\s*(?:data\s+|sealed\s+|abstract\s+|open\s+)*(?:class|interface|object)\s+([A-Za-z_]\w*)/ },
    { kind: 'f', pattern: /^\s*(?:private\s+|public\s+|override\s+|suspend\s+)*fun\s+(?:<[^>]+>\s*)?([A-Za-z_]\w*)/ },
  ],
  swift: [
    { kind: 'c', pattern: /^\s*(?:public\s+|private\s+|final\s+)*(?:class|struct|enum|protocol|extension)\s+([A-Za-z_]\w*)/ },
    { kind: 'f', pattern: /^\s*(?:public\s+|private\s+|static\s+|override\s+)*func\s+([A-Za-z_]\w*)/ },
  ],
  go: [
    { kind: 'c', pattern: /^type\s+([A-Za-z_]\w*)\s+(?:struct|interface)/ },
    { kind: 'f', pattern: /^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/ },
  ],
  rs: [
    { kind: 'c', pattern: /^\s*(?:pub\s+)?(?:struct|enum|trait|impl)\s+([A-Za-z_]\w*)/ },
    { kind: 'f', pattern: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)/ },
  ],
  rb: [
    { kind: 'c', pattern: /^\s*(?:class|module)\s+([A-Z][\w:]*)/ },
    { kind: 'f', pattern: /^\s*def\s+(?:self\.)?([A-Za-z_]\w*[?!=]?)/ },
  ],
  php: [
    { kind: 'c', pattern: /^\s*(?:abstract\s+|final\s+)?(?:class|interface|trait)\s+([A-Za-z_]\w*)/ },
    { kind: 'f', pattern: /^\s*(?:public\s+|private\s+|protected\s+|static\s+)*function\s+([A-Za-z_]\w*)/ },
  ],
  sql: [{ kind: 'c', pattern: /^\s*create\s+(?:or\s+replace\s+)?(?:table|view|function|procedure|index)\s+(?:if\s+not\s+exists\s+)?([\w."]+)/i }],
  md: [{ kind: 'h', pattern: /^#{1,3}\s+(.+)$/ }],
  html: [{ kind: 'h', pattern: /<h[1-3][^>]*>([^<]+)</i }],
  htm: [{ kind: 'h', pattern: /<h[1-3][^>]*>([^<]+)</i }],
  sh: [{ kind: 'f', pattern: /^\s*(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*\{?/ }],
  bash: [{ kind: 'f', pattern: /^\s*(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*\{?/ }],
  r: [{ kind: 'f', pattern: /^\s*([A-Za-z_.][\w.]*)\s*(?:<-|=)\s*function\s*\(/ }],
  scala: [
    { kind: 'c', pattern: /^\s*(?:case\s+)?(?:class|object|trait)\s+([A-Za-z_]\w*)/ },
    { kind: 'f', pattern: /^\s*def\s+([A-Za-z_]\w*)/ },
  ],
};

// 関数と誤認しやすい制御文
const NOT_FUNCTIONS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'else', 'sizeof', 'new']);

export function codeOutline(text: string, ext: string): OutlineItem[] {
  const list = rules[ext];
  if (!list) return [];
  const items: OutlineItem[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length && items.length < MAX_ITEMS; i++) {
    for (const { kind, pattern } of list) {
      const name = lines[i].match(pattern)?.[1]?.trim();
      if (name && !NOT_FUNCTIONS.has(name)) {
        items.push({ kind, name, line: i + 1 });
        break;
      }
    }
  }
  return items;
}
