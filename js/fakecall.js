/**
 * KAVACH-X Fake Call Simulation System
 * Decoy incoming call interface with realistic synthesized ringtone
 */

const FakeCallController = {
  ringtoneInterval: null,
  audioCtx: null,
  callDurationSeconds: 0,
  callTimerInterval: null,
  isCallActive: false,

  init() {
    // Initiate Fake Call Trigger Buttons
    const triggerBtns = document.querySelectorAll(".btn-trigger-fake-call");
    triggerBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const callerNameInput = document.getElementById("fake-caller-name-input");
        const delaySelect = document.getElementById("fake-call-delay-select");
        const callerName = (callerNameInput && callerNameInput.value.trim()) ? callerNameInput.value.trim() : "Dad (Urgent)";
        const delaySeconds = delaySelect ? parseInt(delaySelect.value, 10) : 0;

        if (delaySeconds > 0) {
          KavachApp.showToast(`Fake call scheduled in ${delaySeconds} seconds. Lock or keep screen ready.`, "info");
          setTimeout(() => this.startIncomingCall(callerName), delaySeconds * 1000);
        } else {
          this.startIncomingCall(callerName);
        }
      });
    });

    // Answer & Reject Buttons
    const answerBtn = document.getElementById("btn-fake-call-answer");
    const rejectBtn = document.getElementById("btn-fake-call-reject");

    if (answerBtn) {
      answerBtn.addEventListener("click", () => this.answerCall());
    }
    if (rejectBtn) {
      rejectBtn.addEventListener("click", () => this.endCall());
    }
  },

  playRingtoneBeep() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.audioCtx.state === "suspended") this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = "sine";
      // Dual phone ring tone frequency
      osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.frequency.setValueAtTime(480, this.audioCtx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.9);
      osc.stop(this.audioCtx.currentTime + 0.95);
    } catch (e) {
      console.warn("Ringtone synthesizer note:", e);
    }
  },

  startIncomingCall(callerName) {
    const overlay = document.getElementById("fake-call-overlay");
    if (!overlay) return;

    const callerEl = document.getElementById("fake-call-name-display");
    const statusEl = document.getElementById("fake-call-status-display");
    const answerBtn = document.getElementById("btn-fake-call-answer");

    if (callerEl) callerEl.innerText = callerName;
    if (statusEl) statusEl.innerText = "Incoming Call...";
    if (answerBtn) answerBtn.style.display = "flex";

    overlay.classList.add("active");
    this.isCallActive = true;

    // Start ringtone loop
    this.playRingtoneBeep();
    this.ringtoneInterval = setInterval(() => {
      this.playRingtoneBeep();
    }, 2800);
  },

  answerCall() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }

    const statusEl = document.getElementById("fake-call-status-display");
    const answerBtn = document.getElementById("btn-fake-call-answer");
    if (answerBtn) answerBtn.style.display = "none";

    this.callDurationSeconds = 0;
    this.callTimerInterval = setInterval(() => {
      this.callDurationSeconds++;
      const mins = String(Math.floor(this.callDurationSeconds / 60)).padStart(2, "0");
      const secs = String(this.callDurationSeconds % 60).padStart(2, "0");
      if (statusEl) statusEl.innerText = `Connected ${mins}:${secs}`;
    }, 1000);

    KavachApp.showToast("Call connected. Speak aloud to deter nearby threats.", "info");
  },

  endCall() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }

    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = null;
    }

    this.isCallActive = false;
    const overlay = document.getElementById("fake-call-overlay");
    if (overlay) {
      overlay.classList.remove("active");
    }

    KavachApp.showToast("Call Ended.", "info");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  FakeCallController.init();
});
