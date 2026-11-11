/** Instruments top-level JavaScript expressions for automatic results without re-evaluating code. */
import { parse, type Token } from 'acorn';

/**
 * Wraps top-level expressions in a uniquely named host callback; declarations and nested code stay intact.
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
    onToken: tokens,
  });
  const identifiers = new Set(
    tokens
      .filter((token) => token.type.label === 'name')
      .map((token) => ('value' in token ? token.value : undefined)),
  );
  let captureName = '__jsgoappCapture';
  while (identifiers.has(captureName)) captureName += '_';

  let code = source;
  // Apply insertions backwards so every original syntax range remains valid.
  for (const statement of [...program.body].reverse()) {
    if (statement.type !== 'ExpressionStatement') continue;
    const expression = statement.expression;
    if (expression.type === 'Literal' && expression.value === 'use strict') continue;
    code =
      code.slice(0, expression.start) +
      captureName +
      '(' +
      code.slice(expression.start, expression.end) +
      ')' +
      code.slice(expression.end);
  }
  return { code, captureName };
}
