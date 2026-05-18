// ============================================
// XP MUSIC PLAYER - JavaScript (Corrigido)
// ============================================

let player = null;
let isPlaying = false;
let isMuted = false;
let isShuffle = false;
let currentTrackIndex = -1;
let playlist = [];
let progressInterval = null;
let visualizerInterval = null;
let visMode = 'Randomization';

// Referências aos elementos HTML
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
  muteBtn: document.getElementById('mute-btn'),
  statusText: document.getElementById('vis-mode'),
  shuffleBadge: document.getElementById('shuffle-badge'),
  urlInput: document.getElementById('url-input'),
  visPlaceholder: document.getElementById('vis-placeholder'),
  visCanvas: document.getElementById('vis-canvas'),
  volSlider: document.getElementById('vol-slider')
};

// ============================================
// 1. INICIALIZAÇÃO DA YOUTUBE IFRAME API
// ============================================

function onYouTubeIframeAPIReady() {
  console.log('🎵 YouTube API carregada!');

  player = new YT.Player('yt-player', {
    height: '1',
    width: '1',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      rel: 0,
      modestbranding: 1,
      iv_load_policy: 3,
      playsinline: 1,
      origin: window.location.origin  // IMPORTANTE: evita erros de embed
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError
    }
  });
}

// ============================================
// 2. EVENTOS DO PLAYER
// ============================================

function onPlayerReady(event) {
  console.log('✅ Player pronto!');
  setVolume(80);
  updateStatus('Randomization');
}

function onPlayerStateChange(event) {
  console.log('📊 Estado:', event.data);

  switch(event.data) {
    case YT.PlayerState.PLAYING:
      isPlaying = true;
      updatePlayButton();
      updateStatus('Randomization');
      startProgressTimer();
      startVisualizer();
      break;

    case YT.PlayerState.PAUSED:
      isPlaying = false;
      updatePlayButton();
      updateStatus('Paused');
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

    case YT.PlayerState.BUFFERING:
      updateStatus('Buffering...');
      break;

    case YT.PlayerState.CUED:
      updateStatus('Ready');
      break;
  }
}

// ============================================
// 3. TRATAMENTO DE ERROS (CORRIGIDO!)
// ============================================

function onPlayerError(event) {
  const errorCode = event.data;
  console.error('❌ Erro do YouTube. Código:', errorCode);

  let errorMessage = '';

  switch(errorCode) {
    case 2:
      errorMessage = 'Parâmetro inválido';
      break;
    case 5:
      errorMessage = 'Erro no player HTML5';
      break;
    case 100:
      errorMessage = 'Vídeo não encontrado (removido)';
      break;
    case 101:
    case 150:
      errorMessage = 'Vídeo não permite embed (bloqueado pelo autor)';
      // MOSTRA ALERTA AMIGÁVEL AO USUÁRIO
      showEmbedError();
      break;
    default:
      errorMessage = 'Erro desconhecido: ' + errorCode;
  }

  updateStatus('Error: ' + errorCode);

  // Para o visualizador e progresso
  stopProgressTimer();
  stopVisualizer();
  isPlaying = false;
  updatePlayButton();

  // Se for erro 150, não tenta próxima música automaticamente
  // (provavelmente todos os vídeos desse artista estão bloqueados)
  if (errorCode !== 150 && errorCode !== 101) {
    setTimeout(() => {
      if (playlist.length > 0) nextTrack();
    }, 3000);
  }
}

// Mostra mensagem amigável quando vídeo não permite embed
function showEmbedError() {
  // Atualiza o placeholder com mensagem de erro
  els.visPlaceholder.style.display = 'flex';
  els.visPlaceholder.innerHTML = `
    <div class="placeholder-content error">
      <span class="placeholder-icon">⚠️</span>
      <span class="placeholder-text">Este vídeo não permite reprodução externa</span>
      <span class="placeholder-subtext">Tente outro vídeo (covers, independentes, etc.)</span>
    </div>
  `;

  // Reseta as informações da música
  els.artistName.textContent = 'Erro ao carregar';
  els.trackName.textContent = 'Vídeo bloqueado';
  els.statusArtist.textContent = '—';
  els.albumTitle.textContent = '—';
  els.albumArt.innerHTML = '<span class="album-placeholder">⚠️</span>';
}

// ============================================
// 4. CARREGAR URL DO YOUTUBE (CORRIGIDO!)
// ============================================

function loadURL() {
  const url = els.urlInput.value.trim();

  if (!url) {
    alert('Cole um link do YouTube!\n\nExemplos:\n• youtube.com/watch?v=XXXX\n• youtu.be/XXXX');
    return;
  }

  console.log('🔗 URL:', url);

  // Limpa mensagem de erro anterior
  els.visPlaceholder.style.display = 'flex';
  els.visPlaceholder.innerHTML = `
    <div class="placeholder-content">
      <span class="placeholder-icon">⏳</span>
      <span class="placeholder-text">Carregando...</span>
    </div>
  `;

  const playlistId = extractPlaylistId(url);
  const videoId = extractVideoId(url);

  if (playlistId) {
    console.log('📋 Playlist:', playlistId);
    loadPlaylist(playlistId);
  } else if (videoId) {
    console.log('🎬 Vídeo:', videoId);
    loadSingleVideo(videoId, url);
  } else {
    alert('Link inválido!\nFormatos aceitos:\n• youtube.com/watch?v=XXXXX\n• youtu.be/XXXXX\n• youtube.com/playlist?list=XXXXX');
    resetPlaceholder();
  }
}

function resetPlaceholder() {
  els.visPlaceholder.style.display = 'flex';
  els.visPlaceholder.innerHTML = `
    <div class="placeholder-content">
      <span class="placeholder-icon">▶</span>
      <span class="placeholder-text">Cole um link do YouTube abaixo e clique em Load</span>
    </div>
  `;
}

// ============================================
// 5. EXTRAIR IDs DOS LINKS
// ============================================

function extractVideoId(url) {
  const patterns = [
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];

  for (let pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractPlaylistId(url) {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// ============================================
// 6. CARREGAR VÍDEO SOLO
// ============================================

function loadSingleVideo(videoId, url) {
  // Remove parâmetros extras da URL (como &si=, &feature=, etc.)
  const cleanVideoId = videoId.split('&')[0];

  playlist = [{
    id: cleanVideoId,
    title: 'Carregando...',
    artist: 'YouTube',
    duration: 0,
    thumbnail: `https://img.youtube.com/vi/${cleanVideoId}/mqdefault.jpg`
  }];

  currentTrackIndex = 0;
  renderQueue();

  // USA loadVideoById (mais confiável que cueVideoById)
  if (player && player.loadVideoById) {
    player.loadVideoById(cleanVideoId);
    els.visPlaceholder.style.display = 'none';
    updateStatus('Loading...');
  }

  fetchVideoInfo(cleanVideoId);
}

// Busca informações do vídeo via oEmbed
async function fetchVideoInfo(videoId) {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );

    if (!response.ok) {
      throw new Error('oEmbed falhou');
    }

    const data = await response.json();

    playlist[0].title = data.title || 'Título Desconhecido';
    playlist[0].artist = data.author_name || 'Artista Desconhecido';

    updateTrackInfo(0);
    renderQueue();

  } catch (e) {
    console.log('Não foi possível buscar informações:', e);
    // Mantém título genérico
    playlist[0].title = 'Vídeo do YouTube';
    playlist[0].artist = 'YouTube';
    updateTrackInfo(0);
    renderQueue();
  }
}

// ============================================
// 7. CARREGAR PLAYLIST
// ============================================

function loadPlaylist(playlistId) {
  // Para playlists, usamos loadPlaylist da API
  if (player && player.loadPlaylist) {
    player.loadPlaylist({
      list: playlistId,
      listType: 'playlist',
      index: 0
    });
  }

  playlist = [];
  currentTrackIndex = 0;

  updateStatus('Loading playlist...');
  els.visPlaceholder.style.display = 'none';

  // Tenta pegar info após carregar
  setTimeout(() => {
    updateStatus('Randomization');
    try {
      const currentVideo = player.getVideoData();
      if (currentVideo && currentVideo.video_id) {
        playlist = [{
          id: currentVideo.video_id,
          title: currentVideo.title || 'Playlist Track',
          artist: currentVideo.author || 'Unknown',
          duration: 0,
          thumbnail: `https://img.youtube.com/vi/${currentVideo.video_id}/mqdefault.jpg`
        }];
        renderQueue();
        updateTrackInfo(0);
      }
    } catch (e) {
      console.log('Não foi possível obter dados da playlist');
    }
  }, 3000);
}

// ============================================
// 8. CONTROLES DO PLAYER
// ============================================

function togglePlay() {
  if (!player || !player.playVideo) {
    console.log('Player não pronto');
    return;
  }

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
  updateStatus('Ready');
  stopProgressTimer();
  stopVisualizer();
  els.progressFill.style.width = '0%';
  els.progressHandle.style.left = '0%';
  els.timeCurrent.textContent = '0:00';
  resetPlaceholder();
}

function nextTrack() {
  if (playlist.length === 0) return;

  if (isShuffle) {
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * playlist.length);
    } while (newIndex === currentTrackIndex && playlist.length > 1);
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
    do {
      newIndex = Math.floor(Math.random() * playlist.length);
    } while (newIndex === currentTrackIndex && playlist.length > 1);
    currentTrackIndex = newIndex;
  } else {
    currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
  }

  loadCurrentTrack();
}

function handleTrackEnd() {
  if (currentTrackIndex < playlist.length - 1 || isShuffle) {
    nextTrack();
  } else {
    updateStatus('Ready');
    stopVisualizer();
    isPlaying = false;
    updatePlayButton();
  }
}

function loadCurrentTrack() {
  if (currentTrackIndex < 0 || currentTrackIndex >= playlist.length) return;

  const track = playlist[currentTrackIndex];

  if (player && player.loadVideoById) {
    player.loadVideoById(track.id);
    els.visPlaceholder.style.display = 'none';
    updateStatus('Loading...');
  }

  updateTrackInfo(currentTrackIndex);
  renderQueue();
}

// ============================================
// 9. VOLUME E MUDO
// ============================================

function setVolume(value) {
  if (!player || !player.setVolume) return;
  player.setVolume(value);

  const icon = els.muteBtn.querySelector('.ctrl-icon');
  if (value == 0) {
    icon.textContent = '🔇';
  } else {
    icon.textContent = isMuted ? '🔇' : '🔊';
  }
}

function toggleMute() {
  if (!player || !player.mute || !player.unMute) return;

  const icon = els.muteBtn.querySelector('.ctrl-icon');

  if (isMuted) {
    player.unMute();
    isMuted = false;
    icon.textContent = '🔊';
    els.volSlider.value = player.getVolume() || 80;
  } else {
    player.mute();
    isMuted = true;
    icon.textContent = '🔇';
    els.volSlider.value = 0;
  }
}

// ============================================
// 10. SHUFFLE
// ============================================

function toggleShuffle() {
  isShuffle = !isShuffle;
  els.shuffleBadge.textContent = `Shuffle: ${isShuffle ? 'ON' : 'OFF'}`;

  if (isShuffle) {
    els.shuffleBadge.classList.add('active');
  } else {
    els.shuffleBadge.classList.remove('active');
  }
}

// ============================================
// 11. ATUALIZAR INTERFACE
// ============================================

function updateTrackInfo(index) {
  if (index < 0 || index >= playlist.length) return;

  const track = playlist[index];

  els.artistName.textContent = track.artist || 'Artista Desconhecido';
  els.trackName.textContent = track.title || 'Título Desconhecido';
  els.statusArtist.textContent = track.artist || '—';
  els.albumTitle.textContent = track.title || '—';

  if (track.thumbnail) {
    els.albumArt.innerHTML = `<img src="${track.thumbnail}" alt="album">`;
  } else {
    els.albumArt.innerHTML = '<span class="album-placeholder">♪</span>';
  }
}

function updatePlayButton() {
  const icon = els.playBtn.querySelector('.ctrl-icon');
  icon.textContent = isPlaying ? '⏸' : '▶';
  els.playBtn.title = isPlaying ? 'Pause' : 'Play';
}

function updateStatus(text) {
  els.statusText.textContent = text;
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

    html += `
      <div class="queue-item ${isActive ? 'active' : ''}" onclick="playTrackAtIndex(${index})">
        <span class="q-num">${index + 1}</span>
        <span class="q-title">${escapeHtml(track.title || 'Unknown')}</span>
        <span class="q-dur">${duration}</span>
      </div>
    `;

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
// 12. BARRA DE PROGRESSO
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
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

function seekTo(event) {
  if (!player || !player.seekTo || !player.getDuration) return;

  const rect = event.currentTarget.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  const duration = player.getDuration() || 0;
  const newTime = percent * duration;

  player.seekTo(newTime, true);
}

// ============================================
// 13. VISUALIZADOR (CANVAS)
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
      const wave1 = Math.sin((i + offset) * 0.15) * 0.5;
      const wave2 = Math.sin((i + offset * 0.7) * 0.25) * 0.3;
      const random = Math.random() * 0.2;
      const height = Math.abs(wave1 + wave2 + random) * canvas.height * 0.85;

      const hue = 120 - (height / canvas.height) * 120;
      const saturation = 80 + Math.random() * 20;
      const lightness = 40 + (height / canvas.height) * 30;

      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

      const x = i * barWidth;
      const y = canvas.height - height;
      const gap = 1;

      ctx.fillRect(x + gap/2, y, barWidth - gap, height);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, canvas.width, 2);

    offset += 0.8;
  }, 50);
}

function stopVisualizer() {
  if (visualizerInterval) {
    clearInterval(visualizerInterval);
    visualizerInterval = null;
  }

  const canvas = els.visCanvas;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ============================================
// 14. UTILITÁRIOS
// ============================================

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
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
// 15. TECLAS DE ATALHO
// ============================================

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;

  switch(e.code) {
    case 'Space':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowRight':
      nextTrack();
      break;
    case 'ArrowLeft':
      prevTrack();
      break;
    case 'KeyM':
      toggleMute();
      break;
  }
});

// ============================================
// 16. INICIALIZAÇÃO
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
    if (e.key === 'Enter') {
      loadURL();
    }
  });
});

window.addEventListener('resize', () => {
  const canvas = els.visCanvas;
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
});

console.log('🎧 XP Music Player carregado!');
console.log('💡 Cole um link do YouTube e clique em Load');