/* NeuroVerbs — Mensajería interna LOCAL (sin Worker / sin servidor)
   ✅ Funciona entre páginas/pestañas del MISMO navegador (mismo dominio) usando BroadcastChannel.
   ✅ Historial temporal por pestaña (sessionStorage). Se borra al cerrar la pestaña.
   ✅ Lista de usuarios activos (logueados) en ESTA sesión de navegador (presencia local).
   ⚠️ Sin servidor NO es posible mensajería entre diferentes dispositivos.
   ✅ Regla: solo se permite conversar en INGLÉS (se bloquean mensajes detectados como español).
*/
(function(){
  "use strict";

  const ROOT_ID = "nvLocalMessenger";
  const STYLE_ID = "nvLocalMessengerStyles";
  const DEFAULT_ROOM = "global";
  const MAX_MSG = 80;

  const PRESENCE_CHANNEL = "nv_presence_v1";
  const PRESENCE_TTL_MS = 25000;     // un usuario se considera "activo" si se vio en los últimos 25s
  const PRESENCE_PING_MS = 8000;     // cada 8s enviamos "ping" de presencia

  if (document.getElementById(ROOT_ID)) return;

  // ===== helpers =====
  function safeGet(key){
    try{ return localStorage.getItem(key); }catch(_){ return null; }
  }
  function safeSessionGet(key){
    try{ return sessionStorage.getItem(key); }catch(_){ return null; }
  }
  function safeSessionSet(key, val){
    try{ sessionStorage.setItem(key, val); }catch(_){}
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
    s = s.replace(/[^a-z0-9_-]/g, "-").replace(/-+/g,"-").slice(0, 48);
    return s || DEFAULT_ROOM;
  }
  function roomKey(room){ return "nv_local_chat_room_" + room; }

  function hashRoom(a, b){
    // DM determinístico por par de emails (ordenado)
    const x = String(a||"").toLowerCase().trim();
    const y = String(b||"").toLowerCase().trim();
    const pair = [x,y].sort().join("|");
    // mini-hash local (sin crypto libs). Usamos una suma hash simple estable.
    let h = 2166136261;
    for(let i=0;i<pair.length;i++){
      h ^= pair.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return "dm_" + (h >>> 0).toString(16);
  }

  // ===== English-only (heurística) =====
  // Nota: no es un detector perfecto, pero bloquea español "evidente".
  const ES_STOP = new Set([
    "que","de","la","el","y","en","a","los","las","un","una","por","para","con","no",
    "es","soy","eres","somos","son","hola","gracias","porfavor","por favor","buenos","buenas",
    "como","cómo","estás","estas","estoy","muy","bien","mal","porque","porqué","tambien","también",
    "quiero","necesito","tengo","tiene","tienes","vamos","hoy","mañana","ayer","si","sí",
    "pero","entonces","donde","dónde","cuando","cuándo","quien","quién","usted","ustedes",
    "profe","profesor","docente","tarea","clase","colegio","medellin","medellín","prado"
  ]);

  function looksSpanish(text){
    const t0 = String(text||"").trim();
    if(!t0) return false;

    // 1) acentos / ñ
    if(/[ñÑáéíóúÁÉÍÓÚ¿¡]/.test(t0)) return true;

    // 2) stopwords ratio
    const t = t0.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu," ")
      .replace(/\s+/g," ")
      .trim();

    if(!t) return false;

    const words = t.split(" ").filter(Boolean);
    if(words.length <= 2) return false;

    let hits = 0;
    for(const w of words){
      if(ES_STOP.has(w)) hits++;
    }
    const ratio = hits / words.length;

    // Si hay 2+ stopwords y ratio alto -> español
    if(hits >= 2 && ratio >= 0.22) return true;

    // frases típicas
    if(/\b(quiero|necesito|por favor|gracias|buenos dias|buenas tardes|buenas noches)\b/i.test(t0)) return true;

    return false;
  }

  // ===== Styles =====
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
  width: 380px;
  max-width: calc(100vw - 32px);
  height: 560px;
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

#${ROOT_ID} .nvUsersBar{
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
#${ROOT_ID} .nvUsersTitle{
  font-size: 12px; font-weight: 950; letter-spacing:.2px;
  display:flex; justify-content:space-between; align-items:center;
}
#${ROOT_ID} .nvUsersHint{ font-size: 11px; opacity:.72; margin-top: 2px; }
#${ROOT_ID} .nvUsers{
  display:flex; flex-wrap:wrap; gap:8px;
  margin-top: 8px;
}
#${ROOT_ID} .nvUserChip{
  display:inline-flex; align-items:center; gap:8px;
  border-radius: 999px;
  padding: 7px 10px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.22);
  color: rgba(255,255,255,.92);
  cursor:pointer;
  font-weight: 900;
  font-size: 12px;
}
#${ROOT_ID} .nvUserChip:hover{ filter: brightness(1.06); transform: translateY(-1px); }
#${ROOT_ID} .nvUserChip:active{ transform: translateY(0px); }
#${ROOT_ID} .nvUserChip img{
  width: 18px; height: 18px; border-radius: 999px; object-fit:cover;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.22);
}
#${ROOT_ID} .nvBadge{
  font-size: 10px;
  padding: 4px 7px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  opacity: .9;
}

#${ROOT_ID} .nvBody{
  height: calc(100% - 240px);
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
  height: 96px;
  border-top: 1px solid rgba(255,255,255,.10);
  padding: 10px 12px;
  display:flex; gap: 8px; align-items:flex-end;
  background: rgba(0,0,0,.12);
}
#${ROOT_ID} .nvInput{
  flex: 1;
  min-height: 46px;
  max-height: 76px;
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
  width: 78px;
  height: 46px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.10);
  color: rgba(255,255,255,.92);
  font-weight: 900;
  cursor:pointer;
}
#${ROOT_ID} .nvSend.disabled{
  opacity: .45;
  cursor:not-allowed;
}
#${ROOT_ID} .nvSend:hover{ filter: brightness(1.06); }
#${ROOT_ID} .nvSend:active{ transform: translateY(1px); }

@media (max-width: 520px){
  #${ROOT_ID}{ right:12px; bottom:12px; }
  #${ROOT_ID} .nvPanel{ width: calc(100vw - 24px); height: 76vh; }
}
@media print{
  #${ROOT_ID}{ display:none !important; }
}
    `;
    document.head.appendChild(st);
  }

  // ===== UI =====
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="nvPanel" role="dialog" aria-label="Mensajería interna">
      <div class="nvHeader">
        <div class="nvHdrLeft">
          <div class="nvTitle">Mensajería interna (Local)</div>
          <div class="nvSub">Solo pestañas del mismo navegador • temporal • inglés</div>
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

      <div class="nvUsersBar">
        <div class="nvUsersTitle">
          <span>Usuarios activos</span>
          <span class="nvBadge" id="nvUsersCount">0</span>
        </div>
        <div class="nvUsersHint">Toca un usuario para iniciar chat 1 a 1 (DM).</div>
        <div class="nvUsers" id="nvUsers"></div>
      </div>

      <div class="nvBody" id="nvBody">
        <div class="nvNote" id="nvNote">
          🔒 Inicia sesión para chatear con otros estudiantes logueados.
        </div>
        <div id="nvMsgs"></div>
      </div>

      <div class="nvFooter">
        <textarea class="nvInput" id="nvInput" placeholder="Write in English..." maxlength="700"></textarea>
        <button class="nvSend" id="nvSend" type="button">Send</button>
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
  const usersHost = document.getElementById("nvUsers");
  const usersCount = document.getElementById("nvUsersCount");

  // ===== State =====
  let room = DEFAULT_ROOM;
  let bc = null;

  // Presence
  let bcPresence = null;
  const online = new Map(); // email -> {name,email,picture,lastSeen}

  function loadRoom(){
    try{
      const u = new URL(location.href);
      const r = u.searchParams.get("chatroom");
      if(r) return sanitizeRoom(r);
    }catch(_){}
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
    const prof = getProfile();
    if(isLoggedIn()){
      note.innerHTML = `✅ Connected as <b>${esc(prof.name)}</b> (${esc(prof.email)}) • Room: <b>${esc(room)}</b><br/><span style="opacity:.85">Rule: English only.</span>`;
      input.placeholder = "Write in English...";
      btnSend.classList.remove("disabled");
      btnSend.disabled = false;
      input.disabled = false;
    }else{
      note.innerHTML = `🔒 Inicia sesión para chatear con otros estudiantes logueados.<br/><span style="opacity:.85">Regla: solo inglés (English only).</span>`;
      input.placeholder = "Login required";
      btnSend.classList.add("disabled");
      btnSend.disabled = true;
      input.disabled = true;
    }
  }

  function renderUsers(){
    // Limpia expirados
    const t = now();
    for(const [email, u] of Array.from(online.entries())){
      if(!u || !u.lastSeen || (t - u.lastSeen) > PRESENCE_TTL_MS){
        online.delete(email);
      }
    }

    const my = getProfile();
    const myEmail = (my?.email||"").toLowerCase();

    const list = Array.from(online.values())
      .filter(u => u.email && u.email !== myEmail)
      .sort((a,b)=>(a.name||"").localeCompare(b.name||""));

    usersCount.textContent = String(list.length);

    if(!list.length){
      usersHost.innerHTML = `<span style="opacity:.75; font-size:12px;">No hay otros estudiantes activos en esta sesión.</span>`;
      return;
    }

    usersHost.innerHTML = list.map(u=>{
      const pic = u.picture || "assets/brain.png";
      const name = u.name || "Estudiante";
      return `<button class="nvUserChip" type="button" data-email="${esc(u.email)}" data-name="${esc(name)}">
        <img src="${esc(pic)}" alt=""/>
        <span>${esc(name)}</span>
      </button>`;
    }).join("");

    // click -> DM
    usersHost.querySelectorAll(".nvUserChip").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const otherEmail = btn.getAttribute("data-email") || "";
        const otherName = btn.getAttribute("data-name") || "Student";
        const me = getProfile();
        if(!me || !me.email){
          setNote();
          return;
        }
        const dmRoom = hashRoom(me.email, otherEmail);
        roomInp.value = dmRoom;
        connect(dmRoom);
        // small system notice
        pushSystem(`DM with ${otherName} • English only`);
      });
    });
  }

  function render(){
    const me = getProfile();
    const meEmail = (me?.email||"").toLowerCase();

    msgsHost.innerHTML = history.map(m=>{
      const isMe = meEmail && m.email && (m.email === meEmail);
      const avatar = isMe ? (me?.picture || "") : (m.picture || "");
      const who = isMe ? "You" : (m.name || "Student");
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
    roomInp.value = room;

    // history
    history = loadHistory(room);
    setNote();
    render();

    // disconnect prev
    if(bc){
      try{ bc.close(); }catch(_){}
      bc = null;
    }

    if("BroadcastChannel" in window){
      try{
        bc = new BroadcastChannel("nv_chat_" + room);
        bc.onmessage = (ev)=>{
          const msg = ev?.data;
          if(!msg || !msg.id || msg.room !== room) return;
          if(history.some(x=>x.id===msg.id)) return;
          history.push(msg);
          history = history.slice(-MAX_MSG);
          saveHistory(room, history);
          render();
        };
      }catch(_){ bc = null; }
    }

    // storage fallback for messages
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

  function broadcastMsg(msg){
    if(bc){
      try{ bc.postMessage(msg); return; }catch(_){}
    }
    try{
      localStorage.setItem("nv_chat_broadcast", JSON.stringify(msg));
      setTimeout(()=>{ try{ localStorage.removeItem("nv_chat_broadcast"); }catch(_){ } }, 800);
    }catch(_){}
  }

  function pushSystem(text){
    const msg = { id: uid(), room, ts: now(), name:"System", email:"", picture:"", text: String(text||"") };
    history.push(msg);
    history = history.slice(-MAX_MSG);
    saveHistory(room, history);
    render();
  }

  function send(){
    const text = String(input.value || "").trim();
    if(!text) return;

    // must be logged in
    if(!isLoggedIn()){
      setNote();
      return;
    }

    // English-only rule
    if(looksSpanish(text)){
      pushSystem("❌ Spanish detected. Please write in English.");
      return;
    }

    const prof = getProfile();
    const msg = {
      id: uid(),
      room,
      ts: now(),
      name: prof?.name || "Student",
      email: prof?.email || "",
      picture: prof?.picture || "",
      text
    };

    history.push(msg);
    history = history.slice(-MAX_MSG);
    saveHistory(room, history);
    render();
    broadcastMsg(msg);

    input.value = "";
    input.focus();
  }

  // ===== Presence (online users) =====
  function connectPresence(){
    if(!("BroadcastChannel" in window)) return;
    try{
      bcPresence = new BroadcastChannel(PRESENCE_CHANNEL);
      bcPresence.onmessage = (ev)=>{
        const p = ev?.data;
        if(!p || p.type !== "presence" || !p.email) return;
        online.set(String(p.email).toLowerCase(), {
          name: p.name || "Student",
          email: String(p.email).toLowerCase(),
          picture: p.picture || "",
          lastSeen: now()
        });
        renderUsers();
      };
    }catch(_){ bcPresence = null; }
  }

  function pingPresence(){
    if(!bcPresence) return;
    if(!isLoggedIn()){
      // no mostramos como activo si no hay login
      return;
    }
    const prof = getProfile();
    if(!prof || !prof.email) return;

    try{
      bcPresence.postMessage({
        type: "presence",
        email: prof.email,
        name: prof.name,
        picture: prof.picture,
        ts: now()
      });
    }catch(_){}
  }

  // ===== Events =====
  fab.addEventListener("click", ()=>{
    root.classList.toggle("open");
    if(root.classList.contains("open")){
      setNote();
      renderUsers();
      if(!input.disabled) input.focus();
      // ping inmediato al abrir
      pingPresence();
    }
  });

  btnClose.addEventListener("click", ()=>{ root.classList.remove("open"); });

  btnClear.addEventListener("click", ()=>{
    history = [];
    saveHistory(room, history);
    render();
  });

  btnSend.addEventListener("click", send);

  input.addEventListener("keydown", (e)=>{
    if(e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      send();
    }
  });

  btnJoin.addEventListener("click", ()=>{
    const r = sanitizeRoom(roomInp.value || roomSel.value || DEFAULT_ROOM);
    connect(r);
    pushSystem(`Room: ${r} • English only`);
  });

  roomSel.addEventListener("change", ()=>{ roomInp.value = roomSel.value; });

  // update note if login changes
  window.addEventListener("storage", (e)=>{
    if(e.key === "user_profile" || e.key === "google_id_token"){
      setNote();
      // ping presencia al iniciar sesión
      setTimeout(()=>{ pingPresence(); }, 300);
      renderUsers();
      render();
    }
  });

  // ===== Init =====
  connectPresence();
  connect(loadRoom());
  setNote();
  renderUsers();

  // ping presencia periódicamente
  setInterval(()=>{
    pingPresence();
    renderUsers();
  }, PRESENCE_PING_MS);

})();
