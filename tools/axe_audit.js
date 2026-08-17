// WCAG audit: axe-core over every mirrored page, desktop + mobile viewport.
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const AXE = fs.readFileSync(__dirname + '/axe.min.js', 'utf8');
const BASE = 'http://localhost:8766';
const PAGES = fs.readFileSync(__dirname + '/pages.txt', 'utf8').trim().split('\n')
  .map(u => BASE + u);
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const out = [];
  for (const [w, h, label] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
    for (const url of PAGES) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h });
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      } catch (e) {
        console.error('nav fail', url, e.message);
      }
      await new Promise(r => setTimeout(r, 1500));
      await page.evaluate(AXE);
      const res = await page.evaluate(async (tags) =>
        await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] }),
        TAGS);
      out.push({
        url, viewport: label,
        violations: res.violations.map(v => ({
          id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
          tags: v.tags.filter(t => t.startsWith('wcag') || t === 'best-practice'),
          count: v.nodes.length,
          samples: v.nodes.slice(0, 3).map(n => ({
            target: n.target.join(' '),
            html: (n.html || '').slice(0, 240),
            msg: (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 300),
          })),
        })),
      });
      if (res.violations.length) console.error(label, url, res.violations.length, 'rule violations');
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync(__dirname + '/axe-results.json', JSON.stringify(out, null, 2));

  const nodes = out.reduce((n, p) => n + p.violations.reduce((m, v) => m + v.count, 0), 0);
  const rules = out.reduce((n, p) => n + p.violations.length, 0);
  console.log(`${out.length} page/viewport runs — ${rules} rule violations, ${nodes} elements`);
  if (!rules) {
    console.log('all clear');
    return;
  }
  const by = {};
  for (const p of out) for (const v of p.violations) (by[v.id] ??= { n: 0, impact: v.impact }).n += v.count;
  for (const [id, v] of Object.entries(by).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${String(v.n).padStart(4)}  ${id} [${v.impact}]`);
  }
  console.log('detail: tools/axe-results.json');
  process.exitCode = 1;
})();
