/* Accessibility layer for the parts CSS can't reach. Loaded on every page by
   tools/a11y_patch.py, alongside wp-content/a11y.css.

   Both widgets fixed here build their markup in the browser, so the attributes
   have to be set when the nodes appear rather than in the HTML. */
(function () {
  function fix() {
    // Magnific Popup — Divi's "READ FULL BIO" lightbox. Its close control is
    // <button>&times;</button>, so its accessible name is the multiplication
    // sign (WCAG 4.1.2), and the dialog itself has no role.
    document.querySelectorAll('.mfp-close:not([aria-label])').forEach(function (b) {
      b.setAttribute('aria-label', 'Close');
    });
    document.querySelectorAll('.mfp-wrap:not([role])').forEach(function (w) {
      w.setAttribute('role', 'dialog');
      w.setAttribute('aria-modal', 'true');
    });
    // Each bio popup opens with the person's name as its first heading.
    document.querySelectorAll('.mfp-wrap:not([aria-label])').forEach(function (w) {
      var h = w.querySelector('h1, h2, h3, h4, h5, h6');
      if (h && h.textContent.trim()) w.setAttribute('aria-label', h.textContent.trim());
    });

    // Ninja Forms names its role="form" through an aria-labelledby that points
    // at an empty <span>, leaving the landmark unnamed.
    document.querySelectorAll('.nf-form-cont[aria-labelledby]:not([aria-label])').forEach(function (f) {
      var title = document.getElementById(f.getAttribute('aria-labelledby'));
      if (!title || !title.textContent.trim()) f.setAttribute('aria-label', 'Contact form');
    });
  }
  fix();
  new MutationObserver(fix).observe(document.documentElement, { childList: true, subtree: true });
})();
