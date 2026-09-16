/**
 * QuizLive İstemci Uygulaması (Client App)
 * ========================================
 * SPA ekran yönlendirmeleri, WebSocket haberleşmesi,
 * geri sayım sayaçları, admin paneli ve dramatik ses efektleri.
 */

// Uygulama Durumu (State)
const state = {
  currentUser: {
    id: null,
    name: null,
    isHost: false,
    roomCode: null,
    score: 0
  },
  socket: null,
  currentQuestion: null,
  hasAnsweredCurrent: false,
  questionTimerInterval: null,
  resultCountdownInterval: null,
  timeLeft: 0,
  lastTickedSec: null,
  previousPlayerCount: 0
};

// DOM Elemanları
const screens = {
  home: document.getElementById("screen-home"),
  lobby: document.getElementById("screen-lobby"),
  question: document.getElementById("screen-question"),
  result: document.getElementById("screen-result"),
  gameOver: document.getElementById("screen-game-over")
};

// Ekran Değiştirme Fonksiyonu
function showScreen(screenName) {
  Object.keys(screens).forEach(key => {
    if (screens[key]) {
      screens[key].classList.toggle("active", key === screenName);
    }
  });
}

// Hata Bildirimi Gösterme / Gizleme
function showHomeError(msg) {
  const alertBox = document.getElementById("home-error-alert");
  if (alertBox) {
    alertBox.textContent = msg;
    alertBox.style.display = "block";
  }
}

function hideHomeError() {
  const alertBox = document.getElementById("home-error-alert");
  if (alertBox) {
    alertBox.style.display = "none";
  }
}

function showAdminError(msg) {
  const alertBox = document.getElementById("admin-error-alert");
  if (alertBox) {
    alertBox.textContent = msg;
    alertBox.style.display = "block";
  }
}

function hideAdminError() {
  const alertBox = document.getElementById("admin-error-alert");
  if (alertBox) {
    alertBox.style.display = "none";
  }
}

// ========================================================
// 1. ADMIN MODALI VE YÖNETİCİ KONTROLLERİ
// ========================================================
const adminModal = document.getElementById("admin-modal");
const btnOpenAdminModal = document.getElementById("btn-open-admin-modal");
const btnCloseAdminModal = document.getElementById("btn-close-admin-modal");
const formAdminCreate = document.getElementById("form-admin-create");
const inputAdminKey = document.getElementById("input-admin-key");
const inputAdminHostName = document.getElementById("input-admin-host-name");

function openAdminModal() {
  if (adminModal) {
    adminModal.style.display = "flex";
    hideAdminError();
    if (inputAdminKey) inputAdminKey.focus();
    if (window.soundEffects) window.soundEffects.playClick();
  }
}

function closeAdminModal() {
  if (adminModal) {
    adminModal.style.display = "none";
    hideAdminError();
  }
}

if (btnOpenAdminModal) {
  btnOpenAdminModal.addEventListener("click", openAdminModal);
}

if (btnCloseAdminModal) {
  btnCloseAdminModal.addEventListener("click", closeAdminModal);
}

// Modal dışına tıklayınca kapat
if (adminModal) {
  adminModal.addEventListener("click", (e) => {
    if (e.target === adminModal) {
      closeAdminModal();
    }
  });
}

// URL'de #admin veya ?admin varsa otomatik aç
window.addEventListener("DOMContentLoaded", () => {
  if (window.location.hash === "#admin" || window.location.search.includes("admin") || window.location.pathname === "/admin") {
    openAdminModal();
  }
});

// Admin Oda Oluşturma Formu
if (formAdminCreate) {
  formAdminCreate.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAdminError();

    const adminKey = inputAdminKey.value.trim();
    const hostName = inputAdminHostName.value.trim();

    if (!adminKey) {
      showAdminError("Lütfen yönetici şifresini girin.");
      return;
    }
    if (!hostName) {
      showAdminError("Lütfen sunucu/host adınızı girin.");
      return;
    }

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host_name: hostName, admin_key: adminKey })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showAdminError(data.detail || data.message || "Geçersiz şifre veya oda oluşturulamadı.");
        if (window.soundEffects) window.soundEffects.playWrong();
        return;
      }

      closeAdminModal();

      state.currentUser = {
        id: data.player_id,
        name: data.player_name,
        isHost: true,
        roomCode: data.room_code,
        score: 0
      };

      state.previousPlayerCount = 1;
      connectWebSocket(data.room_code, data.player_id, data.player_name);
    } catch (err) {
      showAdminError("Sunucuya bağlanırken bir hata oluştu.");
      console.error(err);
    }
  });
}

// ========================================================
// 2. NORMAL KULLANICI: ODAYA KATILMA FORMU
// ========================================================
const formJoin = document.getElementById("form-join");
const inputJoinCode = document.getElementById("input-join-code");
const inputJoinName = document.getElementById("input-join-name");

// Oda kodunu otomatik büyük harfe dönüştür
if (inputJoinCode) {
  inputJoinCode.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });
}

// Ses Açma / Kapatma Butonu
const btnSoundToggle = document.getElementById("btn-sound-toggle");
if (btnSoundToggle) {
  btnSoundToggle.addEventListener("click", () => {
    if (window.soundEffects) {
      const isMuted = window.soundEffects.toggleMute();
      btnSoundToggle.textContent = isMuted ? "🔇" : "🔊";
    }
  });
}

// Normal Oyuncu Odaya Katılıyor
if (formJoin) {
  formJoin.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideHomeError();
    const roomCode = inputJoinCode.value.trim().toUpperCase();
    const playerName = inputJoinName.value.trim();

    if (!roomCode || roomCode.length < 4) {
      showHomeError("Lütfen geçerli bir oda kodu girin.");
      return;
    }
    if (!playerName) {
      showHomeError("Lütfen oyuncu adınızı girin.");
      return;
    }

    try {
      const res = await fetch("/api/join-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_code: roomCode, player_name: playerName })
      });

      const data = await res.json();
      if (!data.success) {
        showHomeError(data.message);
        if (window.soundEffects) window.soundEffects.playWrong();
        return;
      }

      state.currentUser = {
        id: data.player_id,
        name: data.player_name,
        isHost: false,
        roomCode: data.room_code,
        score: 0
      };

      connectWebSocket(data.room_code, data.player_id, data.player_name);
    } catch (err) {
      showHomeError("Sunucuya bağlanırken bir hata oluştu.");
      console.error(err);
    }
  });
}

// ========================================================
// 3. WEBSOCKET BAĞLANTISI VE MESAJ YÖNETİMİ
// ========================================================
function connectWebSocket(roomCode, playerId, playerName) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws/${roomCode}/${playerId}?name=${encodeURIComponent(playerName)}`;

  if (state.socket) {
    state.socket.close();
  }

  state.socket = new WebSocket(wsUrl);

  state.socket.onopen = () => {
    console.log("WebSocket bağlantısı kuruldu.");
  };

  state.socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (e) {
      console.error("Gelen mesaj ayrıştırılamadı:", event.data, e);
    }
  };

  state.socket.onclose = () => {
    console.log("WebSocket bağlantısı kapandı.");
  };

  state.socket.onerror = (err) => {
    console.error("WebSocket hatası:", err);
  };
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case "connected":
      handleConnected(msg);
      break;
    case "player_list_update":
      updateLobbyPlayerList(msg.players, msg.total_players);
      break;
    case "question_start":
      handleQuestionStart(msg);
      break;
    case "answer_locked":
      handleAnswerLocked(msg);
      break;
    case "answer_count_update":
      handleAnswerCountUpdate(msg);
      break;
    case "question_result":
      handleQuestionResult(msg);
      break;
    case "game_over":
      handleGameOver(msg);
      break;
    case "returned_to_lobby":
      handleReturnedToLobby();
      break;
    case "error":
      alert(msg.message);
      break;
  }
}

// Bağlantı Başarılı Olduğunda
function handleConnected(msg) {
  state.currentUser.isHost = msg.is_host;
  state.currentUser.roomCode = msg.room_code;

  // Lobi Ekranını Hazırla
  document.getElementById("lobby-code-text").textContent = msg.room_code;

  const hostControls = document.getElementById("host-lobby-controls");
  const playerNotice = document.getElementById("player-waiting-notice");

  if (state.currentUser.isHost) {
    hostControls.style.display = "block";
    playerNotice.style.display = "none";
  } else {
    hostControls.style.display = "none";
    playerNotice.style.display = "flex";
  }

  showScreen("lobby");
}

// Lobi Oyuncu Listesini Güncelle (Yeni oyuncu katıldığında ses çal)
function updateLobbyPlayerList(players, totalPlayers) {
  const grid = document.getElementById("lobby-players-grid");
  const countBadge = document.getElementById("lobby-player-count");

  // Oyuncu sayısı arttıysa ve lobi ekranındaysak katılım sesi çal
  if (state.previousPlayerCount > 0 && players.length > state.previousPlayerCount) {
    if (window.soundEffects) window.soundEffects.playPlayerJoined();
  }
  state.previousPlayerCount = players.length;

  if (countBadge) {
    countBadge.textContent = `${players.length} Katılımcı`;
  }

  if (grid) {
    grid.innerHTML = "";
    players.forEach(p => {
      const chip = document.createElement("div");
      chip.className = `player-chip ${p.is_host ? "is-host" : ""}`;
      
      const initial = (p.name || "?").charAt(0).toUpperCase();
      const hostCrown = p.is_host ? " 👑" : "";

      chip.innerHTML = `
        <div class="player-avatar">${initial}</div>
        <div class="player-name">${p.name}${hostCrown}</div>
      `;
      grid.appendChild(chip);
    });
  }
}

// Oda Kodunu Kopyalama Butonu
const btnCopyCode = document.getElementById("btn-copy-code");
if (btnCopyCode) {
  btnCopyCode.addEventListener("click", () => {
    const code = state.currentUser.roomCode;
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        const label = document.getElementById("copy-code-label");
        label.textContent = "Kopyalandı! ✅";
        setTimeout(() => {
          label.textContent = "Kodu Kopyala";
        }, 2000);
      });
    }
  });
}

// Host: Oyunu Başlat
const btnStartGame = document.getElementById("btn-start-game");
if (btnStartGame) {
  btnStartGame.addEventListener("click", () => {
    if (state.socket && state.currentUser.isHost) {
      if (window.soundEffects) window.soundEffects.playGameStart();
      state.socket.send(JSON.stringify({ action: "start_game" }));
    }
  });
}

// ========================================================
// 4. OYUN & SORU EKRANI KONTROLLERİ
// ========================================================
function handleQuestionStart(msg) {
  state.currentQuestion = msg.question;
  state.hasAnsweredCurrent = false;
  state.lastTickedSec = null;

  // İlk soru başladığında başlangıç stinger'ı, diğer sorularda soru gerilim sesi
  if (msg.question_index === 1) {
    if (window.soundEffects) window.soundEffects.playGameStart();
  } else {
    if (window.soundEffects) window.soundEffects.playQuestionReveal();
  }

  // Başlık Bilgileri
  document.getElementById("q-index-badge").textContent = `SORU ${msg.question_index} / ${msg.total_questions}`;
  document.getElementById("q-player-score-badge").textContent = `⭐ ${state.currentUser.score.toLocaleString()} Puan`;
  document.getElementById("q-answered-badge").textContent = `👥 0 Oyuncu Cevapladı`;

  // Soru Metni
  document.getElementById("q-text").textContent = msg.question.text;

  // Seçenekleri Ayarla
  const optionButtons = document.querySelectorAll(".option-btn");
  msg.question.options.forEach(opt => {
    const btn = document.querySelector(`.option-btn[data-option="${opt.id}"]`);
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("selected");
      const textElem = document.getElementById(`opt-text-${opt.id.toLowerCase()}`);
      if (textElem) {
        textElem.textContent = opt.text;
      }
    }
  });

  // Kilit bildirimini gizle
  document.getElementById("answer-lock-notice").style.display = "none";

  // Sayaç ve Barı Başlat
  startQuestionTimer(msg.time_limit);

  showScreen("question");
}

function startQuestionTimer(duration) {
  clearInterval(state.questionTimerInterval);
  state.timeLeft = duration;

  const timerCircle = document.getElementById("q-timer-circle");
  const timerBar = document.getElementById("q-timer-bar");

  timerCircle.textContent = duration;
  timerCircle.classList.remove("warning");
  timerBar.style.width = "100%";

  const startTime = performance.now();
  const totalMs = duration * 1000;

  state.questionTimerInterval = setInterval(() => {
    const elapsedMs = performance.now() - startTime;
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    const remainingSec = Math.ceil(remainingMs / 1000);

    timerCircle.textContent = remainingSec;
    const progressPercent = (remainingMs / totalMs) * 100;
    timerBar.style.width = `${progressPercent}%`;

    // Her saniye değişiminde kalp atışı / saat tıkırtısı sesi
    if (remainingSec > 0 && remainingSec !== state.lastTickedSec) {
      state.lastTickedSec = remainingSec;
      if (window.soundEffects) {
        window.soundEffects.playCountdownTick(remainingSec);
      }
    }

    if (remainingSec <= 5) {
      timerCircle.classList.add("warning");
    }

    if (remainingMs <= 0) {
      clearInterval(state.questionTimerInterval);
      lockAnswerButtons();
      if (window.soundEffects) window.soundEffects.playTimeUp();
    }
  }, 50);
}

// Seçenek Tıklama Olayları (Cevap Seçildiğinde Kilitlenme Sesi)
const optionButtons = document.querySelectorAll(".option-btn");
optionButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (state.hasAnsweredCurrent) return;

    const selectedOption = btn.getAttribute("data-option");
    state.hasAnsweredCurrent = true;

    // UI'ı hemen kilitle ve seçilen butonu vurgula
    lockAnswerButtons(selectedOption);

    // Kilitlenme / Karar onay sesi
    if (window.soundEffects) window.soundEffects.playAnswerSelected();

    // Sunucuya cevabı gönder
    if (state.socket) {
      state.socket.send(JSON.stringify({
        action: "submit_answer",
        option: selectedOption
      }));
    }
  });
});

function lockAnswerButtons(selectedOption = null) {
  optionButtons.forEach(b => {
    b.disabled = true;
    if (selectedOption && b.getAttribute("data-option") === selectedOption) {
      b.classList.add("selected");
    }
  });
  const notice = document.getElementById("answer-lock-notice");
  if (notice) notice.style.display = "block";
}

function handleAnswerLocked(msg) {
  console.log("Cevap sunucu tarafından kilitlendi:", msg.selected_option);
}

function handleAnswerCountUpdate(msg) {
  const badge = document.getElementById("q-answered-badge");
  if (badge) {
    badge.textContent = `👥 ${msg.answered_count} / ${msg.total_participants} Oyuncu Cevapladı`;
  }
}

// ========================================================
// 5. SORU SONUCU (RESULT) KONTROLLERİ
// ========================================================
function handleQuestionResult(msg) {
  clearInterval(state.questionTimerInterval);

  // Bu oyuncunun sonucunu bul
  const mySummary = (msg.players_summary || []).find(p => p.id === state.currentUser.id);
  const resultBanner = document.getElementById("result-banner");
  const resultTitle = document.getElementById("result-title");
  const resultScoreGain = document.getElementById("result-score-gain");

  if (mySummary) {
    state.currentUser.score = mySummary.total_score;
    if (mySummary.is_correct) {
      resultBanner.className = "result-banner correct";
      resultTitle.textContent = "🎉 Harika! Doğru Cevap!";
      resultScoreGain.textContent = `+${mySummary.round_score} Puan Kazandınız!`;
      if (window.soundEffects) window.soundEffects.playCorrect();
    } else {
      resultBanner.className = "result-banner wrong";
      resultTitle.textContent = mySummary.selected_option ? "❌ Yanlış Cevap!" : "⏰ Süre Doldu!";
      resultScoreGain.textContent = "+0 Puan";
      if (window.soundEffects) {
        if (mySummary.selected_option) {
          window.soundEffects.playWrong();
        } else {
          window.soundEffects.playTimeUp();
        }
      }
    }
  } else {
    resultBanner.className = "result-banner";
    resultTitle.textContent = "Soru Tamamlandı";
    resultScoreGain.textContent = "";
  }

  // Doğru Cevabın Açıklanması
  let correctOptText = msg.correct_option;
  if (state.currentQuestion && state.currentQuestion.options) {
    const optObj = state.currentQuestion.options.find(o => o.id === msg.correct_option);
    if (optObj) {
      correctOptText = `${optObj.id}) ${optObj.text}`;
    }
  }
  document.getElementById("result-correct-answer").textContent = correctOptText;

  // Raunt Liderlik Tablosunu Doldur
  renderLeaderboard("round-leaderboard-list", msg.leaderboard);

  // Skor Açıklanma Işıltısı
  setTimeout(() => {
    if (window.soundEffects) window.soundEffects.playScoreReveal();
  }, 400);

  // Host Kontrolleri
  const hostNextControls = document.getElementById("host-next-controls");
  const nextQTimerText = document.getElementById("next-q-timer-text");

  if (state.currentUser.isHost) {
    hostNextControls.style.display = "block";
    const btnNext = document.getElementById("btn-next-question");
    btnNext.textContent = msg.is_last_question ? "🏆 Final Sonuçlarını Gör" : "⏭️ Sonraki Soruya Geç";
  } else {
    hostNextControls.style.display = "none";
  }

  // Otomatik Geri Sayım (6 Saniye)
  let countdown = 6;
  nextQTimerText.textContent = msg.is_last_question ? 
    `Final sonuçlarına geçiliyor: ${countdown}s` : 
    `Sonraki soruya geçiliyor: ${countdown}s`;

  clearInterval(state.resultCountdownInterval);
  state.resultCountdownInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      nextQTimerText.textContent = msg.is_last_question ? 
        `Final sonuçlarına geçiliyor: ${countdown}s` : 
        `Sonraki soruya geçiliyor: ${countdown}s`;
    } else {
      clearInterval(state.resultCountdownInterval);
      if (state.currentUser.isHost) {
        state.socket.send(JSON.stringify({ action: "next_question" }));
      }
    }
  }, 1000);

  showScreen("result");
}

// Host: Sonraki Soru Butonu
const btnNextQuestion = document.getElementById("btn-next-question");
if (btnNextQuestion) {
  btnNextQuestion.addEventListener("click", () => {
    clearInterval(state.resultCountdownInterval);
    if (state.socket && state.currentUser.isHost) {
      if (window.soundEffects) window.soundEffects.playClick();
      state.socket.send(JSON.stringify({ action: "next_question" }));
    }
  });
}

function renderLeaderboard(containerId, leaderboard) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  (leaderboard || []).forEach(player => {
    const item = document.createElement("div");
    const isMe = (player.id === state.currentUser.id);
    item.className = `lb-item ${isMe ? "is-me" : ""}`;

    let rankClass = "";
    if (player.rank === 1) rankClass = "gold";
    else if (player.rank === 2) rankClass = "silver";
    else if (player.rank === 3) rankClass = "bronze";

    const roundGainHtml = player.last_round_score > 0 ? 
      `<span class="lb-round-gain">+${player.last_round_score}</span>` : "";

    item.innerHTML = `
      <div class="lb-left">
        <span class="lb-rank ${rankClass}">#${player.rank}</span>
        <span>${player.name}${isMe ? " (Sen)" : ""}</span>
      </div>
      <div class="lb-score-box">
        ${roundGainHtml}
        <span class="lb-total-score">${player.score.toLocaleString()} P</span>
      </div>
    `;
    container.appendChild(item);
  });
}

// ========================================================
// 6. OYUN SONU (GAME OVER) KONTROLLERİ
// ========================================================
function handleGameOver(msg) {
  clearInterval(state.questionTimerInterval);
  clearInterval(state.resultCountdownInterval);

  // 1. Final Geçiş Vuruşu
  if (window.soundEffects) window.soundEffects.playGameOver();

  // 2. Şampiyon Açıklanma Fanfarı (Kısa gecikmeyle zafer coşkusu)
  setTimeout(() => {
    if (window.soundEffects) window.soundEffects.playWinnerAnnounced();
  }, 600);

  const leaderboard = msg.leaderboard || [];

  // Podyum 1, 2, 3
  const p1 = leaderboard[0];
  const p2 = leaderboard[1];
  const p3 = leaderboard[2];

  const fillPodium = (num, p) => {
    const nameElem = document.getElementById(`podium-name-${num}`);
    const scoreElem = document.getElementById(`podium-score-${num}`);
    const pillar = document.getElementById(`podium-pillar-${num}`);

    if (p) {
      nameElem.textContent = p.name;
      scoreElem.textContent = `${p.score.toLocaleString()} Puan`;
      pillar.style.visibility = "visible";
    } else {
      pillar.style.visibility = "hidden";
    }
  };

  fillPodium(1, p1);
  fillPodium(2, p2);
  fillPodium(3, p3);

  // Tam Listeyi Doldur
  renderLeaderboard("final-leaderboard-list", leaderboard);

  // Butonlar
  const btnPlayAgain = document.getElementById("btn-play-again");
  if (state.currentUser.isHost) {
    btnPlayAgain.style.display = "inline-flex";
  } else {
    btnPlayAgain.style.display = "none";
  }

  showScreen("gameOver");
}

// Host: Tekrar Oyna
const btnPlayAgain = document.getElementById("btn-play-again");
if (btnPlayAgain) {
  btnPlayAgain.addEventListener("click", () => {
    if (state.socket && state.currentUser.isHost) {
      if (window.soundEffects) window.soundEffects.playClick();
      state.socket.send(JSON.stringify({ action: "reset_to_lobby" }));
    }
  });
}

function handleReturnedToLobby() {
  state.currentUser.score = 0;
  showScreen("lobby");
}

// Ana Sayfaya Dön
const btnBackHome = document.getElementById("btn-back-home");
const navBrand = document.getElementById("nav-brand");

function goHome() {
  if (state.socket) {
    state.socket.close();
    state.socket = null;
  }
  clearInterval(state.questionTimerInterval);
  clearInterval(state.resultCountdownInterval);
  state.currentUser = { id: null, name: null, isHost: false, roomCode: null, score: 0 };
  showScreen("home");
}

if (btnBackHome) btnBackHome.addEventListener("click", goHome);
if (navBrand) navBrand.addEventListener("click", goHome);
