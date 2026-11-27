/**
 * KAVACH-X Safe Navigation & Route Advisory Controller
 * Interactive Leaflet Map & Safety Corridor Evaluation
 */

const SafeRoutesController = {
  map: null,
  markersLayer: null,
  routePolyline: null,
  userLocation: { lat: 28.6139, lng: 77.2090 }, // Default fallback to Delhi Central

  init() {
    this.acquireLocation();
    this.bindEvents();
  },

  acquireLocation() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userLocation.lat = pos.coords.latitude;
          this.userLocation.lng = pos.coords.longitude;
          const originInput = document.getElementById("route-origin-display");
          if (originInput) {
            originInput.value = `Current Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
          }
          if (this.map) {
            this.map.setView([this.userLocation.lat, this.userLocation.lng], 13);
          }
        },
        () => console.warn("Location permission default kept.")
      );
    }
  },

  initMap() {
    const mapContainer = document.getElementById("safe-route-map");
    if (!mapContainer || this.map) return;

    // Initialize Leaflet map
    this.map = L.map("safe-route-map").setView([this.userLocation.lat, this.userLocation.lng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);

    // Initial user marker
    L.marker([this.userLocation.lat, this.userLocation.lng])
      .addTo(this.markersLayer)
      .bindPopup("<strong>Your Current Location</strong>")
      .openPopup();
  },

  bindEvents() {
    const routeForm = document.getElementById("safe-route-form");
    if (routeForm) {
      routeForm.addEventListener("submit", (e) => this.handleCalculateRoutes(e));
    }
  },

  async handleCalculateRoutes(e) {
    e.preventDefault();
    this.initMap();

    const destInput = document.getElementById("route-destination-input");
    const destination = destInput ? destInput.value.trim() : "";
    if (!destination) return;

    const submitBtn = e.target.querySelector("button[type='submit']");
    const resultsContainer = document.getElementById("route-options-container");
    const disclaimerContainer = document.getElementById("route-disclaimer-box");

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Analyzing Corridors...';

      const data = await KavachApp.apiRequest(
        `/location/routes?origin_lat=${this.userLocation.lat}&origin_lng=${this.userLocation.lng}&destination=${encodeURIComponent(destination)}`
      );

      // Render disclaimer
      if (disclaimerContainer) {
        disclaimerContainer.innerHTML = `
          <div class="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-3">
            <i class="bi bi-shield-exclamation fs-5 flex-shrink-0 text-dark"></i>
            <div>${data.safety_disclaimer}</div>
          </div>
        `;
      }

      // Render Route Cards
      if (resultsContainer) {
        resultsContainer.innerHTML = data.routes.map((r, idx) => `
          <div class="card mb-3 border ${idx === 0 ? 'border-success' : 'border-secondary'} shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="card-title fw-bold text-dark mb-0">
                  ${idx === 0 ? '<span class="badge bg-success me-1">Recommended</span>' : ''}
                  ${r.title}
                </h6>
                <span class="badge ${idx === 0 ? 'bg-success' : 'bg-secondary'} fs-6">
                  Safety: ${r.safety_score}%
                </span>
              </div>
              <p class="small text-muted mb-2">${r.description}</p>
              <div class="d-flex gap-3 small fw-bold text-dark mb-3">
                <div><i class="bi bi-pin-map text-primary"></i> ${r.distance_km} km</div>
                <div><i class="bi bi-clock text-primary"></i> approx. ${r.estimated_time_minutes} mins</div>
              </div>
              <div class="small mb-3">
                ${r.safety_features.map(f => `<span class="badge bg-light text-dark border me-1 mb-1"><i class="bi bi-check-circle text-success me-1"></i>${f}</span>`).join("")}
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-primary" onclick="SafeRoutesController.displayRouteOnMap(${idx}, ${JSON.stringify(r.waypoints).replace(/"/g, '&quot;')})">
                  <i class="bi bi-map me-1"></i>View on Map
                </button>
                <a href="${data.navigation_links.google_maps}" target="_blank" class="btn btn-sm btn-outline-secondary">
                  <i class="bi bi-box-arrow-up-right me-1"></i>Open Google Maps
                </a>
              </div>
            </div>
          </div>
        `).join("");
      }

      // Draw primary route on map
      if (data.routes.length > 0) {
        this.displayRouteOnMap(0, data.routes[0].waypoints, data.police_stations_along_path);
      }

    } catch (err) {
      KavachApp.showToast(`Route advisory error: ${err.message}`, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-compass me-1"></i>Find Safe Route';
    }
  },

  displayRouteOnMap(routeIndex, waypoints, policeStations = []) {
    if (!this.map) return;
    this.markersLayer.clearLayers();

    const latLngs = waypoints.map(wp => [wp.lat, wp.lng]);

    // Draw route line
    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
    }
    const routeColor = routeIndex === 0 ? "#2a9d8f" : "#457b9d";
    this.routePolyline = L.polyline(latLngs, { color: routeColor, weight: 6, opacity: 0.85 }).addTo(this.map);

    // Add Waypoint markers
    waypoints.forEach((wp, i) => {
      const isStart = i === 0;
      const isEnd = i === waypoints.length - 1;
      const markerText = isStart ? "Origin" : (isEnd ? wp.name : `Waypoint: ${wp.name}`);
      L.marker([wp.lat, wp.lng])
        .addTo(this.markersLayer)
        .bindPopup(`<strong>${markerText}</strong>`);
    });

    // Add police station checkpoints
    policeStations.forEach(st => {
      const policeIcon = L.divIcon({
        className: 'custom-police-icon',
        html: '<div style="background:#1b263b; color:#fff; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:13px; border:2px solid #fff;"><i class="bi bi-shield-fill"></i></div>',
        iconSize: [26, 26]
      });

      L.marker([st.latitude, st.longitude], { icon: policeIcon })
        .addTo(this.markersLayer)
        .bindPopup(`<strong>${st.name}</strong><br><small>${st.address}</small><br><a href="tel:${st.phone}" class="btn btn-xs btn-outline-danger mt-1">Call ${st.phone}</a>`);
    });

    this.map.fitBounds(this.routePolyline.getBounds(), { padding: [40, 40] });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // If map container is present on page
  if (document.getElementById("safe-route-map")) {
    SafeRoutesController.init();
  }
});
