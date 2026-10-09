// Builds .walkthrough/contact-sheet.html from the routes chapter1.walk.ts logged: one section per
// route, every page in order, the screenshots inlined so the file stands alone. Click to enlarge.
const fs = require('node:fs');
const path = require('node:path');

const out = path.join(__dirname, '../.walkthrough');
// A run that failed before any route started leaves an empty sheet, not a stack trace.
const list = (dir, options) => (fs.existsSync(dir) ? fs.readdirSync(dir, options) : []);
const shots = new Map(
  list(path.join(out, 'artifacts'), { recursive: true })
    .filter((f) => f.endsWith('.png'))
    .map((f) => [path.basename(f), path.join(out, 'artifacts', f)]),
);
const escape = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

const routes = list(path.join(out, 'steps'))
  .sort()
  .map((file) => JSON.parse(fs.readFileSync(path.join(out, 'steps', file), 'utf8')));
const sections = routes.map(({ title, steps }) => {
  const figures = steps.map((step, i) => {
    const file = shots.get(path.basename(step.shot));
    const src = file ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}` : '';
    const dead = step.action.startsWith('Dead end') ? ' class="dead"' : '';
    return `<figure${dead}><img src="${src}" alt="${escape(step.action)}"><figcaption><b>${i + 1}</b> ${escape(step.action)}<br><i>${escape(step.title)}</i><br>${escape(step.time)}</figcaption></figure>`;
  });
  return `<h2>${escape(title)} <small>(${steps.length} pages)</small></h2>\n<div class="grid">${figures.join('\n')}</div>`;
});

const html = `<!doctype html><meta charset="utf-8"><title>Chapter 1 walkthrough</title>
<style>
body{font:13px system-ui;margin:16px;background:#f4f1ea;color:#222}
.grid{display:flex;flex-wrap:wrap;gap:10px}
figure{margin:0;width:150px}figure img{width:150px;border:1px solid #999;cursor:zoom-in;background:#ccc;min-height:60px}
figcaption{line-height:1.3}.dead img{outline:4px solid #c00}.dead figcaption{color:#c00}
#zoom{position:fixed;inset:0;background:#000c;display:none;justify-content:center;align-items:center;cursor:zoom-out}
#zoom img{max-height:96vh}
</style>
<h1>Chapter 1 walkthrough</h1>
<p>Generated ${new Date().toISOString()} by <code>npm run walkthrough</code>. Each screenshot is the page the step's action was taken on.</p>
${sections.join('\n')}
<div id="zoom" onclick="this.style.display='none'"><img></div>
<script>document.querySelectorAll('figure img').forEach(i=>i.onclick=()=>{const z=document.getElementById('zoom');z.firstChild.src=i.src;z.style.display='flex'})</script>
`;
fs.writeFileSync(path.join(out, 'contact-sheet.html'), html);
console.log(
  `contact sheet: mobile/app/.walkthrough/contact-sheet.html (${routes.length} routes, ${routes.reduce((n, r) => n + r.steps.length, 0)} pages)`,
);
