async function triggerEncryption() {
  const filePath = pathInput.value.trim();
  const password = passwordInput.value;

  if (!filePath) {
    alert("Please select or drop a file first!");
    return;
  }
  if (!password) {
    alert("Please set a decryption passphrase!");
    return;
  }

  statusMsg.innerText = "Encrypting file with AES-256 Fernet...";
  statusMsg.style.color = "var(--warning-amber)";

  try {
    const result = await eel.encrypt_file_bridge(filePath, password)();
    console.log("Bridge response:", result);

    if (result && (result.status === "SUCCESS" || result.success === true)) {
      const encName = result.encrypted_file || (filePath.split(/[\\/]/).pop() + ".enc");
      const origName = result.original_file || filePath.split(/[\\/]/).pop();
      const fileSize = result.size || "1.0 KB";
      const hashVal = result.file_hash ? result.file_hash.substring(0, 10) + "..." : "e3b0c44...89b";

      statusMsg.innerText = `Encrypted successfully: ${encName}`;
      statusMsg.style.color = "var(--accent-emerald)";

      appendVaultRow(origName, fileSize, hashVal, encName);

      pathInput.value = "";
      passwordInput.value = "";
    } else {
      const errMsg = (result && (result.message || result.error)) ? (result.message || result.error) : "Encryption failed in Python engine";
      statusMsg.innerText = `Error: ${errMsg}`;
      statusMsg.style.color = "#ef4444";
    }
  } catch (err) {
    console.error("Bridge Error:", err);
    statusMsg.innerText = `Bridge Error: ${err}`;
    statusMsg.style.color = "#ef4444";
  }
}

// Session cache for active authentication flow
let pendingAuthData = {
    name: "",
    email: "",
    phone: "",
    pin: ""
};

/**
 * Handles transition from Stage 1 (Credentials) to Stage 2 (2FA OTP)
 */
async function goToVerificationStage() {
    const name = document.getElementById("authName").value.trim();
    const email = document.getElementById("authEmail").value.trim();
    const phone = document.getElementById("authPhone").value.trim();
    const pin = document.getElementById("authPin").value.trim();

    // Basic frontend field validation
    if (!name || !email || !phone || !pin) {
        alert("Please fill in all details (Name, Email, Phone, and PIN).");
        return;
    }

    if (pin.length < 4) {
        alert("PIN must be at least 4 digits.");
        return;
    }

    // Cache locally for the session
    pendingAuthData = { name, email, phone, pin };

    try {
        // Call Python Eel backend to validate PIN and request OTP
        const response = await eel.initiate_login_bridge(email, pin)();

        if (response.status === "success") {
            // Flip view to Stage 2 (2FA Card)
            document.getElementById("stageCredentials").style.display = "none";
            document.getElementById("stageVerification").style.display = "block";
            
            // Focus on OTP input
            const otpInput = document.getElementById("authOtp");
            otpInput.value = "";
            otpInput.focus();

            // Development/Demo popup showing generated OTP
            if (response.demo_otp) {
                alert(`[2FA Simulation] Security OTP sent to ${phone || email}:\n\nCode: ${response.demo_otp}`);
            }
        } else {
            alert(response.message || "Authentication failed. Invalid PIN.");
        }
    } catch (err) {
        console.error("Eel bridge error:", err);
        alert("Could not reach backend authentication service.");
    }
}

/**
 * Handles final OTP verification and unlocks the dashboard
 */
async function submitFinalAuth() {
    const otp = document.getElementById("authOtp").value.trim();

    if (otp.length !== 6) {
        alert("Please enter a valid 6-digit verification code.");
        return;
    }

    try {
        // Send OTP verification to Python backend
        const response = await eel.verify_2fa_bridge(pendingAuthData.email, otp)();

        if (response.status === "success") {
            // Store the login PIN in session storage so Lock & Login share the exact same key
            sessionStorage.setItem("vault_pass", pendingAuthData.pin);

            // Hide the entire authentication backdrop
            const overlay = document.getElementById("authOverlay");
            if (overlay) {
                overlay.style.display = "none";
            }

            // Update user profile badge in UI header if present
            const profileName = document.querySelector(".user-name") || document.getElementById("profileName");
            if (profileName) {
                profileName.textContent = pendingAuthData.name;
            }

            alert("Identity verified! ShieldDrop vault is now unlocked.");
        } else {
            alert(response.message || "Invalid or expired verification code.");
        }
    } catch (err) {
        console.error("Eel bridge error:", err);
        alert("Verification request failed.");
    }
}

/**
 * Returns user back to credentials form if they need to edit inputs
 */
function backToCredentialsStage() {
    document.getElementById("stageVerification").style.display = "none";
    document.getElementById("stageCredentials").style.display = "block";
}

/**
 * Bulletproof unlock verification for the lock screen
 */
function verifyVaultUnlock() {
    const savedPassword = sessionStorage.getItem("vault_pass");
    
    // Check multiple common IDs in case your HTML uses a different ID for the lock input
    const inputEl = document.getElementById("unlockPasswordInput") || 
                    document.getElementById("inputPin") || 
                    document.getElementById("lockPasswordInput");

    if (!inputEl) {
        alert("Error: Could not find the password input field on the lock screen.");
        return;
    }

    const enteredPass = inputEl.value.trim();

    if (enteredPass === savedPassword) {
        alert("Vault unlocked successfully!");
        
        // Clear the lock input box
        inputEl.value = "";

        // Hide the lock overlay/screen
        const lockScreen = document.getElementById("lockOverlay") || document.getElementById("screen-lock");
        if (lockScreen) {
            lockScreen.style.display = "none";
        } else {
            // Fallback: hide lock overlay and show dashboard
            const overlay = document.getElementById("authOverlay");
            if (overlay) overlay.style.display = "none";
        }
    } else {
        alert("Incorrect password. Try again.");
    }
}
