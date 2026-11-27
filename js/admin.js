/**
 * KAVACH-X Administrator Control Center
 * Secure incident monitoring, user auditing, volunteer vetting, and audio vault
 */

const AdminController = {
  activeTab: "overview",

  init() {
    // Check if on admin login form vs admin dashboard
    const adminLoginForm = document.getElementById("admin-login-form");
    if (adminLoginForm) {
      this.bindAdminLogin(adminLoginForm);
      return;
    }

    // Guard: ensure user is logged in as admin
    if (!KavachApp.isAuthenticated() || !KavachApp.isAdmin()) {
      window.location.href = "admin.html#login";
      return;
    }

    this.bindDashboardEvents();
    this.loadDashboardData();
  },

  bindAdminLogin(form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector("button[type='submit']");
      const email = document.getElementById("admin-email").value.trim();
      const password = document.getElementById("admin-password").value;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating Administrator...';

        const data = await KavachApp.apiRequest("/admin/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });

        KavachApp.setToken(data.access_token);
        KavachApp.setUser({
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          role: data.role
        });

        KavachApp.showToast("Administrator authenticated successfully.", "success");
        setTimeout(() => {
          // Hide login view, show admin dashboard view
          document.getElementById("admin-login-view")?.classList.add("d-none");
          document.getElementById("admin-dashboard-view")?.classList.remove("d-none");
          AdminController.loadDashboardData();
        }, 500);

      } catch (err) {
        KavachApp.showToast(`Admin Login Failed: ${err.message}`, "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-shield-lock-fill me-2"></i>Authenticate Admin Portal';
      }
    });
  },

  bindDashboardEvents() {
    // Sidebar navigation tabs
    const navItems = document.querySelectorAll(".admin-nav-item");
    navItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        navItems.forEach(n => n.classList.remove("active"));
        item.classList.add("active");
        const tab = item.getAttribute("data-tab");
        this.switchTab(tab);
      });
    });

    // Seed Demo Data Button
    const seedBtn = document.getElementById("btn-seed-demo-data");
    if (seedBtn) {
      seedBtn.addEventListener("click", () => this.seedDemoData());
    }

    // Refresh Data Button
    const refreshBtn = document.getElementById("btn-admin-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.loadDashboardData());
    }

    // Logout
    const logoutBtn = document.getElementById("admin-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        KavachApp.clearAuth();
        KavachApp.showToast("Admin signed out.", "info");
        setTimeout(() => window.location.reload(), 400);
      });
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll(".admin-tab-pane").forEach(pane => pane.classList.add("d-none"));
    const activePane = document.getElementById(`tab-pane-${tab}`);
    if (activePane) activePane.classList.remove("d-none");

    if (tab === "overview") this.loadOverviewStats();
    if (tab === "sos") this.loadSOSRecords();
    if (tab === "users") this.loadUsersList();
    if (tab === "volunteers") this.loadVolunteersList();
    if (tab === "recordings") this.loadRecordingsList();
  },

  async loadDashboardData() {
    await this.loadOverviewStats();
    await this.loadSOSRecords();
    await this.loadUsersList();
    await this.loadVolunteersList();
    await this.loadRecordingsList();
  },

  async loadOverviewStats() {
    try {
      const stats = await KavachApp.apiRequest("/admin/dashboard");
      
      const userCountEl = document.getElementById("stat-total-users");
      const sosCountEl = document.getElementById("stat-total-sos");
      const activeSosEl = document.getElementById("stat-active-sos");
      const recsCountEl = document.getElementById("stat-total-recordings");
      const volsCountEl = document.getElementById("stat-total-volunteers");
      const pendingVolsEl = document.getElementById("stat-pending-volunteers");
      const demoBadgeEl = document.getElementById("admin-demo-badge");

      if (userCountEl) userCountEl.innerText = stats.total_users;
      if (sosCountEl) sosCountEl.innerText = stats.total_sos_attempts;
      if (activeSosEl) activeSosEl.innerText = stats.active_sos;
      if (recsCountEl) recsCountEl.innerText = stats.total_recordings;
      if (volsCountEl) volsCountEl.innerText = stats.total_volunteers;
      if (pendingVolsEl) pendingVolsEl.innerText = stats.pending_volunteers;

      if (demoBadgeEl) {
        demoBadgeEl.innerText = `Demo Mode Active (Session: ${stats.app_session_id})`;
      }
    } catch (err) {
      console.warn("Could not load admin stats:", err);
    }
  },

  async loadSOSRecords() {
    const tableBody = document.getElementById("admin-sos-table-body");
    if (!tableBody) return;

    try {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-3"><span class="spinner-border spinner-border-sm text-danger"></span> Loading incidents...</td></tr>`;
      const records = await KavachApp.apiRequest("/admin/sos-records");

      if (records.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No emergency incidents recorded in current demo session.</td></tr>`;
        return;
      }

      tableBody.innerHTML = records.map(r => `
        <tr>
          <td><span class="badge bg-light text-dark border">#${r.id}</span></td>
          <td>
            <div class="fw-bold text-dark">${r.user_name || 'Guest User'}</div>
            <div class="small text-muted">${r.user_phone || 'N/A'}</div>
          </td>
          <td>
            <div class="small text-dark">${r.location_address || 'GPS Coordinates'}</div>
            ${r.latitude ? `<div class="text-muted" style="font-size:0.75rem;">(${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}) &bull; <a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank">Map</a></div>` : ''}
          </td>
          <td><span class="badge ${r.status === 'ACTIVE' ? 'badge-status-active' : 'badge-status-resolved'}">${r.status}</span></td>
          <td><span class="badge bg-secondary-subtle text-dark">${r.emergency_type || 'GENERAL_SOS'}</span></td>
          <td class="small text-muted">${new Date(r.created_at).toLocaleString()}</td>
          <td>
            ${r.status === 'ACTIVE' ? `
              <button class="btn btn-sm btn-success" onclick="AdminController.updateSOSStatus(${r.id}, 'RESOLVED')">
                <i class="bi bi-check2-circle me-1"></i>Resolve
              </button>
            ` : `
              <button class="btn btn-sm btn-outline-secondary" onclick="AdminController.updateSOSStatus(${r.id}, 'ACTIVE')">
                Reopen
              </button>
            `}
          </td>
        </tr>
      `).join("");

    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-danger py-3">${err.message}</td></tr>`;
    }
  },

  async updateSOSStatus(sosId, newStatus) {
    try {
      await KavachApp.apiRequest(`/sos/${sosId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, notes: `Status changed by Admin to ${newStatus}` })
      });
      KavachApp.showToast(`SOS #${sosId} updated to ${newStatus}`, "success");
      this.loadDashboardData();
    } catch (err) {
      KavachApp.showToast(err.message, "error");
    }
  },

  async loadUsersList() {
    const tableBody = document.getElementById("admin-users-table-body");
    if (!tableBody) return;

    try {
      const users = await KavachApp.apiRequest("/admin/users");
      tableBody.innerHTML = users.map(u => `
        <tr>
          <td><span class="badge bg-light text-dark border">#${u.id}</span></td>
          <td class="fw-bold">${u.full_name}</td>
          <td>${u.email}</td>
          <td>${u.phone}</td>
          <td><span class="badge bg-info-subtle text-dark">${u.verified_contacts_count}/${u.contacts_count} Verified</span></td>
          <td><span class="badge bg-danger-subtle text-danger">${u.sos_count} alerts</span></td>
          <td class="small text-muted">${new Date(u.created_at).toLocaleDateString()}</td>
        </tr>
      `).join("");
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-danger">${err.message}</td></tr>`;
    }
  },

  async loadVolunteersList() {
    const tableBody = document.getElementById("admin-volunteers-table-body");
    if (!tableBody) return;

    try {
      const volunteers = await KavachApp.apiRequest("/admin/volunteers");
      tableBody.innerHTML = volunteers.map(v => `
        <tr>
          <td><span class="badge bg-light text-dark border">#${v.id}</span></td>
          <td class="fw-bold">${v.name}</td>
          <td><a href="tel:${v.phone}">${v.phone}</a></td>
          <td>${v.area}</td>
          <td>
            <span class="badge ${v.is_approved ? 'bg-success' : 'bg-warning text-dark'}">
              ${v.is_approved ? 'Approved' : 'Pending Approval'}
            </span>
          </td>
          <td>
            <span class="badge ${v.is_available ? 'bg-primary' : 'bg-secondary'}">
              ${v.is_available ? 'Available' : 'Busy'}
            </span>
          </td>
          <td>
            ${!v.is_approved ? `
              <button class="btn btn-sm btn-success me-1" onclick="AdminController.setVolunteerApproval(${v.id}, true)">
                <i class="bi bi-check-lg"></i> Approve
              </button>
            ` : `
              <button class="btn btn-sm btn-outline-danger me-1" onclick="AdminController.setVolunteerApproval(${v.id}, false)">
                Revoke
              </button>
            `}
          </td>
        </tr>
      `).join("");
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-danger">${err.message}</td></tr>`;
    }
  },

  async setVolunteerApproval(id, approve) {
    try {
      await KavachApp.apiRequest(`/admin/volunteers/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ is_approved: approve })
      });
      KavachApp.showToast(`Volunteer ${approve ? 'Approved' : 'Revoked'}.`, "success");
      this.loadVolunteersList();
      this.loadOverviewStats();
    } catch (err) {
      KavachApp.showToast(err.message, "error");
    }
  },

  async loadRecordingsList() {
    const tableBody = document.getElementById("admin-recordings-table-body");
    if (!tableBody) return;

    try {
      const recs = await KavachApp.apiRequest("/admin/recordings");
      if (recs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">No audio evidence recordings submitted yet.</td></tr>`;
        return;
      }
      tableBody.innerHTML = recs.map(r => `
        <tr>
          <td><span class="badge bg-light text-dark border">#${r.id}</span></td>
          <td>${r.file_name || 'Evidence Audio'}</td>
          <td><span class="badge bg-dark">${r.duration}s</span></td>
          <td>${(r.file_size / 1024).toFixed(1)} KB</td>
          <td class="small text-muted">${new Date(r.created_at).toLocaleString()}</td>
          <td>
            <audio controls src="${API_BASE.replace('/api', '')}${r.audio_url}" class="admin-audio-player"></audio>
          </td>
        </tr>
      `).join("");
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-danger">${err.message}</td></tr>`;
    }
  },

  async seedDemoData() {
    const seedBtn = document.getElementById("btn-seed-demo-data");
    try {
      if (seedBtn) {
        seedBtn.disabled = true;
        seedBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Seeding...';
      }
      await KavachApp.apiRequest("/admin/seed-demo", { method: "POST" });
      KavachApp.showToast("Demonstration data seeded successfully!", "success");
      this.loadDashboardData();
    } catch (err) {
      KavachApp.showToast(`Seeding error: ${err.message}`, "error");
    } finally {
      if (seedBtn) {
        seedBtn.disabled = false;
        seedBtn.innerHTML = '<i class="bi bi-database-fill-gear me-1"></i>Seed Demo Incidents';
      }
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  AdminController.init();
});
