// ============================================
// XP MUSIC PLAYER - JavaScript
// ============================================

let player = null;
let isPlaying = false;
let isMuted = false;
let isShuffle = false;
let currentTrackIndex = -1;
let playlist = [];
let progressInterval = null;
let visualizerInterval = null;

// Elementos
const els = {
  artistName: document.getElementById('artist-name'),
  trackName: document.getElementById('track-name'),
  statusArtist: document.getElementById('status-artist'),
  albumTitle: document.getElementById('album-title'),
  albumArt: document.getElementById('album-art'),
  queueList: document.getElementById('queue-list'),
  totalTime: document.getElementById('total-time'),
  timeCurrent: document.getElementById('time-current'),
  timeTotal: document.getElementById('time-total'),
  progressFill: document.getElementById('progress-fill'),
  progressHandle: document.getElementById('progress-handle'),
  progressTrack: document.getElementById('progress-track'),
  playBtn: document.getElementById('play-btn'),
  pauseIcon: document.getElementById('pause-icon'),
  muteBtn: document.getElementById('mute-btn'),
  statusText: document.getElementById('vis-mode'),
  shuffleBadge: document.getElementById('shuffle-badge'),
  urlInput: document.getElementById('url-input'),
  visPlaceholder: document.getElementById('vis-placeholder'),
  visCanvas: document.getElementById('vis-canvas'),
  volSlider: document.getElementById('vol-slider')
};

// ============================================
// YOUTUBE API
// ============================================

function onYouTubeIframeAPIReady() {
  player = new YT.Player('yt-player', {
    height: '1', width: '1',
    playerVars: {
      autoplay: 0, controls: 0, disablekb: 1, fs: 0,
      rel: 0, modestbranding: 1, iv_load_policy: 3, playsinline: 1,
      origin: window.location.origin
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError
    }
  });
}

function onPlayerReady(event) {
  setVolume(80);
}

function onPlayerStateChange(event) {
  switch(event.data) {
    case YT.PlayerState.PLAYING:
      isPlaying = true;
      updatePlayButton();
      startProgressTimer();
      startVisualizer();
      break;
    case YT.PlayerState.PAUSED:
      isPlaying = false;
      updatePlayButton();
      stopProgressTimer();
      stopVisualizer();
      break;
    case YT.PlayerState.ENDED:
      isPlaying = false;
      updatePlayButton();
      stopProgressTimer();
      stopVisualizer();
      handleTrackEnd();
      break;
  }
}

function onPlayerError(event) {
  console.error('Erro YouTube:', event.data);
  if (event.data === 150 || event.data === 101) {
    showEmbedError();
  }
  stopProgressTimer();
  stopVisualizer();
  isPlaying = false;
  updatePlayButton();
}

function showEmbedError() {
  els.visPlaceholder.style.display = 'flex';
  els.visPlaceholder.innerHTML = '<span style="color:#ff6b6b">⚠️ Vídeo não permite embed</span>';
  els.artistName.textContent = 'Erro';
  els.trackName.textContent = 'Vídeo bloqueado';
}

// ============================================
// CARREGAR URL
// ============================================

function loadURL() {
  const url = els.urlInput.value.trim();
  if (!url) { alert('Cole um link do YouTube!'); return; }

  const videoId = extractVideoId(url);
  const playlistId = extractPlaylistId(url);

  if (videoId) {
    loadSingleVideo(videoId);
  } else if (playlistId) {
    loadPlaylist(playlistId);
  } else {
    alert('Link inválido!');
  }
}

function extractVideoId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function extractPlaylistId(url) {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function loadSingleVideo(videoId) {
  playlist = [{
    id: videoId,
    title: 'Carregando...',
    artist: 'YouTube',
    duration: 0,
    thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
  }];
  currentTrackIndex = 0;
  renderQueue();

  if (player && player.loadVideoById) {
    player.loadVideoById(videoId);
    els.visPlaceholder.style.display = 'none';
  }

  fetchVideoInfo(videoId);
}

async function fetchVideoInfo(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    const data = await res.json();
    playlist[0].title = data.title || 'Desconhecido';
    playlist[0].artist = data.author_name || 'Desconhecido';
    updateTrackInfo(0);
    renderQueue();
  } catch(e) {
    playlist[0].title = 'Vídeo do YouTube';
    playlist[0].artist = 'YouTube';
    updateTrackInfo(0);
    renderQueue();
  }
}

function loadPlaylist(playlistId) {
  if (player && player.loadPlaylist) {
    player.loadPlaylist({ list: playlistId, listType: 'playlist', index: 0 });
  }
  playlist = [];
  currentTrackIndex = 0;
  setTimeout(() => {
    try {
      const data = player.getVideoData();
      if (data && data.video_id) {
        playlist = [{
          id: data.video_id,
          title: data.title || 'Playlist',
          artist: data.author || 'Unknown',
          duration: 0,
          thumbnail: `https://img.youtube.com/vi/${data.video_id}/mqdefault.jpg`
        }];
        renderQueue();
        updateTrackInfo(0);
      }
    } catch(e) {}
  }, 3000);
}

// ============================================
// CONTROLES
// ============================================

function togglePlay() {
  if (!player || !player.playVideo) return;
  if (isPlaying) {
    player.pauseVideo();
  } else {
    if (playlist.length === 0 && els.urlInput.value) {
      loadURL();
    } else if (currentTrackIndex >= 0) {
      player.playVideo();
    } else {
      alert('Cole um link do YouTube primeiro!');
    }
  }
}

function stopPlayer() {
  if (!player || !player.stopVideo) return;
  player.stopVideo();
  isPlaying = false;
  updatePlayButton();
  stopProgressTimer();
  stopVisualizer();
  els.progressFill.style.width = '0%';
  els.progressHandle.style.left = '0%';
  els.timeCurrent.textContent = '0:00';
  els.visPlaceholder.style.display = 'flex';
  els.visPlaceholder.innerHTML = '<span>▶ Cole um link do YouTube abaixo</span>';
}

function nextTrack() {
  if (playlist.length === 0) return;
  if (isShuffle) {
    let newIndex;
    do { newIndex = Math.floor(Math.random() * playlist.length); }
    while (newIndex === currentTrackIndex && playlist.length > 1);
    currentTrackIndex = newIndex;
  } else {
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
  }
  loadCurrentTrack();
}

function prevTrack() {
  if (playlist.length === 0) return;
  if (isShuffle) {
    let newIndex;
    do { newIndex = Math.floor(Math.random() * playlist.length); }
    while (newIndex === currentTrackIndex && playlist.length > 1);
    currentTrackIndex = newIndex;
  } else {
    currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
  }
  loadCurrentTrack();
}

function handleTrackEnd() {
  if (currentTrackIndex < playlist.length - 1 || isShuffle) {
    nextTrack();
  }
}

function loadCurrentTrack() {
  if (currentTrackIndex < 0 || currentTrackIndex >= playlist.length) return;
  const track = playlist[currentTrackIndex];
  if (player && player.loadVideoById) {
    player.loadVideoById(track.id);
    els.visPlaceholder.style.display = 'none';
  }
  updateTrackInfo(currentTrackIndex);
  renderQueue();
}

// ============================================
// VOLUME
// ============================================

function setVolume(value) {
  if (!player || !player.setVolume) return;
  player.setVolume(value);
}

function toggleMute() {
  if (!player || !player.mute || !player.unMute) return;
  if (isMuted) {
    player.unMute();
    isMuted = false;
    els.volSlider.value = player.getVolume() || 80;
  } else {
    player.mute();
    isMuted = true;
    els.volSlider.value = 0;
  }
}

// ============================================
// SHUFFLE
// ============================================

function toggleShuffle() {
  isShuffle = !isShuffle;
  els.shuffleBadge.textContent = `Shuffle: ${isShuffle ? 'ON' : 'OFF'}`;
  els.shuffleBadge.classList.toggle('active', isShuffle);
}

// ============================================
// INTERFACE
// ============================================

function updateTrackInfo(index) {
  if (index < 0 || index >= playlist.length) return;
  const track = playlist[index];
  els.artistName.textContent = track.artist || 'Desconhecido';
  els.trackName.textContent = track.title || 'Desconhecido';
  els.statusArtist.textContent = track.artist || '—';
  els.albumTitle.textContent = track.title || '—';
  if (track.thumbnail) {
    els.albumArt.innerHTML = `<img src="${track.thumbnail}" alt="album">`;
  } else {
    els.albumArt.innerHTML = '<span>♪</span>';
  }
}

function updatePlayButton() {
  els.playBtn.classList.toggle('playing', isPlaying);
}

function renderQueue() {
  if (playlist.length === 0) {
    els.queueList.innerHTML = '<div class="queue-empty">A fila aparece aqui</div>';
    els.totalTime.textContent = '—';
    return;
  }
  let html = '';
  let totalSeconds = 0;
  playlist.forEach((track, index) => {
    const isActive = index === currentTrackIndex;
    const duration = formatTime(track.duration || 0);
    html += `<div class="queue-item ${isActive ? 'active' : ''}" onclick="playTrackAtIndex(${index})">
      <span class="q-num">${index + 1}</span>
      <span class="q-title">${escapeHtml(track.title || 'Unknown')}</span>
      <span class="q-dur">${duration}</span>
    </div>`;
    totalSeconds += track.duration || 0;
  });
  els.queueList.innerHTML = html;
  els.totalTime.textContent = formatTime(totalSeconds);
}

function playTrackAtIndex(index) {
  currentTrackIndex = index;
  loadCurrentTrack();
}

// ============================================
// PROGRESSO
// ============================================

function startProgressTimer() {
  stopProgressTimer();
  progressInterval = setInterval(() => {
    if (!player || !player.getCurrentTime) return;
    const current = player.getCurrentTime() || 0;
    const duration = player.getDuration() || 1;
    const percent = (current / duration) * 100;
    els.progressFill.style.width = percent + '%';
    els.progressHandle.style.left = percent + '%';
    els.timeCurrent.textContent = formatTime(current);
    els.timeTotal.textContent = formatTime(duration);
    if (playlist[currentTrackIndex] && playlist[currentTrackIndex].duration === 0) {
      playlist[currentTrackIndex].duration = duration;
      renderQueue();
    }
  }, 500);
}

function stopProgressTimer() {
  if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
}

function seekTo(event) {
  if (!player || !player.seekTo || !player.getDuration) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  const duration = player.getDuration() || 0;
  player.seekTo(percent * duration, true);
}

// ============================================
// VISUALIZADOR
// ============================================

function startVisualizer() {
  stopVisualizer();
  const canvas = els.visCanvas;
  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  let offset = 0;
  visualizerInterval = setInterval(() => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const barCount = 48;
    const barWidth = canvas.width / barCount;
    for (let i = 0; i < barCount; i++) {
      const h = Math.abs(Math.sin((i + offset) * 0.15) * 0.5 + Math.sin((i + offset * 0.7) * 0.25) * 0.3 + Math.random() * 0.2) * canvas.height * 0.85;
      const hue = 120 - (h / canvas.height) * 120;
      ctx.fillStyle = `hsl(${hue}, ${80 + Math.random() * 20}%, ${40 + (h / canvas.height) * 30}%)`;
      ctx.fillRect(i * barWidth + 0.5, canvas.height - h, barWidth - 1, h);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, canvas.width, 2);
    offset += 0.8;
  }, 50);
}

function stopVisualizer() {
  if (visualizerInterval) { clearInterval(visualizerInterval); visualizerInterval = null; }
  const canvas = els.visCanvas;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ============================================
// UTILITÁRIOS
// ============================================

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// TECLAS
// ============================================

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  switch(e.code) {
    case 'Space': e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': nextTrack(); break;
    case 'ArrowLeft': prevTrack(); break;
    case 'KeyM': toggleMute(); break;
  }
});

// ============================================
// INICIALIZAÇÃO
// ============================================

window.addEventListener('load', () => {
  const canvas = els.visCanvas;
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  els.urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadURL();
  });

function adjustScale() {
  const wrapper = document.querySelector('.player-wrapper');
  if (!wrapper) return;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const scaleX = (windowWidth - 20) / 1440;
  const scaleY = (windowHeight - 20) / 1000;
  const scale = Math.min(scaleX, scaleY, 1);
  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.transformOrigin = 'center center';
}

console.log('🎧 XP Music Player carregado!');
