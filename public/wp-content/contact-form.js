/* Submits the contact form to the Worker without leaving the page.
   Validation is the browser's — the fields are `required` and `type=email`, so
   this only runs once the form is already valid. Errors and the success notice
   land in live regions the form already carries. */
document.addEventListener('submit', function (event) {
  var form = event.target.closest('#contact-form');
  if (!form) return;
  event.preventDefault();

  var status = form.querySelector('.nf-response-msg');
  var errors = form.querySelector('.nf-form-errors');
  var button = form.querySelector('input[type="submit"]');
  var label = button.value;

  status.textContent = '';
  errors.textContent = '';
  button.disabled = true;
  button.value = 'Sending…';

  fetch(form.action, {
    method: 'POST',
    body: new FormData(form),
    headers: { accept: 'application/json' }
  }).then(function (response) {
    return response.json().catch(function () { return {}; }).then(function (data) {
      if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      form.reset();
      status.textContent = 'Thanks — your message is on its way. We will be in touch shortly.';
    });
  }).catch(function (error) {
    errors.textContent = error.message || 'Something went wrong. Please try again.';
  }).finally(function () {
    button.disabled = false;
    button.value = label;
  });
});
