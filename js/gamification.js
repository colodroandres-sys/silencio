function calculateLevel(totalSessions) {
  if (totalSessions >= 30) return 'Calma';
  if (totalSessions >= 15) return 'Presente';
  if (totalSessions >= 5)  return 'Consciente';
  if (totalSessions >= 1)  return 'Explorador';
  return 'Inquieto';
}

function updateHomeGamification(data) {
  const { streak, minutesThisWeek, totalSessions, level } = data;
  state.streak          = streak   || 0;
  state.minutesThisWeek = minutesThisWeek || 0;
  state.totalSessions   = totalSessions   || 0;
  state.level           = level || calculateLevel(totalSessions);

  const gamEl = document.getElementById('home-gam');
  if (!gamEl) return;

  document.getElementById('gam-streak').textContent  = state.streak;
  document.getElementById('gam-minutes').textContent = state.minutesThisWeek;
  document.getElementById('gam-level').textContent   = state.level;
  gamEl.style.display = 'flex';
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
    const tagHtml = m.emotion_tag
      ? `<span class="home-recent-tag">${EMOTION_LABELS[m.emotion_tag] || m.emotion_tag}</span>`
      : '';
    return `
      <div class="home-recent-card" onclick="showCreate()">
        <div>
          <div class="home-recent-title">${escapeHtml(m.title)}</div>
          <div class="home-recent-meta">
            <span>${dateStr}</span>
            <span>${m.duration} min</span>
            ${tagHtml}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--text-45)">
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
