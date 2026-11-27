/**
 * KAVACH-X Emergency Contact Management Controller
 * Handles CRUD operations, OTP dispatch, and verification workflows
 */

const ContactsController = {
  currentVerifyingContactId: null,

  init() {
    if (!KavachApp.isAuthenticated()) return;

    this.loadContacts();
    this.bindEvents();
  },

  bindEvents() {
    // Add Contact Form
    const addContactForm = document.getElementById("add-contact-form");
    if (addContactForm) {
      addContactForm.addEventListener("submit", (e) => this.handleAddContact(e));
    }

    // Verify OTP Form in Modal
    const verifyOtpForm = document.getElementById("verify-contact-otp-form");
    if (verifyOtpForm) {
      verifyOtpForm.addEventListener("submit", (e) => this.handleVerifyOTP(e));
    }
  },

  async loadContacts() {
    const container = document.getElementById("contacts-list-container");
    if (!container) return;

    try {
      container.innerHTML = `<div class="text-center py-4"><span class="spinner-border spinner-border-sm text-primary"></span> Loading contacts...</div>`;
      const contacts = await KavachApp.apiRequest("/contacts");

      if (contacts.length === 0) {
        container.innerHTML = `
          <div class="text-center text-muted py-4">
            <i class="bi bi-people display-6 d-block mb-2 text-muted"></i>
            No emergency contacts added yet. Add trusted contacts below.
          </div>
        `;
        return;
      }

      container.innerHTML = contacts.map(c => `
        <div class="contact-item-card" id="contact-card-${c.id}">
          <div class="d-flex align-items-center gap-3">
            <div class="contact-avatar">
              ${c.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="fw-bold text-dark">${c.name}</div>
              <div class="small text-muted">${c.phone} &bull; <span class="badge bg-light text-dark">${c.relationship}</span></div>
            </div>
          </div>
          <div class="d-flex align-items-center gap-2">
            ${c.is_verified 
              ? `<span class="badge-verified"><i class="bi bi-patch-check-fill me-1"></i>Verified</span>`
              : `<button class="btn btn-sm btn-outline-warning text-dark fw-bold badge-unverified" onclick="ContactsController.openOTPModal(${c.id}, '${c.name}', '${c.phone}')">
                  <i class="bi bi-shield-exclamation me-1 text-danger"></i>Verify with OTP
                 </button>`
            }
            <button class="btn btn-sm btn-outline-danger" onclick="ContactsController.deleteContact(${c.id}, '${c.name}')" title="Delete Contact">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `).join("");

      // Update count badge
      const countEl = document.getElementById("contacts-count-badge");
      if (countEl) countEl.innerText = `${contacts.filter(c => c.is_verified).length}/${contacts.length} Verified`;

    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async handleAddContact(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    const nameInput = document.getElementById("new-contact-name");
    const phoneInput = document.getElementById("new-contact-phone");
    const relInput = document.getElementById("new-contact-relationship");

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';

      await KavachApp.apiRequest("/contacts", {
        method: "POST",
        body: JSON.stringify({
          name: nameInput.value.trim(),
          phone: phoneInput.value.trim(),
          relationship: relInput.value
        })
      });

      KavachApp.showToast("Emergency contact added! Please verify with OTP.", "success");
      nameInput.value = "";
      phoneInput.value = "";
      this.loadContacts();
    } catch (err) {
      KavachApp.showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-person-plus-fill me-1"></i>Add Contact';
    }
  },

  async openOTPModal(contactId, contactName, phone) {
    this.currentVerifyingContactId = contactId;
    const modalTitle = document.getElementById("otp-modal-contact-title");
    const modalSubtitle = document.getElementById("otp-modal-phone-text");
    const mockOtpAlert = document.getElementById("demo-otp-banner");

    if (modalTitle) modalTitle.innerText = `Verify Contact: ${contactName}`;
    if (modalSubtitle) modalSubtitle.innerText = `Sending 6-digit verification code to ${phone}...`;
    if (mockOtpAlert) mockOtpAlert.classList.add("d-none");

    const modal = new bootstrap.Modal(document.getElementById("contactOTPModal"));
    modal.show();

    // Trigger OTP dispatch API
    try {
      const res = await KavachApp.apiRequest(`/contacts/${contactId}/send-otp`, {
        method: "POST"
      });

      if (modalSubtitle) modalSubtitle.innerText = `Code sent to ${phone}. Valid for 10 minutes.`;

      // In local DEMO mode, show simulated OTP banner for easy student evaluation
      if (res.mock_otp && mockOtpAlert) {
        mockOtpAlert.innerHTML = `
          <i class="bi bi-info-circle-fill me-1"></i>
          <strong>Demo Mode OTP:</strong> <code class="fs-6 fw-bold text-dark">${res.mock_otp}</code> 
          <span class="text-muted">(Local project evaluation preview)</span>
        `;
        mockOtpAlert.classList.remove("d-none");
        // Pre-fill input for test convenience
        const otpInput = document.getElementById("contact-otp-input");
        if (otpInput) otpInput.value = res.mock_otp;
      }

      KavachApp.showToast(res.message, "info");
    } catch (err) {
      KavachApp.showToast(`Failed to send OTP: ${err.message}`, "error");
    }
  },

  async handleVerifyOTP(e) {
    e.preventDefault();
    if (!this.currentVerifyingContactId) return;

    const submitBtn = e.target.querySelector("button[type='submit']");
    const otpInput = document.getElementById("contact-otp-input");
    const otpCode = otpInput ? otpInput.value.trim() : "";

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Verifying...';

      const res = await KavachApp.apiRequest(`/contacts/${this.currentVerifyingContactId}/verify-otp`, {
        method: "POST",
        body: JSON.stringify({ otp: otpCode })
      });

      KavachApp.showToast(res.message, "success");

      // Hide modal
      const modalEl = document.getElementById("contactOTPModal");
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      if (otpInput) otpInput.value = "";
      this.currentVerifyingContactId = null;

      // Refresh list
      this.loadContacts();
    } catch (err) {
      KavachApp.showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Verify & Activate Contact';
    }
  },

  async deleteContact(id, name) {
    if (!confirm(`Are you sure you want to remove '${name}' from your emergency contacts?`)) return;
    try {
      await KavachApp.apiRequest(`/contacts/${id}`, { method: "DELETE" });
      KavachApp.showToast("Contact deleted.", "info");
      this.loadContacts();
    } catch (err) {
      KavachApp.showToast(err.message, "error");
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  ContactsController.init();
});
