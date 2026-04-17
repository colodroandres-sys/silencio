function profilePillSelect(groupId, btn) {
  document.querySelectorAll(`#${groupId} .profile-pill`).forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  checkProfileComplete();
}

function checkProfileComplete() {
  const goal      = document.querySelector('#profile-goal .profile-pill.active');
  const frequency = document.querySelector('#profile-frequency .profile-pill.active');
  const timing    = document.querySelector('#profile-timing .profile-pill.active');
  const btn       = document.getElementById('btn-profile-submit');
  if (btn) btn.disabled = !(goal && frequency && timing);
}

async function submitProfile() {
  const goal      = document.querySelector('#profile-goal .profile-pill.active')?.dataset.value;
  const frequency = document.querySelector('#profile-frequency .profile-pill.active')?.dataset.value;
  const timing    = document.querySelector('#profile-timing .profile-pill.active')?.dataset.value;
  if (!goal || !frequency || !timing) return;

  const btn = document.getElementById('btn-profile-submit');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const token = await getAuthToken();
    const res = await fetch('/api/profile-bonus', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, frequency, timing })
    });
    const data = await res.json();
    if (res.ok && (data.success || data.already_completed)) {
      state.profileCompleted = true;
      state.userCanGenerate  = true;
      document.getElementById('end-profile').style.display = 'none';
      document.getElementById('screen-player').classList.remove('end-active');
      showToast('¡Tienes 1 meditación extra gratis! Úsala cuando quieras.');
      document.getElementById('btn-new-meditation').style.display = 'block';
      const usageEl = document.getElementById('usage-info');
      if (usageEl) usageEl.textContent = 'Meditación gratis disponible';
    } else {
      showToast('Error al guardar el perfil. Inténtalo de nuevo.');
      btn.disabled = false;
      btn.textContent = 'Recibir meditación gratis';
    }
  } catch (e) {
    console.error('[profile-bonus] Error:', e);
    showToast('Error de conexión. Inténtalo de nuevo.');
    btn.disabled = false;
    btn.textContent = 'Recibir meditación gratis';
  }
}

function skipProfile() {
  document.getElementById('end-profile').style.display = 'none';
  document.getElementById('end-upsell').style.display  = 'flex';
  document.getElementById('screen-player').classList.add('end-active');
}
