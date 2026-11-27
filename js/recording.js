/**
 * KAVACH-X Emergency Audio Recording Controller
 * Uses MediaRecorder API to securely capture ambient audio evidence
 */

const RecordingController = {
  mediaRecorder: null,
  audioChunks: [],
  recordingStartTime: null,
  timerInterval: null,
  isRecording: false,
  currentAudioBlob: null,

  init() {
    const startBtn = document.getElementById("btn-start-recording");
    const stopBtn = document.getElementById("btn-stop-recording");
    const downloadBtn = document.getElementById("btn-download-recording");
    const saveVaultBtn = document.getElementById("btn-save-vault-recording");

    if (startBtn) startBtn.addEventListener("click", () => this.startRecording());
    if (stopBtn) stopBtn.addEventListener("click", () => this.stopRecording());
    if (downloadBtn) downloadBtn.addEventListener("click", () => this.downloadRecording());
    if (saveVaultBtn) saveVaultBtn.addEventListener("click", () => this.saveToVault());

    // If on dashboard and authenticated, load user's saved audio recordings
    if (KavachApp.isAuthenticated() && document.getElementById("vault-recordings-list")) {
      this.loadUserRecordings();
    }
  },

  async startRecording() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Audio recording is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
        ? "audio/webm;codecs=opus" 
        : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "");

      this.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const mime = this.mediaRecorder.mimeType || "audio/webm";
        this.currentAudioBlob = new Blob(this.audioChunks, { type: mime });
        this.handleRecordingFinished();
        // Stop stream tracks
        stream.getTracks().forEach(t => t.stop());
      };

      this.mediaRecorder.start(250); // Slice every 250ms
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // UI state
      document.getElementById("btn-start-recording")?.classList.add("d-none");
      document.getElementById("btn-stop-recording")?.classList.remove("d-none");
      document.getElementById("recording-status-dot")?.classList.remove("d-none");
      document.getElementById("audio-playback-container")?.classList.add("d-none");

      // Start live timer
      const timerDisplay = document.getElementById("recording-timer-display");
      this.timerInterval = setInterval(() => {
        const elapsedSecs = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const mins = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
        const secs = String(elapsedSecs % 60).padStart(2, "0");
        if (timerDisplay) timerDisplay.innerText = `${mins}:${secs}`;
      }, 1000);

      KavachApp.showToast("Microphone active: Recording emergency audio evidence...", "error");

    } catch (err) {
      console.error("Audio recording permission error:", err);
      KavachApp.showToast(`Microphone Access Denied: ${err.message}`, "error");
    }
  },

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      document.getElementById("btn-stop-recording")?.classList.add("d-none");
      document.getElementById("btn-start-recording")?.classList.remove("d-none");
      document.getElementById("recording-status-dot")?.classList.add("d-none");
    }
  },

  handleRecordingFinished() {
    if (!this.currentAudioBlob) return;

    const audioUrl = URL.createObjectURL(this.currentAudioBlob);
    const audioPlayer = document.getElementById("recording-audio-preview");
    const playbackContainer = document.getElementById("audio-playback-container");

    if (audioPlayer) {
      audioPlayer.src = audioUrl;
    }
    if (playbackContainer) {
      playbackContainer.classList.remove("d-none");
    }

    KavachApp.showToast("Recording saved. You can now preview, download or upload to vault.", "success");
  },

  downloadRecording() {
    if (!this.currentAudioBlob) {
      KavachApp.showToast("No active audio recording to download.", "warning");
      return;
    }

    const a = document.createElement("a");
    a.href = URL.createObjectURL(this.currentAudioBlob);
    a.download = `KavachX_Evidence_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    KavachApp.showToast("Audio recording downloaded to your device.", "info");
  },

  async saveToVault() {
    if (!this.currentAudioBlob) return;

    const saveBtn = document.getElementById("btn-save-vault-recording");
    const durationSec = this.recordingStartTime ? (Date.now() - this.recordingStartTime) / 1000 : 0.0;

    const formData = new FormData();
    formData.append("file", this.currentAudioBlob, `recording_${Date.now()}.webm`);
    formData.append("duration", durationSec.toFixed(1));

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
      }

      const res = await KavachApp.apiRequest("/recordings", {
        method: "POST",
        body: formData
      });

      KavachApp.showToast(res.message, "success");
      if (KavachApp.isAuthenticated()) {
        this.loadUserRecordings();
      }
    } catch (err) {
      KavachApp.showToast(`Vault upload failed: ${err.message}`, "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i>Save to Vault';
      }
    }
  },

  async loadUserRecordings() {
    const listEl = document.getElementById("vault-recordings-list");
    if (!listEl) return;

    try {
      const recordings = await KavachApp.apiRequest("/recordings");
      if (recordings.length === 0) {
        listEl.innerHTML = `<div class="text-muted small text-center py-3">No audio evidence recordings saved yet.</div>`;
        return;
      }

      listEl.innerHTML = recordings.map(r => `
        <div class="d-flex align-items-center justify-content-between p-2 border-bottom">
          <div>
            <div class="fw-bold small text-dark"><i class="bi bi-file-earmark-music me-1 text-danger"></i> ${r.file_name || 'Evidence Clip'}</div>
            <div class="text-muted" style="font-size:0.75rem;">
              ${new Date(r.created_at).toLocaleString()} | ${(r.file_size / 1024).toFixed(1)} KB | ${r.duration}s
            </div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <audio controls src="${API_BASE.replace('/api', '')}${r.audio_url}" style="height:32px; width:180px;"></audio>
            <button class="btn btn-sm btn-outline-danger" onclick="RecordingController.deleteRecording(${r.id})">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `).join("");
    } catch (err) {
      console.warn("Could not load user recordings:", err);
    }
  },

  async deleteRecording(id) {
    if (!confirm("Are you sure you want to delete this audio recording?")) return;
    try {
      await KavachApp.apiRequest(`/recordings/${id}`, { method: "DELETE" });
      KavachApp.showToast("Recording deleted.", "info");
      this.loadUserRecordings();
    } catch (err) {
      KavachApp.showToast(err.message, "error");
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  RecordingController.init();
});
