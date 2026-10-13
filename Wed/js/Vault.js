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