export function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function makeErrorEl(drugName, message, onRetry = null) {
  const div = document.createElement('div');
  div.className = 'error-card';
  div.innerHTML = `<span>Could not load data for <strong>${escHtml(drugName)}</strong>: ${escHtml(message)}</span>`;
  if (onRetry) {
    const btn = document.createElement('button');
    btn.className = 'retry-btn';
    btn.textContent = 'Retry';
    btn.addEventListener('click', onRetry);
    div.appendChild(btn);
  }
  return div;
}
