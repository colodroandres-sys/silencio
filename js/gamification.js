function calculateLevel(totalSessions) {
  if (totalSessions >= 30) return 'Calma';
  if (totalSessions >= 15) return 'Presente';
  if (totalSessions >= 5)  return 'Consciente';
  if (totalSessions >= 1)  return 'Explorador';
  return 'Inquieto';
}

function updateHomeGamification(data) {
  const { streak, minutesThisWeek, totalSessions, level, weekHistory } = data;
  state.streak          = streak   || 0;
  state.minutesThisWeek = minutesThisWeek || 0;
  state.totalSessions   = totalSessions   || 0;
  state.level           = level || calculateLevel(totalSessions);
  state.weekHistory     = weekHistory || [0,0,0,0,0,0,0];
}

function renderHomeRecents(meditations) {
  if (!meditations || meditations.length === 0) return;
  const container = document.getElementById('home-recents');
  const list      = document.getElementById('home-recents-list');
  if (!container || !list) return;

  const EMOTION_LABELS = {
    ansiedad:   'Ansiedad',
    sueno:      'Dormir',
    claridad:   'Claridad',
    liberacion: 'Liberación',
    enfoque:    'Enfoque'
  };

  list.innerHTML = meditations.slice(0, 3).map(m => {
    const dateStr = formatRelativeDate(m.created_at);
    const tag = m.emotion_tag ? (EMOTION_LABELS[m.emotion_tag] || m.emotion_tag) : null;
    return `
      <div class="med-card" onclick="showCreate()">
        <div class="med-info">
          <div class="med-title">${escapeHtml(m.title)}</div>
          <div class="med-meta">${dateStr} · ${m.duration} min${tag ? ' · ' + tag : ''}</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--muted)">
          <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`;
  }).join('');

  container.style.display = 'block';
}

function formatRelativeDate(iso) {
  const d   = new Date(iso);
  const now = new Date();
  const s   = dt => dt.toISOString().slice(0, 10);
  if (s(d) === s(now)) return 'Hoy';
  if (s(d) === s(new Date(Date.now() - 86400000))) return 'Ayer';
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
