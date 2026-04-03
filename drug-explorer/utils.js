export function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function makeErrorEl(drugName, message) {
  const div = document.createElement('div');
  div.className = 'error-card';
  div.innerHTML = `<span>Could not load data for <strong>${escHtml(drugName)}</strong>: ${escHtml(message)}</span>`;
  return div;
}
