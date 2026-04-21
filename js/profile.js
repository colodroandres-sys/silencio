function profilePillSelect(groupId, btn) {
  document.querySelectorAll(`#${groupId} .profile-pill`).forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  checkProfileComplete();
}

function checkProfileComplete() {
  const goal = document.querySelector('#profile-goal .profile-pill.active');
  const btn  = document.getElementById('btn-profile-submit');
  if (btn) btn.disabled = !goal;
}

async function submitProfile() {
  const goal = document.querySelector('#profile-goal .profile-pill.active')?.dataset.value;
  if (!goal) return;

  const btn = document.getElementById('btn-profile-submit');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const token = await getAuthToken();
    const res = await fetch('/api/profile-bonus', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal })
    });
    const data = await res.json();
    if (res.ok && (data.success || data.already_completed)) {
      document.getElementById('end-profile').style.display = 'none';
      document.getElementById('screen-player').classList.remove('end-active');
      showToast('¡Tienes 1 meditación extra gratis! Úsala cuando quieras.');
      document.getElementById('btn-new-meditation').style.display = 'block';
      // Sincronizar estado desde servidor (fuente de verdad)
      await fetchUserStatus();
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
