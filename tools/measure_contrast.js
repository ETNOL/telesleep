// Measure real rendered contrast for text sitting on background images.
//
// axe can only read a computed background-color; when a photo or gradient sits
// behind the text it returns "incomplete" and moves on. This hides the text,
// screenshots the pixels actually behind it, and computes the worst-case ratio
// against the text color — so the image-backed sections get a real verdict.
//
//   node tools/measure_contrast.js [baseUrl]
//
// Exits non-zero if any sampled text falls below its WCAG AA threshold.
const fs = require('fs');
const path = require('path');
const { PNG } = require(path.join(__dirname, 'node_modules', 'pngjs'));
const puppeteer = require(path.join(__dirname, 'node_modules', 'puppeteer-core'));

const BASE = process.argv[2] || 'http://localhost:8766';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGES = fs.readFileSync(path.join(__dirname, 'pages.txt'), 'utf8').trim().split('\n');

// Ignore near-transparent antialiasing fringes when finding the worst pixel.
const PERCENTILE = 0.02;

const lin = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  });
  const failures = [];
  let checked = 0;

  for (const page of PAGES) {
    const url = BASE + page;
    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    try { await p.goto(url, { waitUntil: 'networkidle2', timeout: 45000 }); }
    catch (e) { console.error('nav fail', url, e.message); }
    // Divi reveals sections on scroll; unrevealed text measures as invisible.
    await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 1000));

    // Every text node whose backdrop includes an image or gradient.
    const targets = await p.evaluate(() => {
      const hasImage = el => {
        for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
          const c = getComputedStyle(e);
          if (c.backgroundImage && c.backgroundImage !== 'none') return true;
          if (c.backgroundColor && !/rgba\(0, 0, 0, 0\)/.test(c.backgroundColor)) return false;
        }
        return false;
      };
      const out = [];
      document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span,li,label').forEach((el, i) => {
        const txt = (el.innerText || '').trim();
        if (!txt || txt.length > 200) return;
        if (el.querySelector('h1,h2,h3,h4,h5,h6,p,a,li')) return;
        const r = el.getBoundingClientRect();
        const c = getComputedStyle(el);
        if (r.width < 8 || r.height < 8) return;
        if (c.visibility === 'hidden' || c.display === 'none' || +c.opacity === 0) return;
        if (!hasImage(el)) return;
        el.setAttribute('data-mc', String(i));
        const size = parseFloat(c.fontSize);
        const weight = +c.fontWeight || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        out.push({
          id: String(i), text: txt.slice(0, 60), color: c.color, large,
          rect: { x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height },
        });
      });
      return out;
    });

    for (const t of targets) {
      // Hide just this element's glyphs; everything behind it stays put.
      await p.evaluate(id => {
        const el = document.querySelector(`[data-mc="${id}"]`);
        if (el) el.style.setProperty('color', 'transparent', 'important');
      }, t.id);

      const clip = {
        x: Math.max(0, Math.floor(t.rect.x)), y: Math.max(0, Math.floor(t.rect.y)),
        width: Math.max(1, Math.ceil(t.rect.w)), height: Math.max(1, Math.ceil(t.rect.h)),
      };
      let buf;
      try { buf = await p.screenshot({ clip, captureBeyondViewport: true }); }
      catch (e) { continue; }

      await p.evaluate(id => {
        const el = document.querySelector(`[data-mc="${id}"]`);
        if (el) el.style.removeProperty('color');
      }, t.id);

      const png = PNG.sync.read(Buffer.from(buf));  // puppeteer 23 hands back a Uint8Array
      const lums = [];
      for (let i = 0; i < png.data.length; i += 4) {
        if (png.data[i + 3] < 200) continue;
        lums.push(lum(png.data[i], png.data[i + 1], png.data[i + 2]));
      }
      if (!lums.length) continue;
      lums.sort((a, b) => a - b);

      const m = t.color.match(/(\d+),\s*(\d+),\s*(\d+)/);
      if (!m) continue;
      const fg = lum(+m[1], +m[2], +m[3]);
      // Worst case is the background pixel closest in luminance to the text.
      const lo = lums[Math.floor(lums.length * PERCENTILE)];
      const hi = lums[Math.floor(lums.length * (1 - PERCENTILE))];
      const worst = fg > (lo + hi) / 2 ? Math.min(ratio(fg, hi), ratio(fg, lo)) : Math.min(ratio(fg, lo), ratio(fg, hi));
      const need = t.large ? 3.0 : 4.5;
      checked++;
      if (worst < need) {
        failures.push({ page, text: t.text, color: t.color, worst: worst.toFixed(2), need });
      }
    }
    await p.close();
  }
  await browser.close();

  console.log(`measured ${checked} image-backed text elements across ${PAGES.length} pages`);
  if (!failures.length) {
    console.log('all clear — every one meets its WCAG AA threshold');
    return;
  }
  console.log(`\n${failures.length} below threshold:`);
  for (const f of failures) {
    console.log(`  ${f.worst}:1 (need ${f.need})  ${f.page}  "${f.text}"  color=${f.color}`);
  }
  process.exitCode = 1;
})();
