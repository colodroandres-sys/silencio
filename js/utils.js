function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function showCharError(el, msg) {
  const id = el.id + '-char-error';
  let err = document.getElementById(id);
  if (!err) {
    err = document.createElement('p');
    err.id = id;
    err.style.cssText = 'color:#f87171;font-size:0.78rem;margin-top:6px;';
    el.parentNode.insertBefore(err, el.nextSibling);
  }
  err.textContent = msg;
  shake(el);
  setTimeout(() => { if (err.parentNode) err.parentNode.removeChild(err); }, 4000);
}

function shake(el) {
  if (!el) return;
  if (shakeInterval) { clearInterval(shakeInterval); shakeInterval = null; }
  el.style.borderColor = 'rgba(157, 98, 248, 0.6)';
  let n = 0;
  shakeInterval = setInterval(() => {
    el.style.transform = n % 2 === 0 ? 'translateX(-5px)' : 'translateX(5px)';
    n++;
    if (n >= 6) {
      clearInterval(shakeInterval);
      shakeInterval = null;
      el.style.transform = 'translateX(0)';
      setTimeout(() => { el.style.borderColor = ''; }, 800);
    }
  }, 55);
  el.focus();
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
