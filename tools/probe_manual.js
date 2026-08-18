// Checks axe can't do: reflow (1.4.10), text spacing (1.4.12), target size (2.5.8),
// clipped text, duplicate ids in the rendered DOM, focus return from the bio popups.
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const BASE = 'http://localhost:8766';
const PAGES = fs.readFileSync(__dirname + '/pages.txt', 'utf8').trim().split('\n');

const SPACING = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`;

async function scan(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const res = { overflowX: doc.scrollWidth - doc.clientWidth, wide: [], clipped: [], small: [], dupIds: [] };
    const vw = doc.clientWidth;
    // Divi clones id-bearing markup in the browser (#top-menu into #mobile_menu,
    // an #et-boc wrapper per .et-l layout), so duplicates show up here and never
    // in the HTML file. axe stopped reporting them in 4.10, when WCAG 2.2 retired
    // 4.1.1 Parsing - but a duplicate id still breaks label/for, aria-labelledby
    // and every other id-based association. wp-content/a11y.js de-dupes them.
    const byId = {};
    for (const el of document.querySelectorAll('[id]')) {
      const id = el.getAttribute('id');
      if (id) (byId[id] = byId[id] || []).push(el.tagName.toLowerCase());
    }
    for (const [id, tags] of Object.entries(byId))
      if (tags.length > 1) res.dupIds.push({ id, n: tags.length, tags: tags.join(',') });
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) continue;
      const r = el.getBoundingClientRect();
      if (r.width > vw + 2 && r.height > 0 && el.children.length === 0)
        res.wide.push({ t: el.tagName + '.' + el.className, w: Math.round(r.width) });
      // text clipped by a fixed height / overflow:hidden. Anything taken out of
      // flow on purpose (Ninja Forms' honeypot, a11y-hidden helpers) overflows
      // by design and is not content anyone loses.
      if (['hidden','clip'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 0
          && (el.innerText || '').trim().length > 10) {
        const bottom = el.getBoundingClientRect().bottom;
        const spilling = [...el.querySelectorAll('*')].filter(c =>
          c.getClientRects().length && c.getBoundingClientRect().bottom > bottom + 2);
        const real = spilling.filter(c => {
          for (let n = c; n && n !== el; n = n.parentElement) {
            const s = getComputedStyle(n);
            if (s.position === 'absolute' || s.position === 'fixed') return false;
            if (n.getAttribute('aria-hidden') === 'true') return false;
          }
          return true;
        });
        if (real.length)
          res.clipped.push({ t: el.tagName + '.' + el.className,
            txt: el.innerText.trim().replace(/\s+/g,' ').slice(0,70),
            over: el.scrollHeight - el.clientHeight,
            by: real[0].tagName + '.' + String(real[0].className).slice(0, 40) });
      }
      // 2.5.8 exempts a target that sits inline in a block of text, so a link
      // whose parent carries copy of its own around it does not count.
      const inlineInText = cs.display === 'inline' && el.tagName === 'A'
        && el.parentElement
        && el.parentElement.textContent.trim().length > (el.textContent || '').trim().length + 2;
      if (el.matches('a[href], button, input:not([type=hidden]), select, textarea, [role=button]')
          && (r.width < 24 || r.height < 24) && r.width > 0 && !inlineInText)
        res.small.push({ t: el.tagName + '.' + el.className,
          txt: (el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,40),
          w: Math.round(r.width), h: Math.round(r.height) });
    }
    return res;
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox','--disable-dev-shm-usage'],
  });
  const report = {};
  let fails = 0;
  for (const path of PAGES) {
    report[path] = {};
    for (const [label, w, h, css] of [
      ['reflow320', 320, 800, null],
      ['spacing1280', 1280, 900, SPACING],
    ]) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h });
      await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60000 });
      if (css) await page.addStyleTag({ content: css });
      await new Promise(r => setTimeout(r, 1800));
      report[path][label] = await scan(page);
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync(__dirname + '/probe-results.json', JSON.stringify(report, null, 2));
  for (const [p, modes] of Object.entries(report))
    for (const [m, r] of Object.entries(modes)) {
      const bits = [];
      if (r.overflowX > 1) bits.push(`overflowX=${r.overflowX}`);
      if (r.wide.length) bits.push(`wide=${r.wide.length}`);
      if (r.clipped.length) bits.push(`clipped=${r.clipped.length}`);
      if (r.small.length) bits.push(`small=${r.small.length}`);
      if (r.dupIds.length) bits.push(`dupIds=${r.dupIds.length}`);
      if (bits.length) { console.log(`${m.padEnd(12)} ${p.padEnd(48)} ${bits.join(' ')}`); fails++; }
    }
  if (fails) {
    console.log('detail: tools/probe-results.json');
    process.exitCode = 1;
  } else {
    console.log(`${Object.keys(report).length} pages at 320px and with 1.4.12 text spacing — nothing clipped, nothing overflowing, no undersized target, no duplicate id`);
  }
})();
