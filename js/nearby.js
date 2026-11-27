/**
 * KAVACH-X Nearby Assistance & Community Volunteer Controller
 */

const NearbyAssistanceController = {
  currentLat: 28.6139,
  currentLng: 77.2090,

  init() {
    this.detectLocationAndLoad();
    this.bindEvents();
  },

  detectLocationAndLoad() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.currentLat = pos.coords.latitude;
          this.currentLng = pos.coords.longitude;
          this.loadPoliceStations();
          this.loadVolunteers();
        },
        () => {
          // Default regional load
          this.loadPoliceStations();
          this.loadVolunteers();
        }
      );
    } else {
      this.loadPoliceStations();
      this.loadVolunteers();
    }
  },

  bindEvents() {
    const regVolunteerForm = document.getElementById("register-volunteer-form");
    if (regVolunteerForm) {
      regVolunteerForm.addEventListener("submit", (e) => this.handleRegisterVolunteer(e));
    }
  },

  async loadPoliceStations() {
    const container = document.getElementById("nearby-police-container");
    if (!container) return;

    try {
      container.innerHTML = `<div class="text-center py-3"><span class="spinner-border spinner-border-sm text-primary"></span> Locating verified police stations...</div>`;
      const data = await KavachApp.apiRequest(
        `/location/police-stations?lat=${this.currentLat}&lng=${this.currentLng}&radius=12`
      );

      if (!data.police_stations || data.police_stations.length === 0) {
        container.innerHTML = `<div class="text-muted small text-center py-3">No police stations returned in this radius. Emergency Helpline: 112</div>`;
        return;
      }

      container.innerHTML = data.police_stations.map(st => `
        <div class="police-card">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <div class="fw-bold text-dark fs-6">${st.name}</div>
            <span class="badge bg-light text-dark border">${st.distance_km} km away</span>
          </div>
          <div class="small text-muted mb-2"><i class="bi bi-geo-alt me-1 text-danger"></i>${st.address}</div>
          <div class="d-flex gap-2">
            <a href="tel:${st.phone}" class="btn btn-sm btn-outline-danger">
              <i class="bi bi-telephone-fill me-1"></i>Call (${st.phone})
            </a>
            <a href="${st.map_url}" target="_blank" class="btn btn-sm btn-outline-secondary">
              <i class="bi bi-map me-1"></i>Directions
            </a>
          </div>
        </div>
      `).join("");

    } catch (err) {
      container.innerHTML = `<div class="alert alert-warning small">Could not load live police stations: ${err.message}. National Police Helpline: 112</div>`;
    }
  },

  async loadVolunteers() {
    const container = document.getElementById("nearby-volunteers-container");
    if (!container) return;

    try {
      container.innerHTML = `<div class="text-center py-3"><span class="spinner-border spinner-border-sm text-success"></span> Finding active safety volunteers...</div>`;
      const volunteers = await KavachApp.apiRequest(
        `/volunteers/nearby?lat=${this.currentLat}&lng=${this.currentLng}`
      );

      if (volunteers.length === 0) {
        container.innerHTML = `
          <div class="text-center text-muted py-3">
            <i class="bi bi-shield-heart fs-3 d-block mb-1 text-muted"></i>
            No community volunteers registered in this specific area yet. 
            <a href="#" data-bs-toggle="modal" data-bs-target="#volunteerRegisterModal" class="d-block mt-1 text-primary">Join as a Safety Volunteer</a>
          </div>
        `;
        return;
      }

      container.innerHTML = volunteers.map(v => `
        <div class="card mb-2 border-0 shadow-sm">
          <div class="card-body p-3 d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-bold text-dark">${v.name} <span class="badge bg-success-subtle text-success small ms-1"><i class="bi bi-check-circle-fill me-1"></i>Verified Volunteer</span></div>
              <div class="small text-muted"><i class="bi bi-geo-alt me-1"></i>${v.area} ${v.distance_km !== null ? `&bull; ${v.distance_km} km away` : ''}</div>
            </div>
            <a href="tel:${v.phone}" class="btn btn-sm btn-success">
              <i class="bi bi-telephone-fill me-1"></i>Contact
            </a>
          </div>
        </div>
      `).join("");

    } catch (err) {
      container.innerHTML = `<div class="alert alert-light small text-muted">Volunteers directory unavailable: ${err.message}</div>`;
    }
  },

  async handleRegisterVolunteer(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    const name = document.getElementById("vol-name").value.trim();
    const phone = document.getElementById("vol-phone").value.trim();
    const area = document.getElementById("vol-area").value.trim();

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Submitting...';

      await KavachApp.apiRequest("/volunteers/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone,
          area,
          latitude: this.currentLat,
          longitude: this.currentLng
        })
      });

      KavachApp.showToast("Volunteer application submitted! An admin will review and verify your profile.", "success");

      // Hide modal
      const modalEl = document.getElementById("volunteerRegisterModal");
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      e.target.reset();
    } catch (err) {
      KavachApp.showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Register as Safety Volunteer';
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  NearbyAssistanceController.init();
});
