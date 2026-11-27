/**
 * KAVACH-X V2 Core Application Script
 * API communication, authentication state, toast alerts & DOM helpers
 */

// Determine backend API host dynamically (works whether served directly from FastAPI or via static HTTP/file)
const API_BASE = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1") || window.location.port === "8000"
  ? `${window.location.origin}/api`
  : "http://localhost:8000/api";

const KavachApp = {
  // Token management
  getToken() {
    return localStorage.getItem("kavach_token");
  },
  
  setToken(token) {
    localStorage.setItem("kavach_token", token);
  },

  getUser() {
    const u = localStorage.getItem("kavach_user");
    return u ? JSON.parse(u) : null;
  },

  setUser(user) {
    localStorage.setItem("kavach_user", JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem("kavach_token");
    localStorage.removeItem("kavach_user");
  },

  isAuthenticated() {
    return Boolean(this.getToken());
  },

  isAdmin() {
    const user = this.getUser();
    return user && user.role === "admin";
  },

  // Central API Client
  async apiRequest(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
    const headers = options.headers || {};
    
    // Attach JWT if available
    const token = this.getToken();
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const contentType = response.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMsg = (data && data.detail) ? data.detail : response.statusText || "Request failed";
        // Handle 401 Unauthorized
        if (response.status === 401 && !endpoint.includes("/login")) {
          this.clearAuth();
          if (window.location.pathname.includes("dashboard") || window.location.pathname.includes("admin")) {
            window.location.href = "login.html";
          }
        }
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Toast Notifications
  showToast(message, type = "info", duration = 4500) {
    let container = document.getElementById("kavach-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "kavach-toast-container";
      container.className = "kavach-toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `kavach-toast toast-${type}`;
    
    let icon = "bi-info-circle-fill text-primary";
    if (type === "success") icon = "bi-check-circle-fill text-success";
    if (type === "error") icon = "bi-exclamation-triangle-fill text-danger";
    if (type === "warning") icon = "bi-exclamation-circle-fill text-warning";

    toast.innerHTML = `
      <i class="bi ${icon} fs-5"></i>
      <div class="flex-grow-1">
        <div class="small fw-bold text-uppercase text-muted">${type}</div>
        <div class="small text-dark mt-1">${message}</div>
      </div>
      <button type="button" class="btn-close btn-close-sm" aria-label="Close"></button>
    `;

    toast.querySelector(".btn-close").onclick = () => toast.remove();
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Update dynamic navbar state
  updateNavbar() {
    const navAuthContainer = document.getElementById("nav-auth-links");
    if (!navAuthContainer) return;

    if (this.isAuthenticated()) {
      const user = this.getUser();
      navAuthContainer.innerHTML = `
        <li class="nav-item">
          <a class="nav-link" href="dashboard.html">
            <i class="bi bi-shield-lock-fill text-danger me-1"></i> Dashboard
          </a>
        </li>
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle text-white" href="#" role="button" data-bs-toggle="dropdown">
            <i class="bi bi-person-circle me-1"></i> ${user ? user.full_name.split(" ")[0] : "Account"}
          </a>
          <ul class="dropdown-menu dropdown-menu-end shadow">
            <li><h6 class="dropdown-header">${user ? user.email : "Signed In"}</h6></li>
            <li><a class="dropdown-item" href="dashboard.html#contacts-section"><i class="bi bi-people me-2"></i>My Contacts</a></li>
            <li><a class="dropdown-item" href="dashboard.html#recordings-section"><i class="bi bi-mic me-2"></i>Audio Vault</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item text-danger" id="nav-logout-btn"><i class="bi bi-box-arrow-right me-2"></i>Logout</button></li>
          </ul>
        </li>
      `;
      const logoutBtn = document.getElementById("nav-logout-btn");
      if (logoutBtn) {
        logoutBtn.onclick = () => {
          KavachApp.clearAuth();
          KavachApp.showToast("Signed out safely.", "info");
          setTimeout(() => window.location.href = "index.html", 500);
        };
      }
    } else {
      navAuthContainer.innerHTML = `
        <li class="nav-item">
          <a class="nav-link" href="login.html"><i class="bi bi-box-arrow-in-right me-1"></i> Sign In</a>
        </li>
        <li class="nav-item ms-lg-2">
          <a class="btn btn-sm btn-outline-light px-3" href="register.html">Register</a>
        </li>
      `;
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  KavachApp.updateNavbar();
});
