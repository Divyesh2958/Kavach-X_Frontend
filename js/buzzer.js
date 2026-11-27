/**
 * KAVACH-X Emergency Alarm Buzzer
 * High-intensity acoustic deterrent synthesizer using Web Audio API
 * Fully independent: does NOT trigger SOS or send SMS
 */

const BuzzerController = {
  audioCtx: null,
  oscillator1: null,
  oscillator2: null,
  gainNode: null,
  isPlaying: false,
  sirenInterval: null,

  init() {
    const toggleBtns = document.querySelectorAll(".btn-toggle-buzzer");
    toggleBtns.forEach(btn => {
      btn.addEventListener("click", () => this.toggleBuzzer());
    });
  },

  toggleBuzzer() {
    if (this.isPlaying) {
      this.stopAlarm();
    } else {
      this.startAlarm();
    }
  },

  startAlarm() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }

      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      // Main sound oscillator
      this.oscillator1 = this.audioCtx.createOscillator();
      this.oscillator2 = this.audioCtx.createOscillator();
      this.gainNode = this.audioCtx.createGain();

      this.oscillator1.type = "sawtooth";
      this.oscillator2.type = "sine";

      // Dual-tone piercing frequency
      this.oscillator1.frequency.setValueAtTime(850, this.audioCtx.currentTime);
      this.oscillator2.frequency.setValueAtTime(855, this.audioCtx.currentTime);

      // Volume envelope
      this.gainNode.gain.setValueAtTime(0.85, this.audioCtx.currentTime);

      this.oscillator1.connect(this.gainNode);
      this.oscillator2.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      this.oscillator1.start();
      this.oscillator2.start();
      this.isPlaying = true;

      // Alternating high-low police/emergency siren sweep
      let highTone = false;
      this.sirenInterval = setInterval(() => {
        if (!this.isPlaying || !this.audioCtx) return;
        const targetFreq = highTone ? 850 : 1300;
        this.oscillator1.frequency.exponentialRampToValueAtTime(targetFreq, this.audioCtx.currentTime + 0.25);
        this.oscillator2.frequency.exponentialRampToValueAtTime(targetFreq + 8, this.audioCtx.currentTime + 0.25);
        highTone = !highTone;
      }, 350);

      this.updateButtonUI(true);
      KavachApp.showToast("LOUD EMERGENCY BUZZER ACTIVATED", "error");

    } catch (err) {
      console.error("Web Audio alarm exception:", err);
      KavachApp.showToast("Could not activate audio siren in this browser context.", "warning");
    }
  },

  stopAlarm() {
    if (this.sirenInterval) {
      clearInterval(this.sirenInterval);
      this.sirenInterval = null;
    }

    if (this.oscillator1) {
      try { this.oscillator1.stop(); this.oscillator1.disconnect(); } catch (e) {}
      this.oscillator1 = null;
    }

    if (this.oscillator2) {
      try { this.oscillator2.stop(); this.oscillator2.disconnect(); } catch (e) {}
      this.oscillator2 = null;
    }

    this.isPlaying = false;
    this.updateButtonUI(false);
    KavachApp.showToast("Alarm Buzzer Silenced.", "info");
  },

  updateButtonUI(active) {
    const toggleBtns = document.querySelectorAll(".btn-toggle-buzzer");
    toggleBtns.forEach(btn => {
      if (active) {
        btn.classList.remove("btn-outline-danger", "btn-warning");
        btn.classList.add("btn-danger");
        btn.innerHTML = '<i class="bi bi-volume-mute-fill fs-5 me-2"></i><strong>STOP ALARM</strong>';
        btn.style.animation = "pulseDot 0.8s infinite";
      } else {
        btn.classList.remove("btn-danger");
        btn.classList.add("btn-warning");
        btn.innerHTML = '<i class="bi bi-megaphone-fill fs-5 me-2"></i><strong>LOUD BUZZER</strong>';
        btn.style.animation = "none";
      }
    });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  BuzzerController.init();
});
