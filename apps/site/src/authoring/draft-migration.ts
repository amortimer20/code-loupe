import { isMap, isNode, isSeq, parseDocument, visit, type Node, type YAMLMap } from 'yaml';
import { readDocument } from './lesson-document';

const oldKeys = ['var', 'index', 'key', 'attribute'];
const legacy = (node: unknown): node is YAMLMap => isMap(node) && oldKeys.some(key => node.has(key));
function address(map: YAMLMap, action: string) {
  const name = map.get('var');
  if (typeof name !== 'string' || !/^[A-Za-z_]\w*$/.test(name)) throw new Error('An old location needs a variable name supported by the address grammar.');
  if (map.has('target')) throw new Error('A location mixes old keys with target; repair it in YAML.');
  const accessors = ['index', 'key', 'attribute'].filter(key => map.has(key));
  if (accessors.length > 1) throw new Error('A location has multiple accessors; repair it in YAML.');
  if (map.has('scope') && map.get('scope') !== 'global') throw new Error('Only global scope can be migrated.');
  if (['select', 'remove'].includes(action) && accessors[0] !== 'index') throw new Error(`${action} needs a list index.`);
  if (action === 'append' && accessors.length) throw new Error('append needs a bare list name.');
  if (action === 'update' && !accessors.length) throw new Error('A bare-name update needs assign instead.');
  const index = map.get('index'), key = map.get('key'), attribute = map.get('attribute');
  if (map.has('index') && (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0)) throw new Error('A list index must be a nonnegative safe integer.');
  if (map.has('key') && (typeof key !== 'string' || !key || /\s/.test(JSON.stringify(key)))) throw new Error('This key cannot be represented by the current address grammar.');
  if (map.has('attribute') && (typeof attribute !== 'string' || !/^[A-Za-z_]\w*$/.test(attribute))) throw new Error('An attribute needs a supported name.');
  return name + (map.has('index') ? `[${index}]` : map.has('key') ? `[${JSON.stringify(key)}]` : map.has('attribute') ? `.${attribute}` : '');
}
function comments(node: Node) {
  const parts: string[] = [];
  visit(node, (_key, item) => { if (isNode(item)) { if (item.commentBefore) parts.push(item.commentBefore); if (item.comment) parts.push(item.comment); } });
  return parts.join('\n') || undefined;
}

/** Explicit playground recovery only. The player still rejects every removed form. */
export function migrateDraft(source: string): { source: string; changes: number; error?: string } | null {
  const doc = parseDocument(source);
  if (doc.errors.length || !isMap(doc.contents)) return null;
  const steps = doc.get('steps', true);
  if (!isSeq(steps)) return null;
  const locations: { path: (string | number)[]; node: YAMLMap; action: string }[] = [];
  steps.items.forEach((step, index) => {
    if (!isMap(step)) return;
    const badge = step.get('badge', true), from = isMap(badge) ? badge.get('from', true) : undefined;
    if (legacy(from)) locations.push({ path: ['steps', index, 'badge', 'from'], node: from, action: 'from' });
    for (const action of ['select', 'update', 'append', 'remove']) {
      const node = step.get(action, true);
      if (legacy(node)) locations.push({ path: ['steps', index, action], node, action });
    }
  });
  if (!locations.length) return null;
  try {
    readDocument(source); // Refuse aliases/anchors/tags before rewriting anything.
    for (const { path, node, action } of locations) {
      const target = address(node, action);
      if (['from', 'select', 'remove'].includes(action)) {
        if (node.items.some(pair => !['var', 'index', 'key', 'attribute', 'scope'].includes(String(pair.key)))) throw new Error('A location has unknown fields; repair it in YAML.');
        const scoped = node.get('scope') === 'global';
        const replacement = doc.createNode(scoped || (action === 'from' && target === 'console') ? { target, ...(scoped ? { scope: 'global' } : {}) } : target);
        replacement.commentBefore = comments(node);
        doc.setIn(path, replacement);
      } else {
        const replacement = doc.createNode(target);
        replacement.commentBefore = node.items.filter(pair => oldKeys.includes(String(pair.key)))
          .flatMap(pair => [pair.key, pair.value]).map(item => isNode(item) ? comments(item) : '').filter(Boolean).join('\n') || undefined;
        oldKeys.forEach(key => node.delete(key)); node.set('target', replacement);
      }
    }
    return { source: doc.toString(), changes: locations.length };
  } catch (error) { return { source, changes: locations.length, error: (error as Error).message }; }
}
