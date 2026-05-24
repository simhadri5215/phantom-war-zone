// ═══════════════════════════════════════════════
//  PHANTOM WARZONE — GLOBAL POPUP & TOAST SYSTEM
//  Include this in every HTML page:
//  <script src="popup.js"></script>  (before module scripts)
// ═══════════════════════════════════════════════

// ── INJECT STYLES ────────────────────────────────
const _popupStyles = document.createElement("style");
_popupStyles.textContent = `
  /* TOAST */
  #pw-toast {
    position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: #1a1a1a; color: white; padding: 12px 22px;
    border-radius: 30px; font-size: 14px; font-weight: 500;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    opacity: 0; pointer-events: none;
    transition: opacity 0.25s, transform 0.25s;
    z-index: 999999; white-space: nowrap; max-width: 90vw;
    border: 1px solid #333; text-align: center;
  }
  #pw-toast.show {
    opacity: 1; transform: translateX(-50%) translateY(0);
  }
  #pw-toast.success { border-color: #00ff88; color: #00ff88; }
  #pw-toast.error   { border-color: #ff4444; color: #ff4444; }
  #pw-toast.info    { border-color: #00ffd5; color: #00ffd5; }
  #pw-toast.warning { border-color: #ffd700; color: #ffd700; }

  /* POPUP OVERLAY */
  #pw-popup-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(4px);
    z-index: 999998;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none;
    transition: opacity 0.2s;
  }
  #pw-popup-overlay.show {
    opacity: 1; pointer-events: all;
  }
  #pw-popup-box {
    background: #151515;
    border: 1px solid #2a2a2a;
    border-radius: 24px;
    padding: 32px 24px 24px;
    max-width: 340px; width: 92%;
    text-align: center;
    box-shadow: 0 0 40px rgba(0,0,0,0.6);
    transform: scale(0.92);
    transition: transform 0.2s;
  }
  #pw-popup-overlay.show #pw-popup-box {
    transform: scale(1);
  }
  #pw-popup-icon { font-size: 52px; margin-bottom: 14px; line-height: 1; }
  #pw-popup-title {
    font-size: 20px; font-weight: 700; margin: 0 0 10px;
    background: linear-gradient(135deg, #00ffd5, #00a8ff);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  #pw-popup-title.error-title   { background: linear-gradient(135deg,#ff4444,#ff0000); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  #pw-popup-title.warning-title { background: linear-gradient(135deg,#ffd700,#ff8c00); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  #pw-popup-title.success-title { background: linear-gradient(135deg,#00ff88,#00ffd5); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  #pw-popup-msg {
    color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 22px;
  }
  #pw-popup-msg strong { color: #fff; }
  .pw-popup-btns { display: flex; gap: 10px; }
  .pw-popup-btns button {
    flex: 1; padding: 13px; border-radius: 12px;
    font-size: 14px; font-weight: 600; cursor: pointer; border: none;
  }
  .pw-btn-primary {
    background: linear-gradient(135deg, #00ffd5, #00a8ff); color: black;
  }
  .pw-btn-secondary {
    background: #222; color: #aaa; border: 1px solid #333 !important;
  }
  .pw-btn-danger {
    background: linear-gradient(135deg, #ff4444, #ff0000); color: white;
  }
  /* INPUT inside popup (for prompt replacement) */
  #pw-popup-input {
    width: 100%; padding: 12px 14px; background: #1a1a1a;
    border: 1px solid #333; border-radius: 10px; color: white;
    font-size: 15px; outline: none; margin-bottom: 16px;
    box-sizing: border-box;
  }
  #pw-popup-input:focus { border-color: #00ffd5; }
`;
document.head.appendChild(_popupStyles);

// ── CREATE DOM ───────────────────────────────────
const _toastEl = document.createElement("div");
_toastEl.id = "pw-toast";
document.body.appendChild(_toastEl);

const _overlayEl = document.createElement("div");
_overlayEl.id = "pw-popup-overlay";
_overlayEl.innerHTML = `
  <div id="pw-popup-box">
    <div id="pw-popup-icon"></div>
    <div id="pw-popup-title"></div>
    <div id="pw-popup-msg"></div>
    <input id="pw-popup-input" type="text" style="display:none;"/>
    <div class="pw-popup-btns" id="pw-popup-btns"></div>
  </div>
`;
document.body.appendChild(_overlayEl);

let _toastTimer = null;

// ── TOAST ────────────────────────────────────────
window.showToast = function(message, type = "info", duration = 3000) {
  _toastEl.innerText = message;
  _toastEl.className = `show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    _toastEl.classList.remove("show");
  }, duration);
};

// ── POPUP (replaces alert) ───────────────────────
window.showPopup = function({ icon, title, message, type = "info", btnText = "OK", onClose } = {}) {
  return new Promise(resolve => {
    document.getElementById("pw-popup-icon").innerText  = icon || _defaultIcon(type);
    const titleEl = document.getElementById("pw-popup-title");
    titleEl.innerText  = title || "";
    titleEl.className  = `${type}-title`;
    document.getElementById("pw-popup-msg").innerHTML   = message || "";
    document.getElementById("pw-popup-input").style.display = "none";

    const btns = document.getElementById("pw-popup-btns");
    btns.innerHTML = `<button class="pw-btn-primary" id="pw-ok-btn">${btnText}</button>`;
    _overlayEl.classList.add("show");

    const close = () => {
      _overlayEl.classList.remove("show");
      if (onClose) onClose();
      resolve(true);
    };
    document.getElementById("pw-ok-btn").onclick = close;
    _overlayEl.onclick = (e) => { if (e.target === _overlayEl) close(); };
  });
};

// ── CONFIRM (replaces confirm) ───────────────────
window.showConfirm = function({ icon, title, message, type = "warning", confirmText = "Yes", cancelText = "Cancel" } = {}) {
  return new Promise(resolve => {
    document.getElementById("pw-popup-icon").innerText  = icon || "❓";
    const titleEl = document.getElementById("pw-popup-title");
    titleEl.innerText  = title || "Are you sure?";
    titleEl.className  = `${type}-title`;
    document.getElementById("pw-popup-msg").innerHTML   = message || "";
    document.getElementById("pw-popup-input").style.display = "none";

    const btns = document.getElementById("pw-popup-btns");
    btns.innerHTML = `
      <button class="pw-btn-secondary" id="pw-cancel-btn">${cancelText}</button>
      <button class="${type === 'error' ? 'pw-btn-danger' : 'pw-btn-primary'}" id="pw-confirm-btn">${confirmText}</button>
    `;
    _overlayEl.classList.add("show");

    const close = (val) => { _overlayEl.classList.remove("show"); resolve(val); };
    document.getElementById("pw-confirm-btn").onclick = () => close(true);
    document.getElementById("pw-cancel-btn").onclick  = () => close(false);
    _overlayEl.onclick = (e) => { if (e.target === _overlayEl) close(false); };
  });
};

// ── PROMPT (replaces prompt) ─────────────────────
window.showPrompt = function({ icon, title, message, placeholder = "", type = "info", confirmText = "Submit" } = {}) {
  return new Promise(resolve => {
    document.getElementById("pw-popup-icon").innerText  = icon || "✏️";
    const titleEl = document.getElementById("pw-popup-title");
    titleEl.innerText  = title || "";
    titleEl.className  = `${type}-title`;
    document.getElementById("pw-popup-msg").innerHTML   = message || "";

    const inp = document.getElementById("pw-popup-input");
    inp.style.display  = "block";
    inp.value          = "";
    inp.placeholder    = placeholder;

    const btns = document.getElementById("pw-popup-btns");
    btns.innerHTML = `
      <button class="pw-btn-secondary" id="pw-cancel-btn">Cancel</button>
      <button class="pw-btn-primary" id="pw-confirm-btn">${confirmText}</button>
    `;
    _overlayEl.classList.add("show");
    setTimeout(() => inp.focus(), 200);

    const close = (val) => { _overlayEl.classList.remove("show"); resolve(val); };
    document.getElementById("pw-confirm-btn").onclick = () => close(inp.value.trim() || null);
    document.getElementById("pw-cancel-btn").onclick  = () => close(null);
    inp.onkeydown = (e) => { if (e.key === "Enter") close(inp.value.trim() || null); };
    _overlayEl.onclick = (e) => { if (e.target === _overlayEl) close(null); };
  });
};

// ── SUCCESS POPUP (special) ──────────────────────
window.showSuccess = function(title, message, btnText = "OK", onClose) {
  return showPopup({ icon: "✅", title, message, type: "success", btnText, onClose });
};
window.showError = function(title, message) {
  return showPopup({ icon: "❌", title, message, type: "error" });
};
window.showWarning = function(title, message) {
  return showPopup({ icon: "⚠️", title, message, type: "warning" });
};

function _defaultIcon(type) {
  return { success:"✅", error:"❌", warning:"⚠️", info:"💬" }[type] || "💬";
}