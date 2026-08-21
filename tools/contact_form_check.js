// End-to-end check for the contact form: the browser fills it in, the Worker
// handles the POST, and the page shows the right notice. Run the Worker first:
//
//   npx wrangler dev --port 8787
//   node tools/contact_form_check.js
//
// The Worker's own paths (validation, honeypot, header injection) are covered by
// curl in the README; this covers the half only a browser can exercise.
const assert = require('assert');
const puppeteer = require('puppeteer-core');

const BASE = process.env.BASE || 'http://localhost:8787';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const fill = {
  '#nf-field-1': 'Test Person',
  '#nf-field-2': 'test@example.com',
  '#nf-field-5': '865-555-1212',
  '#nf-field-6': 'BlueCross',
  '#nf-field-3': 'This is an end-to-end test of the contact form.',
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.goto(BASE + '/contacts/', { waitUntil: 'networkidle2' });

  // Required fields are the browser's job — an empty form must not reach the Worker.
  let posted = false;
  page.on('request', (r) => { if (r.url().endsWith('/api/contact')) posted = true; });
  await page.click('#nf-field-4');
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(posted, false, 'empty form was submitted');
  assert.strictEqual(
    await page.$eval('#nf-field-1', (el) => el.validity.valueMissing), true,
    'name field is not required');

  // The success path.
  for (const [selector, value] of Object.entries(fill)) await page.type(selector, value);
  await page.click('#nf-field-4');
  await page.waitForFunction(
    () => document.querySelector('#contact-form .nf-response-msg').textContent.trim() !== '',
    { timeout: 5000 });
  const notice = await page.$eval('#contact-form .nf-response-msg', (el) => el.textContent);
  assert.match(notice, /on its way/i, `unexpected notice: ${notice}`);
  assert.strictEqual(await page.$eval('#nf-field-3', (el) => el.value), '', 'form was not reset');
  assert.strictEqual(
    await page.$eval('#nf-field-4', (el) => el.disabled), false, 'submit left disabled');

  // The error path — drop the browser's validation so a rejected address reaches
  // the Worker, and check its message is what the visitor sees.
  await page.$eval('#contact-form', (form) => form.setAttribute('novalidate', ''));
  await page.type('#nf-field-1', 'Test Person');
  await page.type('#nf-field-2', 'not-an-address');
  await page.type('#nf-field-3', 'Hello.');
  await page.click('#nf-field-4');
  await page.waitForFunction(
    () => document.querySelector('#contact-form .nf-form-errors').textContent.trim() !== '',
    { timeout: 5000 });
  const error = await page.$eval('#contact-form .nf-form-errors', (el) => el.textContent);
  assert.match(error, /valid email address/i, `unexpected error: ${error}`);

  await browser.close();
  console.log('contact form: submit, reset, validation and error paths all pass');
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
