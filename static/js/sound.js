/**
 * QuizLive Profesyonel Yarışma Programı Ses Motoru (Web Audio API)
 * =================================================================
 * Harici dosya/telif bağımlılığı olmadan, tarayıcının Web Audio API'si ile
 * "Kim Milyoner Olmak İster" benzeri gerilimli, dramatik ve heyecan verici
 * yarışma programı atmosferi oluşturan özgün ses sentezleyicisi.
 */

class SoundEffects {
  constructor() {
    this.audioCtx = null;
    this.muted = false;
  }

  _initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // 1. Genel Buton Tıklama
  playClick() {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // 2. Oyuncu Lobiye Katıldığında
  playPlayerJoined() {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Sıcak iki tonlu karşılama zili (F5 -> C6)
    const tones = [698.46, 1046.5];
    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.18, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.28);
    });
  }

  // 3. Oyun Başladığında (Sinematik Başlangıç Gongu & Brass Stinger)
  playGameStart() {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Derin sub-bass darbesi
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(90, now);
    subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.7);

    subGain.gain.setValueAtTime(0.35, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.7);

    // Yükselen dramatik stinger akoru
    const freqs = [130.81, 196.0, 261.63, 392.0]; // C3, G3, C4, G4
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(250, now);
      filter.frequency.exponentialRampToValueAtTime(1600, now + 0.4);
      filter.frequency.exponentialRampToValueAtTime(400, now + 1.2);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.2);
    });
  }

  // 4. Soru Gösterildiğinde (Gerilimli Soru Akoru / Tension Cue)
  playQuestionReveal() {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // C minör gerilim stinger'ı: C2 + G2 + Eb3
    const chord = [65.41, 98.0, 155.56, 311.13];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = idx === 0 ? "sine" : "sawtooth";
      osc.frequency.setValueAtTime(freq, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(180, now);
      filter.frequency.exponentialRampToValueAtTime(850, now + 0.3);
      filter.frequency.exponentialRampToValueAtTime(300, now + 1.0);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.1);
    });
  }

  // 5. Geri Sayım Sırasında (Dramatik Kalp Atışı & Saat Tıkırtısı)
  playCountdownTick(remainingSec) {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const isUrgent = remainingSec <= 5;

    // 1. Darbe: Kalp Atışı (Lub)
    const heartOsc = ctx.createOscillator();
    const heartGain = ctx.createGain();
    heartOsc.type = "sine";
    heartOsc.frequency.setValueAtTime(isUrgent ? 85 : 60, now);
    heartOsc.frequency.exponentialRampToValueAtTime(35, now + 0.09);

    heartGain.gain.setValueAtTime(isUrgent ? 0.35 : 0.2, now);
    heartGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    heartOsc.connect(heartGain);
    heartGain.connect(ctx.destination);
    heartOsc.start(now);
    heartOsc.stop(now + 0.09);

    // 2. Darbe: Metalik Saat Tıkırtısı
    const tickOsc = ctx.createOscillator();
    const tickGain = ctx.createGain();
    tickOsc.type = "triangle";
    tickOsc.frequency.setValueAtTime(isUrgent ? 1200 : 750, now);
    tickGain.gain.setValueAtTime(isUrgent ? 0.18 : 0.08, now);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    tickOsc.connect(tickGain);
    tickGain.connect(ctx.destination);
    tickOsc.start(now);
    tickOsc.stop(now + 0.04);

    // Son 5 saniyede ikinci bir kalp atışı (Dub)
    if (isUrgent) {
      const dubOsc = ctx.createOscillator();
      const dubGain = ctx.createGain();
      dubOsc.type = "sine";
      dubOsc.frequency.setValueAtTime(70, now + 0.12);
      dubOsc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

      dubGain.gain.setValueAtTime(0.25, now + 0.12);
      dubGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      dubOsc.connect(dubGain);
      dubGain.connect(ctx.destination);
      dubOsc.start(now + 0.12);
      dubOsc.stop(now + 0.2);
    }
  }

  // 6. Cevap Seçildiğinde (Son Karar / Kilitlenme Sesi - Lock In)
  playAnswerSelected() {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Keskin mekanik mandal tıklaması
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = "sawtooth";
    clickOsc.frequency.setValueAtTime(950, now);
    clickOsc.frequency.exponentialRampToValueAtTime(220, now + 0.05);

    clickGain.gain.setValueAtTime(0.25, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.05);

    // Tok alt rezonans cevabı (Kararın onaylandığı hissi)
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = "sine";
    boomOsc.frequency.setValueAtTime(140, now + 0.02);
    boomOsc.frequency.exponentialRampToValueAtTime(60, now + 0.35);

    boomGain.gain.setValueAtTime(0.22, now + 0.02);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);
    boomOsc.start(now + 0.02);
    boomOsc.stop(now + 0.35);
  }

  // 7. Doğru Cevap Verildiğinde (Görkemli Zafer Akoru)
  playCorrect() {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // C Majör zafer fanfarı: C4 -> G4 -> C5 -> E5 -> G5 -> C6
    const notes = [
      { f: 261.63, t: 0.0 },
      { f: 392.0,  t: 0.08 },
      { f: 523.25, t: 0.16 },
      { f: 659.25, t: 0.24 },
      { f: 783.99, t: 0.32 },
      { f: 1046.5, t: 0.40 }
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(note.f, now + note.t);

      gain.gain.setValueAtTime(0.22, now + note.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.t);
      osc.stop(now + note.t + 0.45);
    });

    // Sıcak alt pad akoru
    [261.63, 329.63, 392.0, 523.25].forEach(freq => {
      const padOsc = ctx.createOscillator();
      const padGain = ctx.createGain();
      padOsc.type = "sine";
      padOsc.frequency.setValueAtTime(freq, now + 0.4);

      padGain.gain.setValueAtTime(0.12, now + 0.4);
      padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      padOsc.connect(padGain);
      padGain.connect(ctx.destination);
      padOsc.start(now + 0.4);
      padOsc.stop(now + 1.2);
    });
  }

  // 8. Yanlış Cevap Verildiğinde (Dramatik Hayal Kırıklığı / Tension Drop)
  playWrong() {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Düşen uyumsuz (dissonant) frekans kayması
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.linearRampToValueAtTime(115, now + 0.5);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.5);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);

    // Derin pes uğultu
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(58, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.6);

    subGain.gain.setValueAtTime(0.3, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.6);
  }

  // 9. Soru Süresi Bittiğinde (Tok Süre Doldu Gongu)
  playTimeUp() {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Tok çan/gong zili (220Hz -> 110Hz)
    const gong = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    gong.type = "sawtooth";
    gong.frequency.setValueAtTime(220, now);
    gong.frequency.exponentialRampToValueAtTime(110, now + 0.7);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.7);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    gong.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gong.start(now);
    gong.stop(now + 0.7);
  }

  // 10. Skor / Puan Açıklandığında (Puan Sayma Işıltısı - Score Rollup)
  playScoreReveal() {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Hızlı yükselen pentatonik kristal çanlar
    const arpeggio = [587.33, 739.99, 880.0, 987.77, 1174.66, 1479.98];
    arpeggio.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.18, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.25);
    });
  }

  // 11. Oyun Sona Erdiğinde (Dramatik Final Vuruşu & Riser)
  playGameOver() {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Derin timpani vuruşu
    const drum = ctx.createOscillator();
    const drumGain = ctx.createGain();
    drum.type = "sine";
    drum.frequency.setValueAtTime(120, now);
    drum.frequency.exponentialRampToValueAtTime(40, now + 0.8);

    drumGain.gain.setValueAtTime(0.4, now);
    drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    drum.connect(drumGain);
    drumGain.connect(ctx.destination);
    drum.start(now);
    drum.stop(now + 0.8);

    // Yükselen gerilim stinger'ı
    const stinger = ctx.createOscillator();
    const stingerGain = ctx.createGain();
    stinger.type = "triangle";
    stinger.frequency.setValueAtTime(196, now);
    stinger.frequency.exponentialRampToValueAtTime(523.25, now + 0.6);

    stingerGain.gain.setValueAtTime(0.1, now);
    stingerGain.gain.linearRampToValueAtTime(0.22, now + 0.5);
    stingerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    stinger.connect(stingerGain);
    stingerGain.connect(ctx.destination);
    stinger.start(now);
    stinger.stop(now + 0.9);
  }

  // 12. Kazanan / Şampiyon Açıklandığında (Büyük Şampiyon Fanfarı)
  playWinnerAnnounced() {
    if (this.muted) return;
    this._initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Şampiyonluk Fanfarı
    const fanfareMelody = [
      { f: 392.0,  d: 0.12, t: 0.0 },   // G4
      { f: 523.25, d: 0.12, t: 0.14 },  // C5
      { f: 659.25, d: 0.12, t: 0.28 },  // E5
      { f: 783.99, d: 0.24, t: 0.42 },  // G5
      { f: 659.25, d: 0.14, t: 0.70 },  // E5
      { f: 783.99, d: 0.14, t: 0.86 },  // G5
      { f: 1046.5, d: 0.65, t: 1.02 }   // C6 (Triumphant Climax)
    ];

    fanfareMelody.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(note.f, now + note.t);

      gain.gain.setValueAtTime(0.25, now + note.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2200, now + note.t);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.t);
      osc.stop(now + note.t + note.d);
    });
  }
}

window.soundEffects = new SoundEffects();
