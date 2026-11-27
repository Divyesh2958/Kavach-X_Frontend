/**
 * KAVACH-X User Authentication Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Password visibility toggle
  const togglePassBtns = document.querySelectorAll(".password-toggle-btn");
  togglePassBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (input) {
        if (input.type === "password") {
          input.type = "text";
          btn.innerHTML = '<i class="bi bi-eye-slash"></i>';
        } else {
          input.type = "password";
          btn.innerHTML = '<i class="bi bi-eye"></i>';
        }
      }
    });
  });

  // 2. Login Form Submission
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = loginForm.querySelector("button[type='submit']");
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating...';

        const data = await KavachApp.apiRequest("/auth/login", {
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

        KavachApp.showToast(`Welcome back, ${data.full_name}!`, "success");
        setTimeout(() => {
          if (data.role === "admin") {
            window.location.href = "admin.html";
          } else {
            window.location.href = "dashboard.html";
          }
        }, 600);
      } catch (err) {
        KavachApp.showToast(err.message, "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-shield-check me-2"></i>Sign In Securely';
      }
    });
  }

  // 3. Registration Form & Dynamic Contacts List
  const registerForm = document.getElementById("register-form");
  const addContactBtn = document.getElementById("btn-add-contact-row");
  const contactsContainer = document.getElementById("register-contacts-container");

  if (addContactBtn && contactsContainer) {
    addContactBtn.addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "contact-row-item";
      row.innerHTML = `
        <input type="text" class="form-control form-control-sm reg-contact-name" placeholder="Name" required>
        <input type="tel" class="form-control form-control-sm reg-contact-phone" placeholder="Phone (+91...)" required>
        <select class="form-select form-select-sm reg-contact-rel" required>
          <option value="Parent">Parent</option>
          <option value="Sibling">Sibling</option>
          <option value="Friend">Friend</option>
          <option value="Spouse">Spouse</option>
          <option value="Other">Other</option>
        </select>
        <button type="button" class="btn btn-outline-danger btn-sm btn-remove-row"><i class="bi bi-trash"></i></button>
      `;
      row.querySelector(".btn-remove-row").onclick = () => row.remove();
      contactsContainer.appendChild(row);
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = registerForm.querySelector("button[type='submit']");
      const fullName = document.getElementById("reg-name").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const phone = document.getElementById("reg-phone").value.trim();
      const password = document.getElementById("reg-password").value;
      const confirmPassword = document.getElementById("reg-confirm-password").value;

      if (password !== confirmPassword) {
        KavachApp.showToast("Passwords do not match.", "error");
        return;
      }

      // Collect optional initial emergency contacts
      const contactItems = [];
      if (contactsContainer) {
        const rows = contactsContainer.querySelectorAll(".contact-row-item");
        rows.forEach(r => {
          const name = r.querySelector(".reg-contact-name").value.trim();
          const p = r.querySelector(".reg-contact-phone").value.trim();
          const rel = r.querySelector(".reg-contact-rel").value;
          if (name && p) {
            contactItems.push({ name, phone: p, relationship: rel });
          }
        });
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating Account...';

        await KavachApp.apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            full_name: fullName,
            email,
            phone,
            password,
            emergency_contacts: contactItems
          })
        });

        KavachApp.showToast("Account created successfully! Please sign in to verify your contacts.", "success");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1200);
      } catch (err) {
        KavachApp.showToast(err.message, "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-person-plus-fill me-2"></i>Create Personal Safety Account';
      }
    });
  }
});
