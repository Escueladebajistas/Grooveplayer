(() => {
  const $ = (id) => document.getElementById(id);
  const audio = $('audio');
  const trackList = $('trackList');
  const statusEl = $('status');
  const supabaseReady = window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
    !window.SUPABASE_URL.includes('TU-PROYECTO') && !window.SUPABASE_ANON_KEY.includes('TU-PUBLISHABLE');

  let db = null;
  let tracks = [];
  let currentIndex = -1;
  let repeatMode = 0; // 0 = off, 1 = track, 2 = playlist
  let activePlaylist = 'all';

  const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  const setStatus = (message, type = '') => { statusEl.textContent = message; statusEl.className = `status ${type}`; };
  const publicUrl = (path) => db.storage.from('music').getPublicUrl(path).data.publicUrl;
  const visibleTracks = () => {
    const query = $('searchInput').value.trim().toLowerCase();
    return tracks.map((track, index) => ({...track, originalIndex:index})).filter(t =>
      (activePlaylist === 'all' || t.playlist_name === activePlaylist) &&
      `${t.title} ${t.artist || ''} ${t.playlist_name || ''}`.toLowerCase().includes(query)
    );
  };

  function renderPlaylists() {
    const select = $('playlistSelect');
    const previous = activePlaylist;
    const names = [...new Set(tracks.map(t => t.playlist_name || 'General'))].sort((a,b) => a.localeCompare(b, 'es'));
    select.innerHTML = '<option value="all">Todas las playlists</option>' + names.map(n => `<option value="${escapeText(n)}">${escapeText(n)}</option>`).join('');
    activePlaylist = names.includes(previous) || previous === 'all' ? previous : 'all';
    select.value = activePlaylist;
  }

  function renderTracks() {
    const shown = visibleTracks();
    $('trackCount').textContent = `${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}`;
    if (!shown.length) {
      trackList.innerHTML = `<div class="empty-state"><div class="empty-icon">♫</div><strong>${tracks.length ? 'No encontramos resultados' : 'Todavía no hay canciones'}</strong><p>${tracks.length ? 'Prueba otra búsqueda o playlist.' : 'El administrador puede cargar música desde el panel privado.'}</p></div>`;
      return;
    }
    trackList.innerHTML = shown.map(t => `
      <div class="track-row ${t.originalIndex === currentIndex ? 'is-playing' : ''}" data-index="${t.originalIndex}">
        <button class="track-play" data-play="${t.originalIndex}" aria-label="Reproducir ${escapeText(t.title)}">${t.originalIndex === currentIndex && !audio.paused ? 'Ⅱ' : '▶'}</button>
        <div class="track-info"><strong>${escapeText(t.title)}</strong><span>${escapeText(t.artist || 'Artista desconocido')}</span></div>
        <span class="track-playlist">${escapeText(t.playlist_name || 'General')}</span>
        <span class="track-size">${t.size ? `${Math.max(1, Math.round(t.size / 1048576))} MB` : ''}</span>
        ${isAdmin ? `<button class="delete-track" data-delete="${t.id}" title="Eliminar canción" aria-label="Eliminar canción">×</button>` : ''}
      </div>`).join('');
  }

  async function loadCatalog() {
    setStatus('Cargando catálogo…');
    const { data, error } = await db.from('tracks').select('*').order('created_at', {ascending:true});
    if (error) { setStatus(`No se pudo cargar el catálogo: ${error.message}`, 'error'); return; }
    tracks = (data || []).map(t => ({...t, url: publicUrl(t.storage_path)}));
    renderPlaylists(); renderTracks();
    setStatus(tracks.length ? 'Catálogo actualizado. Elige una canción para escuchar.' : 'El catálogo está vacío por ahora.');
    if (currentIndex >= tracks.length) { currentIndex = -1; audio.pause(); audio.removeAttribute('src'); audio.load(); updateNowPlaying(); }
  }

  function updateNowPlaying() {
    const t = tracks[currentIndex];
    $('nowTitle').textContent = t ? t.title : 'Selecciona una canción';
    $('nowArtist').textContent = t ? (t.artist || t.playlist_name || 'Groove Player') : 'Tu próxima canción te espera';
    $('playButton').textContent = t && !audio.paused ? 'Ⅱ' : '▶';
    renderTracks();
  }

  async function playTrack(index) {
    if (index < 0 || index >= tracks.length) return;
    currentIndex = index;
    audio.src = tracks[index].url;
    audio.load();
    updateNowPlaying();
    try { await audio.play(); } catch (err) { setStatus('El navegador bloqueó la reproducción. Pulsa Play para intentarlo de nuevo.', 'error'); }
  }
  function playPause() {
    if (currentIndex < 0 && tracks.length) { playTrack(0); return; }
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }
  function playlistIndices() {
    return visibleTracks().map(t => t.originalIndex);
  }
  function moveTrack(direction) {
    if (!tracks.length) return;
    const list = playlistIndices();
    const pool = list.length ? list : tracks.map((_, i) => i);
    let pos = pool.indexOf(currentIndex);
    if (pos < 0) pos = direction > 0 ? -1 : 0;
    let next = pos + direction;
    if (next >= pool.length) next = repeatMode === 2 ? 0 : pool.length - 1;
    if (next < 0) next = repeatMode === 2 ? pool.length - 1 : 0;
    playTrack(pool[next]);
  }

  $('playButton').addEventListener('click', playPause);
  $('prevButton').addEventListener('click', () => moveTrack(-1));
  $('nextButton').addEventListener('click', () => moveTrack(1));
  $('repeatButton').addEventListener('click', () => {
    repeatMode = (repeatMode + 1) % 3;
    const labels = ['Sin repetición', 'Repetir canción', 'Repetir playlist'];
    $('repeatButton').classList.toggle('selected', repeatMode !== 0);
    $('repeatButton').title = labels[repeatMode];
    $('repeatBadge').textContent = repeatMode === 1 ? '1' : repeatMode === 2 ? '↻' : '';
  });
  audio.addEventListener('ended', () => {
    if (repeatMode === 1 && currentIndex >= 0) { audio.currentTime = 0; audio.play().catch(() => {}); }
    else if (repeatMode === 2) moveTrack(1);
    else { $('playButton').textContent = '▶'; }
  });
  audio.addEventListener('play', updateNowPlaying);
  audio.addEventListener('pause', updateNowPlaying);
  audio.addEventListener('timeupdate', () => {
    $('currentTime').textContent = formatTime(audio.currentTime);
    $('duration').textContent = formatTime(audio.duration);
    if (Number.isFinite(audio.duration) && audio.duration > 0) $('progress').value = Math.round(audio.currentTime / audio.duration * 1000);
  });
  $('progress').addEventListener('input', () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number($('progress').value) / 1000 * audio.duration; });
  $('volume').addEventListener('input', () => { audio.volume = Number($('volume').value); });
  $('searchInput').addEventListener('input', renderTracks);
  $('playlistSelect').addEventListener('change', e => { activePlaylist = e.target.value; renderTracks(); });
  trackList.addEventListener('click', async e => {
    const playButton = e.target.closest('[data-play]');
    const deleteButton = e.target.closest('[data-delete]');
    if (playButton) { playTrack(Number(playButton.dataset.play)); return; }
    if (deleteButton && isAdmin) { await deleteTrack(deleteButton.dataset.delete); return; }
    const row = e.target.closest('.track-row');
    if (row) playTrack(Number(row.dataset.index));
  });
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); playPause(); }
    if (e.code === 'ArrowRight' && Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
    if (e.code === 'ArrowLeft') audio.currentTime = Math.max(audio.currentTime - 5, 0);
  });

  let isAdmin = false;
  async function refreshAdminState() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) { isAdmin = false; showAdminState(false); return; }
    const { data, error } = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    isAdmin = !error && !!data;
    showAdminState(isAdmin);
    if (isAdmin) renderTracks();
  }
  function showAdminState(admin) {
    $('loginBox').classList.toggle('hidden', admin);
    $('uploadBox').classList.toggle('hidden', !admin);
    $('logoutButton').classList.toggle('hidden', !admin);
  }
  $('adminToggle').addEventListener('click', () => $('adminPanel').classList.toggle('hidden'));
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('loginMessage').textContent = 'Verificando…';
    const { error } = await db.auth.signInWithPassword({ email: $('emailInput').value, password: $('passwordInput').value });
    if (error) { $('loginMessage').textContent = error.message; return; }
    await refreshAdminState();
    $('loginMessage').textContent = isAdmin ? 'Sesión iniciada.' : 'La cuenta inició sesión, pero no tiene permisos de administrador.';
  });
  $('logoutButton').addEventListener('click', async () => { await db.auth.signOut(); await refreshAdminState(); });

  $('uploadForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!isAdmin) return;
    const files = Array.from($('uploadInput').files || []);
    const playlistName = $('playlistNameInput').value.trim() || 'General';
    if (!files.length) return;
    const message = $('uploadMessage');
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      message.textContent = `Subiendo ${i + 1} de ${files.length}: ${file.name}`;
      const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await db.storage.from('music').upload(path, file, { contentType: file.type || 'audio/mpeg', upsert: false });
      if (uploadError) { message.textContent = `Error al subir ${file.name}: ${uploadError.message}`; continue; }
      const base = file.name.replace(/\.[^.]+$/, '');
      const { error: insertError } = await db.from('tracks').insert({ title: base, artist: '', playlist_name: playlistName, storage_path: path, size: file.size, mime_type: file.type || 'audio/mpeg' });
      if (insertError) {
        await db.storage.from('music').remove([path]);
        message.textContent = `Se subió el archivo, pero no se guardó en el catálogo: ${insertError.message}`;
      }
    }
    $('uploadInput').value = '';
    await loadCatalog();
    message.textContent = 'Proceso de carga terminado. Revisa el catálogo.';
  });

  async function deleteTrack(id) {
    if (!confirm('¿Eliminar esta canción del catálogo compartido?')) return;
    const track = tracks.find(t => t.id === id);
    if (!track) return;
    const { error: rowError } = await db.from('tracks').delete().eq('id', id);
    if (rowError) { setStatus(`No se pudo eliminar: ${rowError.message}`, 'error'); return; }
    await db.storage.from('music').remove([track.storage_path]);
    if (currentIndex >= 0 && tracks[currentIndex]?.id === id) { audio.pause(); audio.removeAttribute('src'); currentIndex = -1; updateNowPlaying(); }
    await loadCatalog();
  }

  if (!supabaseReady) {
    setStatus('Falta configurar Supabase. Abre config.js y pega la URL y la clave pública de tu proyecto.', 'error');
    $('adminToggle').disabled = true;
    return;
  }
  db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  audio.volume = 0.8;
  db.auth.onAuthStateChange(() => { setTimeout(refreshAdminState, 0); });
  refreshAdminState().then(loadCatalog);
})();
