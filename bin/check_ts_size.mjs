// Size limits for TypeScript, using the compiler kernel/ts already installs: source files
// (kernel/ts/src, mobile/) at most 300 lines, test files (kernel/ts/test, test dirs under
// mobile/) at most 500, each function in a source file at most 40 lines (first to last
// line). Files named *.gen.* are exempt. Elixir: bin/check_size.exs.
//
//   node bin/check_ts_size.mjs   (after npm ci in kernel/ts)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ts = createRequire(`${root}kernel/ts/package.json`)('typescript');

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'kernel/ts/src', 'kernel/ts/test', 'mobile'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter((f) => /\.tsx?$/.test(f) && !f.includes('.gen.') && existsSync(root + f));

const violations = [];
for (const rel of files) {
  const src = readFileSync(root + rel, 'utf8');
  const test = rel.startsWith('kernel/ts/test/') || /\/(test|__tests__)\//.test(rel);
  const limit = test ? 500 : 300;
  const lines = src.split('\n').length - (src.endsWith('\n') ? 1 : 0);
  if (lines > limit) violations.push(`${rel}:1: file, ${lines} lines, limit ${limit}`);
  if (test) continue;

  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true);
  const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const visit = (node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const first = line(node.getStart(sf));
      const n = line(node.getEnd()) - first + 1;
      const name = (node.name ?? node.parent.name)?.getText(sf) ?? '<anonymous>';
      if (n > 40) violations.push(`${rel}:${first}: function ${name}, ${n} lines, limit 40`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

violations.forEach((v) => console.log(v));
process.exit(violations.length ? 1 : 0);
