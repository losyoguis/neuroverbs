/* NeuroVerbs — Logout + Avatar dock (no Worker)
   - Ensures a "Cerrar sesión" button exists for logged-in users (on pages that include this script)
   - Shows the Google profile photo (or initials) FIXED above the logout button on ALL pages
   - Does NOT move your existing button; it only anchors an avatar overlay to it.
*/
(function () {
  const BTN_ID = "logoutBtnGlobal";
  const DOCK_ID = "nvLogoutAvatarDock";
  const IMG_ID  = "nvLogoutAvatarImg";

  // ---------- utils ----------
  function safeJsonParse(s){
    try { return JSON.parse(s); } catch (_) { return null; }
  }
  function txt(el){
    return (el && (el.textContent || el.innerText) ? String(el.textContent || el.innerText).trim() : "");
  }

  function initialsFromName(name){
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return "NV";
    const a = parts[0][0] || "";
    const b = (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || "")) || "";
    return (a + b).toUpperCase();
  }

  function placeholderAvatarDataUri(initials){
    const t = String(initials || "NV").slice(0,2).toUpperCase();
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#06b6d4"/>` +
      `</linearGradient></defs>` +
      `<rect width="120" height="120" rx="60" fill="url(#g)"/>` +
      `<text x="60" y="74" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="800" fill="#0b1220">${t}</text>` +
      `</svg>`;
    const b64 = btoa(unescape(encodeURIComponent(svg)));
    return "data:image/svg+xml;base64," + b64;
  }

  function readProfileFromStore(store){
    const keys = ["user_profile", "rank_user", "mjb_user", "google_user", "neuroverbs_user", "auth_user"];
    const emailKeys = ["email","mail","userEmail"];
    const nameKeys  = ["name","fullName","displayName","userName"];
    const picKeys   = ["picture","photoURL","photoUrl","photo_url","photo","avatar","avatarUrl","image","imageUrl","img","profilePic","profile_pic"];

    for(const k of keys){
      const raw = store.getItem(k);
      if(!raw) continue;
      const obj = safeJsonParse(raw);
      if(!obj) continue;

      const out = { name:"", email:"", picture:"" };

      for(const ek of emailKeys) if(obj[ek]) out.email = String(obj[ek]);
      for(const nk of nameKeys)  if(obj[nk]) out.name  = String(obj[nk]);
      for(const pk of picKeys)   if(obj[pk]) out.picture = String(obj[pk]);

      const nested = [obj.profile, obj.user, obj.data, obj.result, obj.payload, obj.google, obj.googleProfile];
      for(const n of nested){
        if(!n) continue;
        for(const ek of emailKeys) if(!out.email && n[ek]) out.email = String(n[ek]);
        for(const nk of nameKeys)  if(!out.name  && n[nk]) out.name  = String(n[nk]);
        for(const pk of picKeys)   if(!out.picture && n[pk]) out.picture = String(n[pk]);
      }

      if(out.email || out.name || out.picture) return out;
    }
    return null;
  }

  function readProfileFromDOM(){
    const out = { name:"", email:"", picture:"" };
    try{
      // Primary (seguimiento-estudiantes.html)
      const segPic   = document.getElementById("profilePic");
      const segName  = document.getElementById("profileName");
      const segEmail = document.getElementById("profileEmail");

      if(segEmail) out.email = txt(segEmail);
      if(segName)  out.name  = txt(segName);
      if(segPic && segPic.src) out.picture = String(segPic.src);

      // Secondary (other pages)
      const emailEl = document.getElementById("userEmail") || document.querySelector(".userEmail");
      const nameEl  = document.getElementById("userName")  || document.querySelector(".userName");
      const imgEl   = document.getElementById("userPic")   || document.querySelector("#userChip img") || document.querySelector("img#photo") || document.querySelector("img.avatar");

      if(!out.email && emailEl) out.email = txt(emailEl);
      if(!out.name  && nameEl)  out.name  = txt(nameEl);
      if(!out.picture && imgEl && imgEl.src) out.picture = String(imgEl.src);

      // Also: profile panel may use #profilePhoto
      const p2 = document.getElementById("profilePhoto");
      if(!out.picture && p2 && p2.src) out.picture = String(p2.src);

      return out;
    }catch(_){
      return out;
    }
  }catch(_){
      return out;
    }
  }

  function getProfile(){
    const stores = [localStorage, sessionStorage];
    let prof = null;
    for(const st of stores){
      const p = readProfileFromStore(st);
      if(p){
        prof = { ...p };
        break;
      }
    }
    const dom = readProfileFromDOM();
    prof = prof || { name:"", email:"", picture:"" };

    // Fill blanks from DOM
    if(!prof.email && dom.email) prof.email = dom.email;
    if(!prof.name  && dom.name)  prof.name  = dom.name;
    if(!prof.picture && dom.picture) prof.picture = dom.picture;

    // Persist (so other pages can reuse the picture/email)
    try{
      if(prof.email || prof.name || prof.picture){
        const current = safeJsonParse(localStorage.getItem("user_profile") || "null") || {};
        const merged = {
          ...current,
          email: prof.email || current.email || "",
          name: prof.name || current.name || "",
          picture: prof.picture || current.picture || current.photoURL || ""
        };
        localStorage.setItem("user_profile", JSON.stringify(merged));
      }
    }catch(_){}

    return prof;
  }

  function isLoggedIn(){
    const p = getProfile();
    return !!(p.email && p.email.includes("@"));
  }

  // ---------- logout ----------
  function clearAppSession(){
    const keys = [
      "user_profile","rank_user","mjb_user","google_user","neuroverbs_user","auth_user",
      "nv_user","nv_token","nv_session","nvkp_token"
    ];
    for(const k of keys){
      try{ localStorage.removeItem(k); }catch(_){}
      try{ sessionStorage.removeItem(k); }catch(_){}
    }
  }

  function logout(){
    const p = getProfile();
    try{
      // Google Identity Services (best-effort)
      if(window.google && google.accounts && google.accounts.id){
        try{ google.accounts.id.disableAutoSelect(); }catch(_){}
        // revoke can remove the account authorization for your app
        if(typeof google.accounts.id.revoke === "function" && p.email){
          try{ google.accounts.id.revoke(p.email, ()=>{}); }catch(_){}
        }
      }
    }catch(_){}
    clearAppSession();
    try{ location.reload(); }catch(_){}
  }

  // ---------- UI: button + avatar dock ----------
  function findLogoutButton(){
    // Prefer known id
    const byId = document.getElementById(BTN_ID);
    if(byId) return byId;

    // Any element with text "Cerrar sesión"
    try{
      const candidates = Array.from(document.querySelectorAll("button, a, div"));
      const found = candidates.find(el => /cerrar\s*ses/i.test(txt(el)));
      return found || null;
    }catch(_){ return null; }
  }

  function ensureLogoutButton(){
    let btn = document.getElementById(BTN_ID);
    if(btn) return btn;

    // If there is already one in the page, use it
    const existing = findLogoutButton();
    if(existing){
      // If it's not a button, we still can click-bind it
      return existing;
    }

    // Otherwise inject a fixed button
    btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "Cerrar sesión";
    Object.assign(btn.style, {
      position: "fixed",
      top: "14px",
      right: "14px",
      zIndex: "99999",
      padding: "10px 14px",
      borderRadius: "999px",
      border: "1px solid rgba(255,90,90,.55)",
      background: "#ff5a5a",
      color: "#1b1430",
      fontWeight: "900",
      cursor: "pointer",
      boxShadow: "0 10px 24px rgba(0,0,0,.30)",
      userSelect: "none"
    });
    btn.addEventListener("click", (e)=>{ try{ e.preventDefault(); }catch(_){} logout(); });
    document.body.appendChild(btn);
    return btn;
  }

  function ensureAvatarDock(){
    let dock = document.getElementById(DOCK_ID);
    if(!dock){
      dock = document.createElement("div");
      dock.id = DOCK_ID;
      Object.assign(dock.style, {
        position: "fixed",
        zIndex: "100000",
        width: "58px",
        height: "58px",
        borderRadius: "999px",
        overflow: "hidden",
        boxShadow: "0 10px 22px rgba(0,0,0,.35)",
        border: "2px solid rgba(255,255,255,.22)",
        background: "rgba(255,255,255,.10)",
        display: "none",
        left: "0px",
        top: "0px",
        transform: "translate(-50%, 0)"
      });

      const img = document.createElement("img");
      img.id = IMG_ID;
      img.alt = "Perfil";
      Object.assign(img.style, {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block"
      });

      img.addEventListener("error", ()=>{
        const p = getProfile();
        img.src = placeholderAvatarDataUri(initialsFromName(p.name || p.email));
      });

      dock.appendChild(img);
      document.body.appendChild(dock);
    }
    return dock;
  }

  function positionDockAboveButton(dock, btn){
    if(!dock || !btn) return;

    const rect = btn.getBoundingClientRect();
    const size = 58;
    const gap = 10;

    // Center horizontally with the button center
    const cx = rect.left + rect.width / 2;

    // Place above. If not enough space, place below.
    let top = rect.top - size - gap;
    if(top < 8) top = rect.bottom + gap;

    dock.style.left = `${Math.round(cx)}px`;
    dock.style.top  = `${Math.round(top)}px`;
  }

  function bindLogoutOnce(btn){
    if(!btn) return;
    if(btn.dataset && btn.dataset.nvBoundLogout === "1") return;

    try{
      if(btn.dataset) btn.dataset.nvBoundLogout = "1";
      btn.addEventListener("click", (e)=>{ try{ e.preventDefault(); }catch(_){} logout(); });
    }catch(_){}
  }

  function updateUI(){
    const prof = getProfile();
    const logged = !!(prof.email && prof.email.includes("@"));

    // If the page already shows a logout button, treat as active session for docking (at least placeholder)
    const existingBtn = findLogoutButton();
    const sessionLike = logged || !!existingBtn;

    // Ensure button exists only if logged in
    const btn = sessionLike ? ensureLogoutButton() : findLogoutButton();

    // Hide injected button if not logged in
    const injected = document.getElementById(BTN_ID);
    if(injected){
      injected.style.display = logged ? "inline-flex" : "none";
    }

    // Ensure avatar dock
    const dock = ensureAvatarDock();
    if(!btn){
      dock.style.display = "none";
      return;
    }

    // Bind logout to the button (even if it is page-provided)
    bindLogoutOnce(btn);

    // Use stored picture or placeholder
    const img = document.getElementById(IMG_ID);
    if(img){
      const initials = initialsFromName(prof.name || prof.email);
      const placeholder = placeholderAvatarDataUri(initials);
      img.src = (prof.picture && prof.picture !== "null" ? prof.picture : placeholder);
    }

    // Make visible + position
    dock.style.display = "block";
    positionDockAboveButton(dock, btn);

    // If the page has an internal avatar inside any previous widget, hide it to avoid duplicates
    const old = document.getElementById("logoutAvatar");
    if(old) old.style.display = "none";
  }

  // ---------- bootstrap ----------
  function mount(){
    try{ updateUI(); }catch(_){}
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", mount, {once:true});
  }else{
    mount();
  }

  // Keep in sync (login happens after page load)
  window.addEventListener("pageshow", mount);
  window.addEventListener("storage", mount);
  window.addEventListener("resize", mount);
  window.addEventListener("scroll", mount, {passive:true});

  // Light refresh loop (profile picture may appear later)
  setInterval(()=>{ try{ updateUI(); }catch(_){} }, 1500);

})();