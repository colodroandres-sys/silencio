async function saveMeditation() {
  const btn = document.getElementById('btn-save-meditation');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const token   = await getAuthToken();
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const presignRes = await fetch('/api/save-meditation', {
      method: 'POST',
      headers,
      body: JSON.stringify({ meditationId: state.currentMeditationId, action: 'presign' })
    });

    if (presignRes.status === 403) {
      const { reason } = await presignRes.json();
      btn.disabled = false;
      btn.textContent = 'Guardar meditación';
      if (reason === 'save_limit') {
        const plan = state.userPlan;
        const msg = plan === 'premium'
          ? 'Has alcanzado el límite de Premium (20). Pasa a Studio para guardar sin límite.'
          : 'Has alcanzado el límite de tu plan. Mejora tu suscripción para guardar más.';
        showToast(msg);
        setTimeout(() => showPaywall(), 800);
      }
      return;
    }
    if (!presignRes.ok) throw new Error('Error al preparar el guardado');

    const { signedUrl, path, already_saved } = await presignRes.json();
    if (already_saved) { showToast('Ya estaba guardada en tu biblioteca'); skipSave(); return; }

    if (!state.audioBlobUrl) throw new Error('Audio no disponible para guardar');
    const audioBlob = await fetch(state.audioBlobUrl).then(r => r.blob());
    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/mpeg' },
      body: audioBlob
    });
    if (!uploadRes.ok) throw new Error('Error al subir el audio');

    const confirmRes = await fetch('/api/save-meditation', {
      method: 'POST',
      headers,
      body: JSON.stringify({ meditationId: state.currentMeditationId, action: 'confirm', path })
    });
    if (!confirmRes.ok) throw new Error('Error al confirmar el guardado');

    track('meditation_saved', { duration: state.duration });
    showToast('Guardada en tu biblioteca');
    skipSave();
  } catch (e) {
    console.error('[save] Error:', e);
    btn.disabled = false;
    btn.textContent = 'Guardar meditación';
    showToast('Error al guardar. Inténtalo de nuevo.');
  }
}

function skipSave() {
  document.getElementById('end-save').style.display           = 'none';
  document.getElementById('btn-new-meditation').style.display = 'block';
}
