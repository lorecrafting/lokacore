// Size limits for TypeScript, using the compiler kernel/ts already installs: source files
// (kernel/ts/src, mobile/) at most 300 lines, test files (kernel/ts/test, test dirs under
// mobile/) at most 500, each function in a source file at most 40 lines (first to last
// line). Files named *.gen.* are exempt. A comment line reading `size: allow N, reason` in
// a file's first 5 lines (or right above a function) raises that limit to N, at most 1.5x;
// the marker must be needed. Elixir: bin/check_size.exs.
//
//   node bin/check_ts_size.mjs   (after npm ci in kernel/ts)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ts = createRequire(`${root}kernel/ts/package.json`)('typescript');
const MARKER = /^\s*\/\/ size: allow (\d+)(?:,\s*(\S.*))?/;

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'kernel/ts/src', 'kernel/ts/test', 'mobile'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter((f) => /\.tsx?$/.test(f) && !f.includes('.gen.') && existsSync(root + f));

const report = [];
const check = (rel, text, { what, first, size, limit, ln }) => {
  const m = ln && text[ln - 1].match(MARKER);
  const n = m && Number(m[1]);
  if (m && !m[2]) report.push(`${rel}:${ln}: size marker without a reason`);
  else if (m && size <= limit) report.push(`${rel}:${ln}: size marker not needed (${n}, ${m[2]}), ${size} lines`);
  else if (m && n > limit * 1.5) report.push(`${rel}:${ln}: size marker ${n} over the 1.5x ceiling`);
  else if (m) report.push(`${rel}:${ln}: info: size: allow ${n}, ${m[2]}`), (limit = n);
  if (size > limit) report.push(`${rel}:${first}: ${what}, ${size} lines, limit ${limit}`);
};

for (const rel of files) {
  const src = readFileSync(root + rel, 'utf8');
  const text = src.split('\n');
  const test = rel.startsWith('kernel/ts/test/') || /\/(test|__tests__)\//.test(rel);
  const functions = [];
  if (!test) {
    const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true);
    const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
    const visit = (node) => {
      if (ts.isFunctionLike(node) && node.body) {
        const first = line(node.getStart(sf));
        const name = (node.name ?? node.parent.name)?.getText(sf) ?? '<anonymous>';
        functions.push({ what: `function ${name}`, first, size: line(node.getEnd()) - first + 1, limit: 40, ln: first - 1 });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  const beforeFn = functions.map((f) => f.ln);
  const ln = text.slice(0, 5).findIndex((t, i) => !beforeFn.includes(i + 1) && MARKER.test(t)) + 1;
  const size = text.length - (src.endsWith('\n') ? 1 : 0);
  for (const item of [{ what: 'file', first: 1, size, limit: test ? 500 : 300, ln }, ...functions]) check(rel, text, item);
}

report.forEach((r) => console.log(r));
process.exit(report.every((r) => r.includes(': info: ')) ? 0 : 1);
