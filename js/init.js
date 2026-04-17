document.addEventListener('DOMContentLoaded', () => {
  initClerk();

  document.addEventListener('click', (e) => {
    const pill = e.target.closest('.profile-pill');
    if (!pill) return;
    const group = pill.closest('.profile-pills');
    if (group) profilePillSelect(group.id, pill);
  });
});
