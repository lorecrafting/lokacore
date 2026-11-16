// Every route the author server answers (write.ts, editing.ts, live.ts) has a caller in the panel
// (tools/author-panel/src) or the Book (mobile/app/author), or an exemption with its reason.
// Routes and calls are read from the sources' syntax trees, so a new route or a dropped call shows.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { REPO } from '../play/guard.ts';

// Each route the servers name, with the methods they answer it on (the source has no method table:
// write.ts get() is GET, POSTS and /hold are POST, live.ts checks request.method by hand).
const ROUTES: Record<string, string[]> = {
  '/source': ['GET'],
  '/schema/*': ['GET'],
  '/line': ['GET'],
  '/world': ['GET', 'POST'],
  '/templates': ['GET'],
  '/journal': ['GET'],
  '/change': ['POST'],
  '/edit': ['POST'],
  '/set': ['POST'],
  '/delete': ['POST'],
  '/move': ['POST'],
  '/undo': ['POST'],
  '/new': ['POST'],
  '/hold': ['POST'],
  '/checkpoints': ['GET'],
  '/checkpoints/*': ['GET', 'PUT'],
  '/todo': ['GET'],
  '/numbers': ['GET'],
  '/fights': ['GET'],
  '/find': ['GET'],
  '/open': ['POST'],
  '/restructure': ['POST'],
  '/why': ['POST'],
  '/story': ['GET'],
  '/events': ['GET'],
};
// Routes no client calls, each with why.
const UNCALLED: Record<string, string> = {
  'GET /journal':
    'test-only: write.test.ts reads the undo journal; the cards keep their own undo id',
};

const parsed = (file: string) =>
  ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const visit = (node: ts.Node, f: (n: ts.Node) => void) => {
  f(node);
  node.forEachChild((c) => visit(c, f));
};
/** A string or template's text with each `${}` as `*`, past `/__author`, before any `?`. */
const pathOf = (n: ts.Node | undefined) => {
  const text = !n
    ? undefined
    : ts.isStringLiteralLike(n)
      ? n.text
      : ts.isTemplateExpression(n)
        ? n.head.text + n.templateSpans.map((s) => `*${s.literal.text}`).join('')
        : undefined;
  return text?.replace(/^\/__author/, '').split('?')[0];
};

test('the server routes read from source are the route table', () => {
  // Breaks: a route added to (or renamed in) a server with no row here, so no caller is required.
  const found = new Set<string>();
  for (const f of ['write.ts', 'editing.ts', 'live.ts'])
    visit(parsed(join(REPO, 'kernel/ts/play', f)), (n) => {
      if (ts.isBinaryExpression(n) && /^[!=]==$/.test(n.operatorToken.getText()))
        found.add(pathOf(n.right) ?? '');
      if (ts.isCallExpression(n) && n.expression.getText().endsWith('.startsWith'))
        found.add(pathOf(n.arguments[0]) ?? '');
      if (ts.isVariableDeclaration(n) && n.name.getText() === 'POSTS')
        for (const p of (n.initializer as ts.ObjectLiteralExpression).properties)
          found.add(pathOf(p.name) ?? '');
      const route = ts.isRegularExpressionLiteral(n) && /^\/\^\\\/([a-z]+)\\\//.exec(n.text)?.[1];
      if (route) found.add(`/${route}/*`);
    });
  assert.deepEqual([...found].filter((p) => p.startsWith('/')).sort(), Object.keys(ROUTES).sort());
});

test('every server route has a client caller or an exemption', () => {
  // Breaks: a client call dropped or renamed (the route then has no way in from the editor).
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? files(join(dir, e.name))
        : /\.tsx?$/.test(e.name) && !/\.(test|stories)\./.test(e.name)
          ? [join(dir, e.name)]
          : [],
    );
  const called = new Set<string>();
  const unread: string[] = []; // fetch calls whose method is not a literal
  for (const f of [
    ...files(join(REPO, 'tools/author-panel/src')),
    ...files(join(REPO, 'mobile/app/author')),
  ])
    visit(parsed(f), (n) => {
      if (!ts.isCallExpression(n) && !ts.isNewExpression(n)) return;
      const name = n.expression.getText().split('.').at(-1);
      const [first, second] = n.arguments ?? [];
      const path = pathOf(first);
      if (path === undefined) return;
      // ask (author.ts) and the cards' and map's post/call wrappers over it take a bare route name
      if (['ask', 'post', 'call'].includes(name!) && !path.startsWith('/'))
        called.add(`POST /${path}`);
      if (name === 'report' && !path.startsWith('/')) called.add(`GET /${path}`); // author.ts reports
      if (name === 'api') called.add(`${second ? 'POST' : 'GET'} ${path}`); // inbook.ts
      if (name === 'sendBeacon') called.add(`POST ${path}`);
      if (name === 'EventSource') called.add(`GET ${path}`);
      if (name === 'fetch') {
        // GET only with no init or an init literal with no method and no spread; else the method as written
        const props =
          second && ts.isObjectLiteralExpression(second) ? second.properties : undefined;
        const method = props?.find(
          (p) => ts.isSpreadAssignment(p) || p.name?.getText() === 'method',
        );
        const m = !second
          ? 'GET'
          : !props
            ? undefined
            : !method
              ? 'GET'
              : ts.isPropertyAssignment(method)
                ? pathOf(method.initializer)
                : undefined;
        if (m) called.add(`${m} ${path}`);
        // a wrapper's own fetch (path `*`): its callers are read above (inbook.ts api)
        else if (path !== '*')
          unread.push(
            `${f.slice(REPO.length + 1)}:${n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1} fetch ${path}`,
          );
      }
    });
  const uncalled = Object.entries(ROUTES)
    .flatMap(([path, methods]) => methods.map((m) => `${m} ${path}`))
    .filter((r) => !called.has(r) && !(r in UNCALLED));
  assert.deepEqual(uncalled, [], 'routes no client calls');
  assert.deepEqual(unread, [], 'fetch calls with a method this scan cannot read');
});
