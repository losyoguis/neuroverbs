/* NeuroVerbs — Logout widget (Google Workspace / app session)
   Injects a fixed "Cerrar sesión" button on every page that includes this script.
   It clears local app session and (best-effort) disables Google One Tap auto-select + revokes the token.
*/
(function () {
  const BTN_ID = "logoutBtnGlobal";
  if (document.getElementById(BTN_ID)) return;

  function safeJsonParse(s) { try { return JSON.parse(s); } catch (_) { return null; } }

  function getStoredEmail() {
    const keys = ["user_profile", "rank_user", "mjb_user", "google_user", "neuroverbs_user", "auth_user"];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const obj = safeJsonParse(raw);
        const email = obj && (obj.email || (obj.profile && obj.profile.email));
        if (email) return String(email).toLowerCase();
      } catch (_) {}
    }
    return "";
  }

  function clearAppSession() {
    const keys = [
      "google_id_token",
      "user_profile",
      "rank_user",
      "mjb_user",
      "google_user",
      "neuroverbs_user",
      "auth_user"
    ];
    for (const k of keys) { try { localStorage.removeItem(k); } catch (_) {} }
    try { if (typeof clearSession === "function") clearSession(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
  }

  function ensureGsi(then) {
    try {
      if (window.google && google.accounts && google.accounts.id) return then();
    } catch (_) {}

    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", then, { once: true });
      // fallback: run anyway after a short delay
      setTimeout(then, 1500);
      return;
    }

    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = then;
    document.head.appendChild(s);
    setTimeout(then, 2000);
  }

  function bestEffortGoogleSignOut(email) {
    ensureGsi(function () {
      try {
        if (!(window.google && google.accounts && google.accounts.id)) return;

        // Avoid auto-login / One Tap auto-select
        try { if (google.accounts.id.disableAutoSelect) google.accounts.id.disableAutoSelect(); } catch (_) {}

        // Revoke the token for this app (best effort)
        try { if (email && google.accounts.id.revoke) google.accounts.id.revoke(email, function () {}); } catch (_) {}
      } catch (_) {}
    });
  }

  function logout() {
    const email = getStoredEmail();
    clearAppSession();
    bestEffortGoogleSignOut(email);

    // Return to login/entry
    try { window.location.replace("index.html"); }
    catch (_) { try { window.location.href = "index.html"; } catch (_) {} }
  }

  function createButton() {
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "Cerrar sesión";

    // Fixed top-right button (app-like)
    Object.assign(btn.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      zIndex: "99999",
      padding: "10px 14px",
      borderRadius: "999px",
      border: "1px solid rgba(255,90,90,.55)",
      background: "#ff5a5a",
      color: "#1b1430",
      fontWeight: "900",
      cursor: "pointer",
      boxShadow: "0 10px 24px rgba(0,0,0,.30)",
      transition: "transform .12s ease, filter .12s ease",
      userSelect: "none"
    });

    btn.addEventListener("mouseenter", () => { btn.style.filter = "brightness(1.05)"; btn.style.transform = "translateY(-1px)"; });
    btn.addEventListener("mouseleave", () => { btn.style.filter = ""; btn.style.transform = ""; });
    btn.addEventListener("mousedown", () => { btn.style.filter = "brightness(0.98)"; btn.style.transform = "translateY(0px)"; });
    btn.addEventListener("mouseup", () => { btn.style.filter = "brightness(1.05)"; btn.style.transform = "translateY(-1px)"; });

    btn.addEventListener("click", logout);

    // Only show if there's a stored email (logged-in state)
    if (!getStoredEmail()) btn.style.display = "none";

    // Keep visibility updated (in case the page stores profile after login)
    setInterval(() => {
      const hasEmail = !!getStoredEmail();
      btn.style.display = hasEmail ? "" : "none";
    }, 1500);

    return btn;
  }

  function mount() {
    try {
      const btn = createButton();
      document.body.appendChild(btn);
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
