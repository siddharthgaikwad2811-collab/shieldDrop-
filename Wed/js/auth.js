// GLOBAL STATE
let activeUser = { name: "", email: "", phone: "", pin: "" };
let generatedOtp = "";
let currentEncryptFile = null;
let currentDecryptFile = null;

let vaultRecords = [
  {
    id: 1,
    originalName: "Financial_Audit_2026.pdf",
    encName: "Financial_Audit_2026.pdf.enc",
    size: "2.4 MB",
    hash: "a87f12c9...3b4c",
    status: "ENCRYPTED"
  }
];

// EVENT LISTENERS WIRING ON DOM LOADED
document.addEventListener("DOMContentLoaded", () => {
  // Password Visibility Toggles
  setupPasswordToggle("togglePinBtn", "inputPin");
  setupPasswordToggle("toggleEncryptPassBtn", "encryptPassphrase");
  setupPasswordToggle("toggleDecryptPassBtn", "decryptPassphrase");

  // Auth Buttons
  const btnProceed = document.getElementById("btnProceedLogin");
  if (btnProceed) btnProceed.addEventListener("click", goTo2FAScreen);

  const btnVerify = document.getElementById("btnVerifyOtp");
  if (btnVerify) btnVerify.addEventListener("click", verifyAndOpenHome);

  const btnBack = document.getElementById("btnBackLogin");
  if (btnBack) btnBack.addEventListener("click", backToLoginScreen);

  const btnLock = document.getElementById("btnLockVault");
  if (btnLock) btnLock.addEventListener("click", lockVault);

  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) btnLogout.addEventListener("click", handleLogout);

  // Sidebar Navigation
  document.querySelectorAll(".sidebar .nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const pageId = btn.getAttribute("data-page");
      if (pageId) switchPage(pageId);
    });
  });

  // Encrypt & Decrypt action buttons
  const btnEncrypt = document.getElementById("btnRunEncrypt");
  if (btnEncrypt) btnEncrypt.addEventListener("click", executeEncryptFlow);

  const btnDecrypt = document.getElementById("btnRunDecrypt");
  if (btnDecrypt) btnDecrypt.addEventListener("click", executeDecryptFlow);

  const btnClearEnc = document.getElementById("btnClearEncryptFile");
  if (btnClearEnc) btnClearEnc.addEventListener("click", clearSelectedEncryptFile);

  const searchInput = document.getElementById("recordSearchInput");
  if (searchInput) searchInput.addEventListener("input", filterVaultRecords);

  // File Dropzone Setup
  setupFileDropzone();
});

// PASSWORD TOGGLE HELPER
function setupPasswordToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (btn && input) {
    btn.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
    });
  }
}

// AUTH FLOW
function goTo2FAScreen() {
  const name = document.getElementById("inputName").value.trim();
  const email = document.getElementById("inputEmail").value.trim();
  const phone = document.getElementById("inputPhone").value.trim();
  const pin = document.getElementById("inputPin").value.trim();

  if (!name || !email || !phone || !pin) {
    showToast("Please fill in all details (Name, Email, Phone, and PIN).", "⚠️");
    return;
  }

  if (pin.length < 4) {
    showToast("Security PIN must be at least 4 digits.", "⚠️");
    return;
  }

  activeUser = { name, email, phone, pin };
  
  // Store session password for lock/unlock continuity
  sessionStorage.setItem("vault_pass", pin);

  generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

  document.getElementById("otpPromptText").textContent = `A 6-digit verification code has been dispatched to ${phone || email}.`;
  document.getElementById("screen-login").style.display = "none";
  document.getElementById("screen-2fa").style.display = "flex";

  const otpInput = document.getElementById("inputOtp");
  otpInput.value = "";
  otpInput.focus();

  showToast(`Security OTP: ${generatedOtp}`, "🔑");
}

function backToLoginScreen() {
  document.getElementById("screen-2fa").style.display = "none";
  document.getElementById("screen-login").style.display = "flex";
}

function verifyAndOpenHome() {
  const otp = document.getElementById("inputOtp").value.trim();

  if (otp.length !== 6) {
    showToast("Enter a valid 6-digit verification code.", "⚠️");
    return;
  }

  if (otp !== generatedOtp) {
    showToast("Invalid code. Please enter the OTP shown on screen.", "❌");
    return;
  }

  document.getElementById("screen-2fa").style.display = "none";
  document.getElementById("screen-home").style.display = "flex";

  document.getElementById("navUserName").textContent = activeUser.name;
  document.getElementById("settingsUserDisplay").textContent = activeUser.name;
  document.getElementById("settingsEmailDisplay").textContent = activeUser.email;
  document.getElementById("settingsPhoneDisplay").textContent = activeUser.phone;

  renderRecordsTable();
  switchPage("page-encrypt");
  showToast(`Welcome back, ${activeUser.name}`, "🛡️");
}

function lockVault() {
  document.getElementById("inputPin").value = "";
  document.getElementById("inputOtp").value = "";
  document.getElementById("screen-home").style.display = "none";
  document.getElementById("screen-2fa").style.display = "none";
  document.getElementById("screen-login").style.display = "flex";
  showToast("Vault session locked.", "🔒");
}

function handleLogout() {
  sessionStorage.removeItem("vault_pass");
  activeUser = { name: "", email: "", phone: "", pin: "" };
  document.getElementById("screen-home").style.display = "none";
  document.getElementById("screen-2fa").style.display = "none";
  document.getElementById("screen-login").style.display = "flex";
  const pinInput = document.getElementById("inputPin");
  if (pinInput) pinInput.value = "";
  showToast("Logged out successfully. Session cleared.", "🔒");
}

// NAVIGATION
function switchPage(pageId) {
  document.querySelectorAll(".content-section").forEach((sec) => (sec.style.display = "none"));
  const targetSec = document.getElementById(pageId);
  if (targetSec) targetSec.style.display = "block";

  document.querySelectorAll(".sidebar .nav-item").forEach((btn) => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.sidebar .nav-item[data-page="${pageId}"]`);
  if (activeBtn) activeBtn.classList.add("active");
}

// ENCRYPT & DECRYPT LOGIC
function clearSelectedEncryptFile() {
  currentEncryptFile = null;
  document.getElementById("targetFileInput").value = "";
  document.getElementById("encryptMetaCard").style.display = "none";
  document.getElementById("fileDropZone").style.display = "block";
}

function executeEncryptFlow() {
  if (!currentEncryptFile) {
    showToast("Please drop or choose a file first.", "⚠️");
    return;
  }
  const passphrase = document.getElementById("encryptPassphrase").value.trim();
  if (!passphrase) {
    showToast("Please enter a master passphrase.", "⚠️");
    return;
  }

  const btn = document.getElementById("btnRunEncrypt");
  const progressBox = document.getElementById("encryptProgressContainer");
  const bar = document.getElementById("encryptProgressBar");
  const label = document.getElementById("encryptProgressLabel");

  btn.disabled = true;
  progressBox.style.display = "flex";

  let progress = 0;
  const interval = setInterval(() => {
    progress += 20;
    bar.style.width = `${progress}%`;
    label.textContent = `${progress}%`;

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        vaultRecords.unshift({
          id: Date.now(),
          originalName: currentEncryptFile.name,
          encName: `${currentEncryptFile.name}.enc`,
          size: `${(currentEncryptFile.size / 1024 / 1024).toFixed(2)} MB`,
          hash: "a87f12c9...3b4c",
          status: "ENCRYPTED"
        });
        renderRecordsTable();
        btn.disabled = false;
        progressBox.style.display = "none";
        bar.style.width = "0%";
        document.getElementById("encryptPassphrase").value = "";
        clearSelectedEncryptFile();
        showToast("File encrypted & stored!", "✅");
      }, 300);
    }
  }, 120);
}

function setupFileDropzone() {
  const dropZone = document.getElementById("fileDropZone");
  const fileInput = document.getElementById("targetFileInput");
  const decryptInput = document.getElementById("decryptFileInput");

  if (dropZone && fileInput) {
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) handleEncryptFile(e.target.files[0]);
    });

    dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-active"); });
    dropZone.addEventListener("dragleave", () => { dropZone.classList.remove("drag-active"); });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-active");
      if (e.dataTransfer.files.length > 0) handleEncryptFile(e.dataTransfer.files[0]);
    });
  }

  if (decryptInput) {
    decryptInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      currentDecryptFile = file;
      document.getElementById("decryptMetaFileName").textContent = file.name;
      document.getElementById("decryptMetaFileSize").textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
      document.getElementById("decryptMetaCard").style.display = "flex";
    });
  }
}

function handleEncryptFile(file) {
  currentEncryptFile = file;
  document.getElementById("metaFileName").textContent = file.name;
  document.getElementById("metaFileSize").textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
  document.getElementById("encryptMetaCard").style.display = "flex";
  document.getElementById("fileDropZone").style.display = "none";
}

function executeDecryptFlow() {
  if (!currentDecryptFile) {
    showToast("Select an encrypted (.enc) file.", "⚠️");
    return;
  }
  const passphrase = document.getElementById("decryptPassphrase").value.trim();
  if (!passphrase) {
    showToast("Enter the passphrase.", "⚠️");
    return;
  }

  const btn = document.getElementById("btnRunDecrypt");
  const progressBox = document.getElementById("decryptProgressContainer");
  const bar = document.getElementById("decryptProgressBar");
  const label = document.getElementById("decryptProgressLabel");

  btn.disabled = true;
  progressBox.style.display = "flex";

  let progress = 0;
  const interval = setInterval(() => {
    progress += 25;
    bar.style.width = `${progress}%`;
    label.textContent = `${progress}%`;

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        btn.disabled = false;
        progressBox.style.display = "none";
        bar.style.width = "0%";
        document.getElementById("decryptPassphrase").value = "";
        document.getElementById("decryptFileInput").value = "";
        document.getElementById("decryptMetaCard").style.display = "none";
        currentDecryptFile = null;
        showToast("File decrypted successfully!", "🔓");
      }, 300);
    }
  }, 120);
}

// RECORDS & TABLES
function renderRecordsTable(recordsToRender = vaultRecords) {
  const tbody = document.getElementById("recordsTableBody");
  if (!tbody) return;
  if (recordsToRender.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#9ca3af; padding: 24px;">No records found.</td></tr>`;
    return;
  }
  tbody.innerHTML = recordsToRender.map(r => `
    <tr>
      <td><strong>${r.originalName}</strong></td>
      <td><code>${r.encName}</code></td>
      <td>${r.size}</td>
      <td><code>${r.hash}</code></td>
      <td><span class="chip-tag">${r.status}</span></td>
      <td>
        <button class="btn-table-action" onclick="switchPage('page-decrypt')">Decrypt</button>
        <button class="btn-table-delete" onclick="deleteRecord(${r.id})">Delete</button>
      </td>
    </tr>
  `).join("");
}

function filterVaultRecords() {
  const query = document.getElementById("recordSearchInput").value.toLowerCase();
  const filtered = vaultRecords.filter(r => r.originalName.toLowerCase().includes(query));
  renderRecordsTable(filtered);
}

function deleteRecord(id) {
  vaultRecords = vaultRecords.filter(r => r.id !== id);
  renderRecordsTable();
  showToast("Record deleted.", "🗑️");
}

// TOAST
let toastTimeout;
function showToast(message, icon = "🛡️") {
  const toast = document.getElementById("toastNotification");
  const msgEl = document.getElementById("toastMessage");
  const iconEl = document.getElementById("toastIcon");
  if (!toast) return;

  clearTimeout(toastTimeout);
  msgEl.textContent = message;
  iconEl.textContent = icon;
  toast.style.display = "flex";

  toastTimeout = setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}
