#!/bin/sh
# Diff-derived mutants (developer.md step 2, reviewer.md step 3): one bin/mutate.sh mutant per change
# on each line <base>...HEAD added to a TS (.ts .tsx .mjs) or Elixir (.ex) source file, run against
# the test files that reach the module one import hop away (TS: a test whose relative import resolves
# to it or to a source importing it; Elixir: an .exs file naming it or a `mix xref callers` caller).
# Prints the mutant count first, then one row per mutant: the result
# (red-narrow = killed, SURVIVED, NO-TESTS when no test imports it, NOT-UNIQUE when the line is not
# unique in its file, BASELINE-RED when the unmutated tests already fail), file:line, the change,
# and the first failing test line of a killed mutant.
# Exits 1 when a row is SURVIVED (NO-TESTS rows are the handback's to explain), else as bin/mutate.sh.
#   bin/mutate_diff.sh <base>
# Mutants: flip ` < `/` <= `, ` > `/` >= `, ` === `/` !== `, ` == `/` != `, ` && `/` || ` (and ` and `/
# ` or ` in Elixir; spaces on both sides), drop a TS `return`/`throw` statement or a one-line guard
# ending in one, negate a block guard (TS `if (...) {`, Elixir `if ... do`), add 1 to the first
# number. Skipped: test, story and *.gen.* files, comment, import and @attribute lines, lines with
# a tab, Elixir lines inside a """ block (docs), and a line carrying `mutate-skip: <reason>` (non-logic).
# ponytail: one hop only; a module tested two hops away reads as NO-TESTS or SURVIVED.
[ $# -eq 1 ] || { echo "usage: $0 <base>" >&2; exit 2; }
here=$(cd "$(dirname "$0")" && pwd)
cd "$(git rev-parse --show-toplevel)" || exit 2
exec python3 -I - "$1" "$here/mutate.sh" <<'PY'
import os, re, shutil, subprocess, sys, tempfile
base, mutate = sys.argv[1], sys.argv[2]
d = subprocess.run(['git', 'diff', '-U0', '--no-color', '--no-renames', '--diff-filter=AM', base + '...HEAD', '--',
                    '*.ts', '*.tsx', '*.mjs', '*.ex'], capture_output=True, text=True)
if d.returncode:
    sys.exit('mutate_diff: ' + d.stderr.strip())
SKIP_FILE = re.compile(r'\.test\.|\.stories\.|\.gen\.|(^|/)test/')
SKIP_LINE = re.compile(r'^\s*(//|/\*|\*|#|@|import\b)|mutate-skip:|\t|^\s*$')
OPS = {' < ': ' <= ', ' <= ': ' < ', ' > ': ' >= ', ' >= ': ' > ', ' === ': ' !== ', ' !== ': ' === ',
       ' == ': ' != ', ' != ': ' == ', ' && ': ' || ', ' || ': ' && '}
EX_OPS = {' and ': ' or ', ' or ': ' and '}
DROP = re.compile(r'^\s*((if \(.*\) )?(return|throw)\b.*;)\s*$')
COND = re.compile(r'^(\s*(?:\} else )?(?:if|while) \()(.*)(\) \{)$|^(\s*(?:if|unless) )(.*)( do)$')  # block guard: negate it
NUM = re.compile(r'(?<![\w.$])\d+(?![\w.])')
def docs(f):  # line numbers inside Elixir """ blocks (moduledoc, doc prose)
    inside, out = False, set()
    for i, line in enumerate(open(f, errors='replace').read().splitlines(), 1):
        if inside:
            out.add(i)
        if line.count('"""') % 2:
            inside = not inside
    return out
rows, f = [], None  # rows: (file, line, old, new, label)
for l in d.stdout.splitlines():
    if l.startswith('+++ '):
        f = l[6:] if l.startswith('+++ b/') and not SKIP_FILE.search(l[6:]) else None
        doc = docs(f) if f and f.endswith('.ex') else set()
    elif l.startswith('@@'):
        n = int(re.match(r'@@ -\S+ \+(\d+)', l).group(1))
    elif l.startswith('+') and f:
        t, n = l[1:], n + 1
        if SKIP_LINE.search(t) or n - 1 in doc:
            continue
        ops = dict(OPS, **EX_OPS) if f.endswith('.ex') else OPS
        for op, rep in ops.items():
            ms = list(re.finditer(re.escape(op), t))
            for k, m in enumerate(ms):
                rows.append((f, n - 1, t, t[:m.start()] + rep + t[m.end():],
                             op.strip() + ' -> ' + rep.strip() + (' #%d' % (k + 1) if len(ms) > 1 else '')))
        if not f.endswith('.ex') and DROP.match(t):
            rows.append((f, n - 1, t, '', 'drop ' + DROP.match(t).group(1)[:40]))
        c = COND.match(t)
        if c:
            a, cond, z = (c.group(1), c.group(2), c.group(3)) if c.group(1) else (c.group(4), c.group(5), c.group(6))
            rows.append((f, n - 1, t, a + '!(' + cond + ')' + z, 'negate ' + cond[:40]))
        m = NUM.search(t)
        if m and t[:m.start()].count("'") % 2 == 0 and t[:m.start()].count('"') % 2 == 0:
            rows.append((f, n - 1, t, t[:m.start()] + str(int(m.group()) + 1) + t[m.end():], m.group() + ' -> ' + str(int(m.group()) + 1)))

tests = subprocess.run(['git', 'ls-files', '*.test.ts', '*.test.tsx', '*.test.mjs', '*_test.exs'],
                       capture_output=True, text=True).stdout.split()
tests = [t for t in tests if os.path.exists(t)]
text = {t: open(t, errors='replace').read() for t in tests}
sources = [s for s in subprocess.run(['git', 'ls-files', '*.ts', '*.tsx', '*.mjs'], capture_output=True,
                                     text=True).stdout.split() if not SKIP_FILE.search(s)]
SPEC = re.compile(r"""(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]""")
def home(path, marker):  # nearest directory holding marker (package.json, mix.exs)
    p = os.path.dirname(path)
    while p and not os.path.exists(os.path.join(p, marker)):
        p = os.path.dirname(p)
    return p or '.'
def imports(path, stem):  # path has a relative import resolving to stem (or stem/index)
    if path not in text:
        text[path] = open(path, errors='replace').read()
    for s in SPEC.findall(text[path]):
        p = re.sub(r'\.(ts|tsx|mjs|js)$', '', os.path.normpath(os.path.join(os.path.dirname(path), s)))
        if stem in (p, p + '/index'):
            return True
def modules(path):
    return re.findall(r'defmodule\s+([\w.]+)', open(path, errors='replace').read())
cmds = {}
def narrow(mod, log):
    if mod not in cmds:
        if mod.endswith('.ex'):
            root, names = home(mod, 'mix.exs'), modules(mod)
            for name in modules(mod):
                x = subprocess.run(['sh', '-c', 'nice -n 10 mise exec -- mix xref callers ' + name], cwd=root,
                                   capture_output=True, text=True).stdout
                for c in re.findall(r'^(\S+\.exs?) \(', x, re.M):
                    names += modules(os.path.join(root, c))
            hit = [t for t in tests if t.endswith('.exs') and any(re.search(r'\b%s\b' % re.escape(n), text[t]) for n in names)]
            cmds[mod] = ' '.join(['nice -n 10 mise exec -- mix test --force'] + hit) if hit else ''
        else:
            stems = [os.path.splitext(mod)[0]]
            stems += [os.path.splitext(s)[0] for s in sources if imports(s, stems[0])]
            hit = [t for t in tests if not t.endswith('.exs') and any(imports(t, s) for s in stems)]
            pkgs = {}
            for t in hit:
                pkgs.setdefault(home(t, 'package.json'), []).append(t)
            cmds[mod] = ' && '.join('(cd %s && nice -n 10 node --test --test-reporter=tap %s)' % (p, ' '.join(os.path.relpath(t, p) for t in ts)) for p, ts in pkgs.items())
    return '{ %s; } > %s 2>&1' % (cmds[mod], log) if cmds[mod] else ''

tmp = tempfile.mkdtemp()
lst, plan, base_red = open(os.path.join(tmp, 'list'), 'w'), [], {}
for i, (f, n, old, new, label) in enumerate(rows):
    if open(f).read().count(old) != 1:
        plan.append(('NOT-UNIQUE', f, n, label, None))
        continue
    log = os.path.join(tmp, '%d.out' % i)
    cmd = narrow(f, log)
    if cmd and f not in base_red:  # an unmutated red run would make every mutant look killed
        base_red[f] = subprocess.run(['sh', '-c', narrow(f, os.devnull)]).returncode != 0
    kind = 'BASELINE-RED' if cmd and base_red[f] else None if cmd else 'NO-TESTS'
    plan.append((kind, f, n, label, log))
    if kind is None:
        lst.write('\t'.join((f, old, new, cmd)) + '\n')
lst.close()
print('mutate_diff: %d mutants from %s...HEAD (%d run)' % (len(plan), base, sum(1 for p in plan if p[0] is None)), flush=True)
r = subprocess.run(['sh', mutate, lst.name, 'true'], capture_output=True, text=True)
res = [l.split('\t')[0] for l in r.stdout.splitlines()]
def first_fail(log):
    s = open(log, errors='replace').read() if os.path.exists(log) else ''
    for pat in (r'SyntaxError[^\n]*', r'\(CompileError\)[^\n]*', r'^\s*\d+\) test [^\n]*\n\s*\S+:\d+', r'^\s*not ok \d+ - [^\n]*'):
        m = re.search(pat, s, re.M)
        if m:
            return ' '.join(m.group(0).split())
    return '-'
count = {}
for kind, f, n, label, log in plan:
    if kind is None:
        kind = res.pop(0) if res else 'NOT-RUN'
    count[kind] = count.get(kind, 0) + 1
    print('%s\t%s:%d\t%s\t%s' % (kind, f, n, label, first_fail(log) if kind.startswith('red') else '-'))
print('mutate_diff: ' + ', '.join('%s %d' % kv for kv in sorted(count.items())))
sys.stderr.write(r.stderr)
shutil.rmtree(tmp)
sys.exit(r.returncode or (1 if 'SURVIVED' in count else 0))
PY
