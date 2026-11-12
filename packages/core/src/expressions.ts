/** Instruments top-level JavaScript expressions for automatic results without re-evaluating code. */
import { parse, type Node, type Token } from 'acorn';

interface Edit {
  start: number;
  end: number;
  text: string;
  /** Orders edits sharing one position: closers apply last-to-first before openers. */
  order: number;
}

type SyntaxNode = Node & Record<string, unknown>;

/**
 * Visits every syntax node below a parsed program, including nested functions and callbacks.
 * @param value Node, node list, or primitive property encountered during traversal.
 * @param visit Receives each syntax node once, parents before children.
 */
function walk(value: unknown, visit: (node: SyntaxNode) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
  } else if (value && typeof value === 'object') {
    const node = value as SyntaxNode;
    if (typeof node.type !== 'string') return;
    visit(node);
    for (const key of Object.keys(node)) if (key !== 'loc') walk(node[key], visit);
  }
}

/** @param node Any expression. @returns Whether it is a direct `console.method(...)` call. */
function isConsoleCall(node: SyntaxNode): boolean {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee as SyntaxNode;
  if (callee.type !== 'MemberExpression') return false;
  const object = callee.object as SyntaxNode;
  return object.type === 'Identifier' && object.name === 'console';
}

/**
 * Wraps top-level expressions in a uniquely named host callback and tags console calls with their line.
 * Expressions become `capture(expression, line)`; `console.log()` becomes `capture.at(line).log()`.
 * Declarations and expression statements inside functions or loops are not reported.
 * @param source Compiled JavaScript, including optional Node module imports and top-level await.
 * @returns Source and callback parameter name for the disposable execution function.
 */
export function captureExpressions(source: string): { code: string; captureName: string } {
  const tokens: Token[] = [];
  const program = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
    locations: true,
    onToken: tokens,
  });
  const identifiers = new Set(
    tokens
      .filter((token) => token.type.label === 'name')
      .map((token) => ('value' in token ? token.value : undefined)),
  );
  let captureName = '__jsgoappCapture';
  while (identifiers.has(captureName)) captureName += '_';

  const edits: Edit[] = [];
  walk(program, (node) => {
    if (!isConsoleCall(node)) return;
    const receiver = (node.callee as SyntaxNode).object as Node;
    edits.push({
      start: receiver.start,
      end: receiver.end,
      text: `${captureName}.at(${node.loc!.start.line})`,
      order: 1,
    });
  });
  for (const statement of program.body) {
    if (statement.type !== 'ExpressionStatement') continue;
    const expression = statement.expression;
    if (expression.type === 'Literal' && expression.value === 'use strict') continue;
    // Console calls report their own output; wrapping them would only add an undefined result.
    if (isConsoleCall(expression as unknown as SyntaxNode)) continue;
    edits.push({
      start: expression.start,
      end: expression.start,
      text: `${captureName}(`,
      order: 2,
    });
    edits.push({
      start: expression.end,
      end: expression.end,
      text: `, ${expression.loc!.start.line})`,
      order: 0,
    });
  }

  // Apply edits backwards so every original syntax range remains valid. At a shared position the
  // opening wrapper is applied last so it lands before a replaced console receiver.
  edits.sort((a, b) => b.start - a.start || a.order - b.order);
  let code = source;
  for (const edit of edits) code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
  return { code, captureName };
}
