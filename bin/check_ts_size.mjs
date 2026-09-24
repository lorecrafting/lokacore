// Size limits for TypeScript (.ts/.tsx/.mts/.cts) and .mjs, using the compiler kernel/ts
// already installs. Same rules as bin/check_size.exs: source files at most 300 lines, test
// files 500, each function in a source file 40; the same test-file rule and
// `// size: allow N, reason` markers (lines 1-5 for the file, the line right above a
// function after line 5).
//
//   node bin/check_ts_size.mjs [path ...]   (after npm ci in kernel/ts)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ts = createRequire(`${root}kernel/ts/package.json`)('typescript');
const TEST = /^(test|kernel\/ts\/test)\/|(^|\/)__tests__\/|(_test\.exs|\.(test|spec)\.([cm]?ts|tsx|mjs))$/;

const args = process.argv.slice(2);
const candidates = args.length
  ? args
  : execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0');
const files = candidates.filter(
  (f) =>
    /\.([cm]?ts|tsx|mjs)$/.test(f) &&
    !f.split('/').pop().includes('.gen.') &&
    existsSync(root + f),
);

const functions = (rel, src) => {
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true);
  const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const found = [];
  const visit = (node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const first = line(node.getStart(sf));
      const name = (node.name ?? node.parent.name)?.getText(sf) ?? '<anonymous>';
      found.push({ what: `function ${name}`, first, size: line(node.getEnd()) - first + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
};

const report = [];
const check = (rel, text, { what, first, size, limit, ln }) => {
  const m = ln && text[ln - 1].match(/^\s*\/\/ size: allow (\d+),\s*(\S.*)/);
  const n = m && Number(m[1]);
  if (ln && !m) report.push(`${rel}:${ln}: size marker needs N and a reason`);
  else if (m && size <= limit) report.push(`${rel}:${ln}: size marker not needed, ${size} lines`);
  else if (m && n > limit * 1.5) report.push(`${rel}:${ln}: size marker ${n} over 1.5x`);
  else if (m) report.push(`${rel}:${ln}: info: size: allow ${n}, ${m[2]}`), (limit = n);
  if (size > limit) report.push(`${rel}:${first}: ${what}, ${size} lines, limit ${limit}`);
};

for (const rel of files) {
  const src = readFileSync(root + rel, 'utf8');
  const text = src.split('\n');
  const test = TEST.test(rel);
  const marked = text.flatMap((t, i) => (/^\s*\/\/ size: allow/.test(t) ? [i + 1] : []));
  const fileLn = marked.find((i) => i <= 5);
  const fns = (test ? [] : functions(rel, src)).map((f) => {
    const ln = f.first - 1 > 5 && marked.includes(f.first - 1) && f.first - 1;
    return { ...f, limit: 40, ln };
  });
  const size = text.length - (src.endsWith('\n') ? 1 : 0);
  [{ what: 'file', first: 1, size, limit: test ? 500 : 300, ln: fileLn }, ...fns].forEach((f) => check(rel, text, f));
  const consumed = [fileLn, ...fns.map((f) => f.ln)];
  for (const i of marked.filter((i) => !consumed.includes(i))) {
    report.push(`${rel}:${i}: size marker not attached to a file header or function`);
  }
}

report.forEach((r) => console.log(r));
process.exit(report.every((r) => r.includes(': info: ')) ? 0 : 1);
