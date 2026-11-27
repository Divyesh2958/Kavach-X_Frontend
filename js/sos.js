/**
 * KAVACH-X Emergency SOS Controller
 * Handles Black Screen Mode, Geolocation, SMS Alert Dispatch, and Status
 */

const SOSController = {
  currentLocation: {
    latitude: null,
    longitude: null,
    address: null
  },

  init() {
    this.bindEvents();
    this.requestLocationPassive();
  },

  // Passively acquire location coordinates so they are ready if SOS is pressed
  requestLocationPassive() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.currentLocation.latitude = pos.coords.latitude;
          this.currentLocation.longitude = pos.coords.longitude;
          const locText = `Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`;
          const badgeEl = document.getElementById("sos-location-text");
          if (badgeEl) badgeEl.innerText = locText;
        },
        (err) => {
          console.warn("Passive geolocation note:", err.message);
          const badgeEl = document.getElementById("sos-location-text");
          if (badgeEl) badgeEl.innerText = "Location access requested on SOS";
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  },

  bindEvents() {
    const sosTriggerBtns = document.querySelectorAll(".btn-trigger-sos");
    sosTriggerBtns.forEach(btn => {
      btn.addEventListener("click", () => this.handleSOSTrigger());
    });

    // Black screen exit mechanism
    const exitBtn = document.getElementById("btn-exit-stealth-mode");
    if (exitBtn) {
      exitBtn.addEventListener("click", () => this.exitStealthMode());
    }

    // Keyboard shortcut ESC to exit stealth mode
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.getElementById("emergency-black-screen")?.classList.contains("active")) {
        this.exitStealthMode();
      }
    });
  },

  // Turn screen black and show stealth HUD
  enterStealthMode() {
    const overlay = document.getElementById("emergency-black-screen");
    if (overlay) {
      overlay.classList.add("active");
      const statusText = document.getElementById("black-screen-status");
      if (statusText) statusText.innerText = "Acquiring GPS coordinates & dispatching alerts...";
    }
  },

  exitStealthMode() {
    const overlay = document.getElementById("emergency-black-screen");
    if (overlay) {
      overlay.classList.remove("active");
    }
  },

  async handleSOSTrigger() {
    const isAuth = KavachApp.isAuthenticated();

    let guestPhone = null;
    if (!isAuth) {
      const guestPhoneInput = document.getElementById("guest-emergency-phone");
      guestPhone = guestPhoneInput ? guestPhoneInput.value.trim() : null;
      if (!guestPhone) {
        KavachApp.showToast("Please enter an emergency contact phone number for guest SOS dispatch.", "warning");
        if (guestPhoneInput) guestPhoneInput.focus();
        return;
      }
    }

    // 1. Immediately activate emergency stealth black screen mode
    this.enterStealthMode();

    // 2. Refresh active location if possible without blocking SOS
    try {
      if ("geolocation" in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              this.currentLocation.latitude = pos.coords.latitude;
              this.currentLocation.longitude = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 4000 }
          );
        });
      }
    } catch (e) {
      console.warn("Geolocation prompt skipped or timed out:", e);
    }

    // Update black screen status
    const blackScreenStatus = document.getElementById("black-screen-status");
    if (blackScreenStatus) {
      blackScreenStatus.innerText = "Sending encrypted emergency alert to trusted contacts...";
    }

    // 3. Dispatch SOS to backend
    try {
      const payload = {
        latitude: this.currentLocation.latitude,
        longitude: this.currentLocation.longitude,
        location_address: this.currentLocation.address || (this.currentLocation.latitude ? `GPS (${this.currentLocation.latitude.toFixed(5)}, ${this.currentLocation.longitude.toFixed(5)})` : "Location Coordinates Unavailable"),
        guest_phone: guestPhone,
        emergency_type: "RAPID_SOS"
      };

      const response = await KavachApp.apiRequest("/sos/trigger", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      // Update Black Screen HUD
      if (blackScreenStatus) {
        const recipientsList = response.dispatched_to.length > 0
          ? response.dispatched_to.join(", ")
          : (isAuth ? "All verified contacts" : guestPhone);

        blackScreenStatus.innerHTML = `
          <div class="text-success fw-bold mb-2">
            <i class="bi bi-shield-check fs-4 d-block mb-1"></i>
            EMERGENCY ALERT DISPATCHED
          </div>
          <div class="small text-light">Status: <span class="badge bg-danger">${response.sms_status}</span> via ${response.sms_provider}</div>
          <div class="small text-white-50 mt-1">Notified: ${recipientsList}</div>
          ${response.google_maps_link ? `<div class="small text-info mt-2"><a href="${response.google_maps_link}" target="_blank" class="text-info text-decoration-none"><i class="bi bi-geo-alt"></i> Live Tracking Map Link Attached</a></div>` : ''}
        `;
      }

      KavachApp.showToast(`SOS Dispatched! ${response.message}`, "error", 8000);

      // Trigger automatic live status banner if on dashboard
      const sosStatusCard = document.getElementById("dashboard-active-sos-alert");
      if (sosStatusCard) {
        sosStatusCard.classList.remove("d-none");
        sosStatusCard.scrollIntoView({ behavior: "smooth" });
      }

    } catch (err) {
      console.error("SOS dispatch failure:", err);
      if (blackScreenStatus) {
        blackScreenStatus.innerHTML = `
          <div class="text-danger fw-bold mb-2">
            <i class="bi bi-exclamation-triangle fs-4 d-block mb-1"></i>
            ALERT NOTIFICATION NOTICE
          </div>
          <div class="small text-light">${err.message}</div>
        `;
      }
      KavachApp.showToast(`SOS Error: ${err.message}`, "error", 8000);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  SOSController.init();
});
