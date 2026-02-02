/* NeuroVerbs — Mensajería interna LOCAL (sin Worker / sin servidor)
   ✅ Funciona entre páginas/pestañas del MISMO navegador (mismo dominio) usando BroadcastChannel.
   ✅ Historial temporal por pestaña (sessionStorage). Se borra al cerrar la pestaña.
   ⚠️ Sin servidor NO es posible mensajería entre diferentes dispositivos.
*/
(function(){
  "use strict";

  const ROOT_ID = "nvLocalMessenger";
  const STYLE_ID = "nvLocalMessengerStyles";
  const DEFAULT_ROOM = "global";
  const MAX_MSG = 60;

  if (document.getElementById(ROOT_ID)) return;

  function safeGet(key){
    try{ return localStorage.getItem(key); }catch(_){ return null; }
  }
  function safeSessionGet(key){
    try{ return sessionStorage.getItem(key); }catch(_){ return null; }
  }
  function safeSessionSet(key, val){
    try{ sessionStorage.setItem(key, val); }catch(_){}
  }
  function safeSessionRemove(key){
    try{ sessionStorage.removeItem(key); }catch(_){}
  }
  function safeJsonParse(raw, fallback){
    if(!raw) return fallback;
    try{ return JSON.parse(raw); }catch(_){ return fallback; }
  }
  function esc(s){
    return String(s ?? "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }
  function uid(){
    return "m_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }
  function now(){ return Date.now(); }
  function formatTime(ts){
    try{
      const d = new Date(ts);
      return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    }catch(_){ return ""; }
  }
  function getProfile(){
    const prof = safeJsonParse(safeGet("user_profile"), null);
    if (prof && (prof.name || prof.email)) return {
      name: prof.name || "Estudiante",
      email: (prof.email || "").toLowerCase(),
      picture: prof.picture || ""
    };
    return null;
  }
  function isLoggedIn(){
    const prof = getProfile();
    const token = safeGet("google_id_token");
    return !!(prof && prof.email && token);
  }
  function sanitizeRoom(s){
    s = String(s || "").trim().toLowerCase();
    if(!s) return DEFAULT_ROOM;
    // solo letras, números, guion y guion bajo
    s = s.replace(/[^a-z0-9_-]/g, "-").replace(/-+/g,"-").slice(0, 40);
    return s || DEFAULT_ROOM;
  }
  function roomKey(room){ return "nv_local_chat_room_" + room; }

  // ====== Styles (inline) ======
  if(!document.getElementById(STYLE_ID)){
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
#${ROOT_ID}{ position:fixed; right:16px; bottom:16px; z-index:99998; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; }
#${ROOT_ID} .nvFab{
  width:56px; height:56px; border-radius:999px; border:1px solid rgba(255,255,255,.18);
  background: linear-gradient(135deg, rgba(255,176,52,.95), rgba(255,110,20,.95));
  color:#07101d; font-weight:900; cursor:pointer;
  box-shadow: 0 16px 40px rgba(0,0,0,.35);
  display:flex; align-items:center; justify-content:center;
  user-select:none;
}
#${ROOT_ID} .nvFab:hover{ filter: brightness(1.03); transform: translateY(-1px); }
#${ROOT_ID} .nvFab:active{ transform: translateY(0px); }

#${ROOT_ID} .nvPanel{
  width: 360px;
  max-width: calc(100vw - 32px);
  height: 520px;
  max-height: calc(100vh - 110px);
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(10,16,32,.92);
  backdrop-filter: blur(12px);
  box-shadow: 0 24px 70px rgba(0,0,0,.50);
  overflow: hidden;
  display:none;
  margin-bottom: 10px;
}
#${ROOT_ID}.open .nvPanel{ display:block; }
#${ROOT_ID}.open .nvFab{ background: rgba(0,0,0,.30); color: rgba(255,255,255,.92); border-color: rgba(255,255,255,.18); }

#${ROOT_ID} .nvHeader{
  display:flex; justify-content:space-between; align-items:center;
  padding: 12px 12px;
  border-bottom: 1px solid rgba(255,255,255,.10);
}
#${ROOT_ID} .nvTitle{ font-weight: 950; letter-spacing:.2px; font-size: 14px; }
#${ROOT_ID} .nvSub{ font-size: 11px; opacity: .75; margin-top: 2px; }
#${ROOT_ID} .nvHdrLeft{ display:flex; flex-direction:column; gap:2px; }

#${ROOT_ID} .nvHdrBtns{ display:flex; gap:8px; align-items:center; }
#${ROOT_ID} .nvIconBtn{
  width: 34px; height: 34px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  cursor:pointer;
}
#${ROOT_ID} .nvIconBtn:hover{ filter: brightness(1.06); }
#${ROOT_ID} .nvIconBtn:active{ transform: translateY(1px); }

#${ROOT_ID} .nvRoomBar{
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  display:flex; gap:8px; align-items:center; flex-wrap:wrap;
}
#${ROOT_ID} .nvSel, #${ROOT_ID} .nvInp{
  border-radius: 999px;
  padding: 9px 10px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.25);
  color: rgba(255,255,255,.92);
  outline: none;
  font-weight: 800;
  font-size: 12px;
}
#${ROOT_ID} .nvSel{ cursor:pointer; }
#${ROOT_ID} .nvBtn{
  border-radius: 999px;
  padding: 9px 12px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.08);
  color: rgba(255,255,255,.92);
  font-weight: 900;
  cursor:pointer;
  font-size: 12px;
}
#${ROOT_ID} .nvBtn.primary{
  background: linear-gradient(135deg, rgba(0,255,178,.95), rgba(0,140,255,.95));
  color: #07101d;
  border-color: rgba(255,255,255,.18);
}
#${ROOT_ID} .nvBtn:hover{ filter: brightness(1.05); transform: translateY(-1px); }
#${ROOT_ID} .nvBtn:active{ transform: translateY(0px); }

#${ROOT_ID} .nvBody{
  height: calc(100% - 162px);
  overflow:auto;
  padding: 12px 12px;
}
#${ROOT_ID} .nvNote{
  font-size: 12px;
  opacity: .78;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px dashed rgba(255,255,255,.16);
  background: rgba(0,0,0,.18);
  margin-bottom: 10px;
}

#${ROOT_ID} .nvMsg{ display:flex; gap:10px; margin: 10px 0; align-items:flex-end; }
#${ROOT_ID} .nvMsg.me{ justify-content:flex-end; }
#${ROOT_ID} .nvAvatar{
  width: 28px; height: 28px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.25);
  object-fit: cover;
}
#${ROOT_ID} .nvBubble{
  max-width: 78%;
  border-radius: 16px;
  padding: 10px 10px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  box-shadow: 0 10px 22px rgba(0,0,0,.22);
}
#${ROOT_ID} .nvMsg.me .nvBubble{
  background: linear-gradient(135deg, rgba(0,255,178,.22), rgba(0,140,255,.22));
  border-color: rgba(0,255,178,.25);
}
#${ROOT_ID} .nvMeta{ font-size: 11px; opacity:.72; margin-bottom: 6px; display:flex; justify-content:space-between; gap:10px; }
#${ROOT_ID} .nvText{ font-size: 13px; line-height: 1.35; white-space: pre-wrap; word-break: break-word; }

#${ROOT_ID} .nvFooter{
  height: 86px;
  border-top: 1px solid rgba(255,255,255,.10);
  padding: 10px 12px;
  display:flex; gap: 8px; align-items:flex-end;
  background: rgba(0,0,0,.12);
}
#${ROOT_ID} .nvInput{
  flex: 1;
  min-height: 46px;
  max-height: 64px;
  resize: none;
  border-radius: 14px;
  padding: 10px 10px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.25);
  color: rgba(255,255,255,.92);
  outline:none;
  font-weight: 700;
  font-size: 13px;
}
#${ROOT_ID} .nvSend{
  width: 72px;
  height: 46px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.10);
  color: rgba(255,255,255,.92);
  font-weight: 900;
  cursor:pointer;
}
#${ROOT_ID} .nvSend:hover{ filter: brightness(1.06); }
#${ROOT_ID} .nvSend:active{ transform: translateY(1px); }

@media (max-width: 520px){
  #${ROOT_ID}{ right:12px; bottom:12px; }
  #${ROOT_ID} .nvPanel{ width: calc(100vw - 24px); height: 70vh; }
}
@media print{
  #${ROOT_ID}{ display:none !important; }
}
    `;
    document.head.appendChild(st);
  }

  // ====== UI ======
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="nvPanel" role="dialog" aria-label="Mensajería interna">
      <div class="nvHeader">
        <div class="nvHdrLeft">
          <div class="nvTitle">Mensajería interna (Local)</div>
          <div class="nvSub">Solo pestañas del mismo navegador • temporal</div>
        </div>
        <div class="nvHdrBtns">
          <button class="nvIconBtn" id="nvMsgClear" type="button" title="Limpiar mensajes">🧹</button>
          <button class="nvIconBtn" id="nvMsgClose" type="button" title="Minimizar">▾</button>
        </div>
      </div>

      <div class="nvRoomBar">
        <select class="nvSel" id="nvRoomSel" aria-label="Sala">
          <option value="global">Global</option>
          <option value="docente">Docente</option>
          <option value="grupo-10-2">Grupo 10-2</option>
          <option value="grupo-10-1">Grupo 10-1</option>
          <option value="grupo-11">Grupo 11</option>
        </select>
        <input class="nvInp" id="nvRoomInp" placeholder="Sala personalizada..." />
        <button class="nvBtn primary" id="nvRoomJoin" type="button">Entrar</button>
      </div>

      <div class="nvBody" id="nvBody">
        <div class="nvNote" id="nvNote">
          🔒 Inicia sesión para identificar al remitente. (Sin servidor, esta mensajería funciona solo entre pestañas del mismo navegador.)
        </div>
        <div id="nvMsgs"></div>
      </div>

      <div class="nvFooter">
        <textarea class="nvInput" id="nvInput" placeholder="Escribe un mensaje..." maxlength="700"></textarea>
        <button class="nvSend" id="nvSend" type="button">Enviar</button>
      </div>
    </div>
    <button class="nvFab" id="nvFab" type="button" aria-label="Abrir mensajería">💬</button>
  `;
  document.body.appendChild(root);

  const fab = document.getElementById("nvFab");
  const btnClose = document.getElementById("nvMsgClose");
  const btnClear = document.getElementById("nvMsgClear");
  const body = document.getElementById("nvBody");
  const note = document.getElementById("nvNote");
  const msgsHost = document.getElementById("nvMsgs");
  const input = document.getElementById("nvInput");
  const btnSend = document.getElementById("nvSend");
  const roomSel = document.getElementById("nvRoomSel");
  const roomInp = document.getElementById("nvRoomInp");
  const btnJoin = document.getElementById("nvRoomJoin");

  // ====== State ======
  let room = DEFAULT_ROOM;
  let bc = null;
  let my = getProfile();

  function loadRoom(){
    // 1) URL ?chatroom=
    try{
      const u = new URL(location.href);
      const r = u.searchParams.get("chatroom");
      if(r) return sanitizeRoom(r);
    }catch(_){}

    // 2) session
    const saved = safeSessionGet("nv_local_room");
    if(saved) return sanitizeRoom(saved);

    return DEFAULT_ROOM;
  }

  function loadHistory(r){
    const raw = safeSessionGet(roomKey(r));
    const arr = safeJsonParse(raw, []);
    return Array.isArray(arr) ? arr.slice(-MAX_MSG) : [];
  }
  function saveHistory(r, arr){
    safeSessionSet(roomKey(r), JSON.stringify(arr.slice(-MAX_MSG)));
  }

  let history = [];

  function setNote(){
    my = getProfile();
    if(isLoggedIn()){
      note.innerHTML = `✅ Conectado como <b>${esc(my.name)}</b> (${esc(my.email)}) • Sala: <b>${esc(room)}</b>`;
    }else{
      note.innerHTML = `🔒 Para que se sepa quién envió el mensaje, inicia sesión. • Sala: <b>${esc(room)}</b><br/><span style="opacity:.85">Sin servidor, esta mensajería funciona solo entre pestañas del mismo navegador.</span>`;
    }
  }

  function render(){
    msgsHost.innerHTML = history.map(m=>{
      const isMe = my && m.email && my.email && (m.email === my.email);
      const avatar = isMe ? (my.picture || "") : (m.picture || "");
      const who = isMe ? "Tú" : (m.name || "Usuario");
      const em = m.email || "";
      const metaLeft = `${esc(who)}${em ? " • " + esc(em) : ""}`;
      const metaRight = formatTime(m.ts || now());
      return `
        <div class="nvMsg ${isMe ? "me" : ""}">
          ${isMe ? "" : `<img class="nvAvatar" src="${esc(avatar || "assets/brain.png")}" alt=""/>`}
          <div class="nvBubble">
            <div class="nvMeta"><span>${metaLeft}</span><span>${metaRight}</span></div>
            <div class="nvText">${esc(m.text || "")}</div>
          </div>
          ${isMe ? `<img class="nvAvatar" src="${esc(avatar || "assets/brain.png")}" alt=""/>` : ""}
        </div>
      `;
    }).join("");

    // scroll down
    try{ body.scrollTop = body.scrollHeight; }catch(_){}
  }

  function connect(r){
    room = sanitizeRoom(r);
    safeSessionSet("nv_local_room", room);

    // ui select
    if(roomSel){
      const hasOpt = Array.from(roomSel.options).some(o=>o.value===room);
      if(hasOpt) roomSel.value = room;
    }
    if(roomInp) roomInp.value = room;

    // history
    history = loadHistory(room);
    setNote();
    render();

    // disconnect prev
    if(bc){
      try{ bc.close(); }catch(_){}
      bc = null;
    }

    // BroadcastChannel
    if("BroadcastChannel" in window){
      try{
        bc = new BroadcastChannel("nv_chat_" + room);
        bc.onmessage = (ev)=>{
          const msg = ev?.data;
          if(!msg || !msg.id || msg.room !== room) return;
          // avoid duplicates
          if(history.some(x=>x.id===msg.id)) return;
          history.push(msg);
          history = history.slice(-MAX_MSG);
          saveHistory(room, history);
          render();
        };
      }catch(_){ bc = null; }
    }

    // fallback: listen to storage events (last resort)
    window.addEventListener("storage", (e)=>{
      if(!e || e.key !== "nv_chat_broadcast") return;
      const msg = safeJsonParse(e.newValue, null);
      if(!msg || msg.room !== room) return;
      if(history.some(x=>x.id===msg.id)) return;
      history.push(msg);
      history = history.slice(-MAX_MSG);
      saveHistory(room, history);
      render();
    });
  }

  function broadcast(msg){
    // primary
    if(bc){
      try{ bc.postMessage(msg); return; }catch(_){}
    }
    // fallback (localStorage event)
    try{
      localStorage.setItem("nv_chat_broadcast", JSON.stringify(msg));
      // no persist: cleanup quickly
      setTimeout(()=>{ try{ localStorage.removeItem("nv_chat_broadcast"); }catch(_){ } }, 800);
    }catch(_){}
  }

  function send(){
    const text = String(input.value || "").trim();
    if(!text) return;

    my = getProfile();
    const logged = isLoggedIn();

    const msg = {
      id: uid(),
      room,
      ts: now(),
      name: logged && my ? my.name : "Anónimo",
      email: logged && my ? my.email : "",
      picture: logged && my ? my.picture : "",
      text
    };

    // local append
    history.push(msg);
    history = history.slice(-MAX_MSG);
    saveHistory(room, history);
    render();
    broadcast(msg);

    input.value = "";
    input.focus();
  }

  // ====== Events ======
  fab.addEventListener("click", ()=>{ root.classList.toggle("open"); if(root.classList.contains("open")) input?.focus(); });
  btnClose.addEventListener("click", ()=>{ root.classList.remove("open"); });

  btnClear.addEventListener("click", ()=>{
    history = [];
    saveHistory(room, history);
    render();
  });

  btnSend.addEventListener("click", send);
  input.addEventListener("keydown", (e)=>{
    // Enter to send, Shift+Enter newline
    if(e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      send();
    }
  });

  btnJoin.addEventListener("click", ()=>{
    const r = sanitizeRoom(roomInp.value || roomSel.value || DEFAULT_ROOM);
    connect(r);
  });
  roomSel.addEventListener("change", ()=>{
    roomInp.value = roomSel.value;
  });

  // update note if login changes
  window.addEventListener("storage", (e)=>{
    if(e.key === "user_profile" || e.key === "google_id_token"){
      setNote();
      render();
    }
  });

  // init
  connect(loadRoom());
})();
