/* NEUROVERBS — Chat interno (English only)
   - Visible en todas las páginas
   - Requiere usuario logueado (localStorage.user_profile)
   - Backend recomendado: Cloudflare Worker + KV (CHAT_KV)
*/
(function(){
  const ROOM_LS_KEY = "nv_chat_room_v1";
  const ROOMS_LS_KEY = "nv_chat_rooms_v1";
  const DEFAULT_API_BASE = (function(){
    const ls = (localStorage.getItem("NEUROVERBS_API_BASE") || "").trim();
    return (ls ? ls : "https://neuroverbs-api.yoguisindevoz.workers.dev").replace(/\/$/, "");
  })();

  function $(id){ return document.getElementById(id); }

  function safeParse(jsonStr){
    try{ return JSON.parse(jsonStr); }catch(_){ return null; }
  }

  function getProfile(){
    const p = safeParse(localStorage.getItem("user_profile") || "");
    if (!p || typeof p !== "object") return null;
    return {
      name: p.name || p.nombre || "Usuario",
      email: p.email || p.correo || "",
      picture: p.picture || p.foto || ""
    };
  }

  function safeGet(key){
    try{ return localStorage.getItem(key); }catch(_){ return null; }
  }
  function safeSet(key, val){
    try{ localStorage.setItem(key, val); }catch(_){ }
  }

  function sanitizeGroup(g){
    const s = String(g||"").trim();
    if(!s) return "";
    // allow: letters, numbers, dash, underscore
    return s.replace(/\s+/g,"-").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,12);
  }

  function makeRoomCode(group, code){
    const g = sanitizeGroup(group);
    const c = String(code||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
    if(!g || !c) return "";
    return `${g}@${c}`;
  }

  function parseRoomCode(raw){
    const s = String(raw||"").trim();
    if(!s) return null;
    if(s.toLowerCase() === "global") return { room:"global", group:"Global", code:"" };
    // support "10-2@ABC123" or "10-2 ABC123" or "10-2-ABC123" (best-effort)
    if(s.includes("@")){
      const [g,c] = s.split("@");
      const group = sanitizeGroup(g);
      const code = String(c||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
      if(group && code) return { room: makeRoomCode(group, code), group, code };
    }
    const parts = s.replace(/\s+/g," ").split(" ");
    if(parts.length===2){
      const group = sanitizeGroup(parts[0]);
      const code = String(parts[1]||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
      if(group && code) return { room: makeRoomCode(group, code), group, code };
    }
    const m = s.match(/^([a-zA-Z0-9_-]{1,12})[-_ ]([A-Za-z0-9]{4,8})$/);
    if(m){
      const group = sanitizeGroup(m[1]);
      const code = String(m[2]||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
      if(group && code) return { room: makeRoomCode(group, code), group, code };
    }
    return null;
  }

  function readRooms(){
    try{
      const raw = safeGet(ROOMS_LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }
  function writeRooms(arr){
    safeSet(ROOMS_LS_KEY, JSON.stringify(Array.isArray(arr)?arr:[]));
  }

  function ensureRoomListHasGlobal(){
    const rooms = readRooms();
    if(!rooms.some(r=>r && r.room === "global")) rooms.unshift({room:"global", group:"Global", code:""});
    writeRooms(rooms.slice(0,20));
  }

  function getCurrentRoom(){
    const raw = safeGet(ROOM_LS_KEY);
    const parsed = parseRoomCode(raw);
    if(parsed) return parsed;
    return { room:"global", group:"Global", code:"" };
  }

  function setCurrentRoom(roomObj, {silent=false}={}){
    if(!roomObj || !roomObj.room) return;
    safeSet(ROOM_LS_KEY, roomObj.room);
    // ensure it exists in list
    const rooms = readRooms();
    const idx = rooms.findIndex(r=>r && r.room === roomObj.room);
    if(idx === -1){
      rooms.push({room: roomObj.room, group: roomObj.group || "", code: roomObj.code || ""});
      writeRooms(rooms.slice(-20));
    }
    state.room = roomObj.room;
    state.roomMeta = roomObj;
    if(!silent){
      refreshRoomUI();
      resetConversation();
      if(state.isOpen) poll();
    }
  }

  function removeRoom(room){
    const rooms = readRooms().filter(r=>r && r.room !== room && r.room !== "global");
    ensureRoomListHasGlobal();
    writeRooms([{room:"global", group:"Global", code:""}, ...rooms].slice(0,20));
    if(state.room === room){
      setCurrentRoom({room:"global", group:"Global", code:""});
    }else{
      refreshRoomUI();
    }
  }

  function genCode(len=6){
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out="";
    for(let i=0;i<len;i++) out += alphabet[Math.floor(Math.random()*alphabet.length)];
    return out;
  }

  function ensureUI(){
    if ($("nvChatWidget")) return;

    const launcher = document.createElement("div");
    launcher.id = "nvChatLauncher";
    launcher.innerHTML = `
      <button type="button" aria-label="Abrir chat">
        <span style="font-size:16px">💬</span>
        <span style="font-weight:800; font-size:13px">Chat</span>
      </button>
    `;

    const widget = document.createElement("div");
    widget.id = "nvChatWidget";
    widget.innerHTML = `
      <div id="nvChatHeader">
        <div id="nvChatTitle">
          <strong>Chat interno</strong>
          <span>⚠️ Solo se puede hablar en <b>inglés</b></span>
          <div id="nvChatRoomBar">
            <span class="nvRoomPill" id="nvRoomPill"><b>Room</b>: <span id="nvRoomName">Global</span></span>
            <button class="nvRoomBtn" id="nvChatRoomsBtn" type="button">Salas</button>
          </div>
        </div>
        <div class="nvChatBtns">
          <button id="nvChatMinBtn" title="Minimizar">—</button>
          <button id="nvChatCloseBtn" title="Cerrar">×</button>
        </div>
      </div>

      <div id="nvChatRoomsPanel" aria-hidden="true">
        <div class="nvRoomGrid">
          <div class="nvRoomCard">
            <h4>Entrar a una sala</h4>
            <div class="nvRoomRow">
              <input id="nvJoinRoom" placeholder="Código: 10-2@ABC123" />
              <button class="nvRoomBtn" id="nvJoinBtn" type="button">Entrar</button>
            </div>
            <div class="nvRoomHint">Tip: pega el código que te dio el docente (ej: <b>10-2@ABC123</b>). También sirve un link con <b>?room=...</b>.</div>
          </div>

          <div class="nvRoomCard">
            <h4>Docente: crear sala (con código)</h4>
            <div class="nvRoomRow">
              <input id="nvTeacherGroup" placeholder="Grupo (ej: 10-2)" />
              <button class="nvRoomBtn" id="nvCreateBtn" type="button">Crear</button>
              <button class="nvRoomBtn" id="nvCopyRoomBtn" type="button" style="display:none">Copiar</button>
            </div>
            <div class="nvRoomHint" id="nvTeacherOut"></div>
          </div>

          <div class="nvRoomCard">
            <h4>Mis salas</h4>
            <div class="nvRoomList" id="nvRoomList"></div>
          </div>
        </div>
      </div>

      <div id="nvChatBody">
        <div id="nvChatSystem">Inicia sesión para chatear con otros usuarios.</div>
      </div>

      <div id="nvChatFooter">
        <div id="nvChatNotice">💡 Regla: <b>English only</b>. Mensajes en español serán bloqueados.</div>
        <div id="nvChatInputRow">
          <textarea id="nvChatInput" rows="1" placeholder="Write in English…"></textarea>
          <button id="nvChatSend" disabled>Send</button>
        </div>
      </div>
    `;

    const toast = document.createElement("div");
    toast.className = "nvToast";
    toast.id = "nvChatToast";

    document.body.appendChild(launcher);
    document.body.appendChild(widget);
    document.body.appendChild(toast);

    launcher.querySelector("button").addEventListener("click", ()=> openChat(true));
    $("nvChatCloseBtn").addEventListener("click", ()=> closeChat(true));
    $("nvChatMinBtn").addEventListener("click", ()=> minimizeChat());
    $("nvChatRoomsBtn").addEventListener("click", toggleRoomsPanel);
    $("nvJoinBtn").addEventListener("click", joinFromInput);
    $("nvCreateBtn").addEventListener("click", teacherCreateRoom);
    $("nvCopyRoomBtn").addEventListener("click", copyTeacherRoom);

    const input = $("nvChatInput");
    input.addEventListener("input", ()=>{
      autoGrow(input);
      $("nvChatSend").disabled = !canSend();
    });
    input.addEventListener("keydown", (e)=>{
      if (e.key === "Enter" && !e.shiftKey){
        e.preventDefault();
        sendCurrent();
      }
    });
    $("nvChatSend").addEventListener("click", sendCurrent);

    launcher.style.display = "block";
    widget.classList.remove("open");

    // init rooms
    ensureRoomListHasGlobal();
    const initial = getCurrentRoom();
    state.room = initial.room;
    state.roomMeta = initial;
    refreshRoomUI();
  }

  function resetConversation(){
    const body = $("nvChatBody");
    if(body) body.innerHTML = `<div id="nvChatSystem">Sala: <b>${escapeHtml(state.roomMeta?.group || "Global")}</b>. Inicia sesión para chatear.</div>`;
    state.lastTs = 0;
  }

  function refreshRoomUI(){
    const rm = state.roomMeta || getCurrentRoom();
    const name = rm.group || (rm.room === "global" ? "Global" : rm.room);
    if($("nvRoomName")) $("nvRoomName").textContent = name;

    // list
    const list = $("nvRoomList");
    if(list){
      const rooms = readRooms();
      list.innerHTML = rooms.map(r=>{
        const label = (r.room === "global") ? "Global" : (r.group || r.room);
        const active = (r.room === rm.room);
        const removable = r.room !== "global";
        return `<button class="nvRoomTag ${active?"active":""}" data-room="${escapeHtml(r.room)}" type="button">${escapeHtml(label)}${removable?` <span class="x" data-x="1">×</span>`:""}</button>`;
      }).join("");
      list.querySelectorAll(".nvRoomTag").forEach(btn=>{
        btn.addEventListener("click", (e)=>{
          const room = btn.getAttribute("data-room") || "global";
          // if click on x -> remove
          const target = e.target;
          if(target && target.getAttribute && target.getAttribute("data-x")){
            removeRoom(room);
            return;
          }
          const parsed = parseRoomCode(room) || {room, group: room==="global"?"Global":room, code:""};
          setCurrentRoom(parsed);
        });
      });
    }
  }

  function toggleRoomsPanel(){
    const p = $("nvChatRoomsPanel");
    if(!p) return;
    const open = p.classList.toggle("open");
    p.setAttribute("aria-hidden", open?"false":"true");
    if(open) refreshRoomUI();
  }

  function joinFromInput(){
    const inp = $("nvJoinRoom");
    const val = String(inp?.value||"").trim();
    if(!val){ showToast("Pega un código de sala."); return; }
    const parsed = parseRoomCode(val);
    if(!parsed){ showToast("Código inválido. Ej: 10-2@ABC123"); return; }
    setCurrentRoom(parsed);
    if(inp) inp.value = "";
    // close panel
    const p = $("nvChatRoomsPanel");
    if(p) { p.classList.remove("open"); p.setAttribute("aria-hidden","true"); }
    showToast(`Sala: ${parsed.group}`);
  }

  function teacherCreateRoom(){
    const gEl = $("nvTeacherGroup");
    const out = $("nvTeacherOut");
    const copyBtn = $("nvCopyRoomBtn");
    const group = sanitizeGroup(gEl?.value || "");
    if(!group){
      if(out) out.textContent = "Escribe el grupo (ej: 10-2).";
      showToast("Falta el grupo.");
      return;
    }
    const code = genCode(6);
    const room = makeRoomCode(group, code);
    const link = buildRoomLink(room);
    state._teacherRoom = {room, group, code, link};
    if(out) out.innerHTML = `Código de sala: <b>${escapeHtml(room)}</b><br>Link: <span style="opacity:.9">${escapeHtml(link)}</span>`;
    if(copyBtn) copyBtn.style.display = "inline-flex";
    setCurrentRoom({room, group, code});
    showToast("Sala creada ✅");
  }

  function buildRoomLink(room){
    try{
      const u = new URL(window.location.href);
      u.searchParams.set("room", room);
      return u.toString();
    }catch(_){
      return String(window.location.href).split("#")[0] + (window.location.search?"&":"?") + "room=" + encodeURIComponent(room);
    }
  }

  async function copyTeacherRoom(){
    const tr = state._teacherRoom;
    if(!tr) return;
    const txt = `Sala: ${tr.room}\nLink: ${tr.link}`;
    const ok = await copyText(txt);
    if(ok) showToast("Copiado ✅");
  }

  async function copyText(txt){
    const t = String(txt||"");
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(t);
        return true;
      }
    }catch(_){ }
    try{
      const ta=document.createElement("textarea");
      ta.value=t;
      ta.style.position="fixed";
      ta.style.left="-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    }catch(_){ }
    return false;
  }

  function autoGrow(ta){
    ta.style.height = "auto";
    ta.style.height = Math.min(90, ta.scrollHeight) + "px";
  }

  function showToast(msg){
    const t = $("nvChatToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(showToast._to);
    showToast._to = setTimeout(()=> t.classList.remove("show"), 2600);
  }

  const SP = ["que", "de", "la", "el", "en", "y", "a", "los", "del", "se", "las", "por", "un", "para", "con", "no", "una", "su", "al", "lo", "como", "mas", "pero", "sus", "ya", "o", "este", "si", "porque", "esta", "entre", "cuando", "muy", "sin", "sobre", "tambien", "me", "hasta", "hay", "donde", "quien", "desde", "todo", "nos", "durante", "todos", "uno", "les", "ni", "contra", "otros", "ese", "eso", "ante", "ellos", "esto", "mi", "antes", "algunos", "unos", "yo", "otro", "otras", "otra", "tanto", "esa", "estos", "mucho", "quienes", "nada", "muchos", "cual", "cada", "hacer", "fue", "son", "ser", "tener", "tengo", "tienes", "tiene", "tienen", "estoy", "estas", "esta", "estamos", "estan"];
  const EN = ["the", "and", "to", "of", "in", "for", "on", "with", "as", "at", "from", "by", "this", "that", "it", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "did", "does", "i", "you", "he", "she", "we", "they", "my", "your", "his", "her", "our", "their", "not", "but", "because", "so", "if", "then", "when", "where", "what", "who", "how", "can", "could", "will", "would", "should", "there", "here", "about", "into", "over", "after", "before", "also", "just", "like", "really", "very"];

  function isEnglishLikely(text){
    const s = (text || "").trim();
    if (!s) return false;
    if (s.length <= 4 && /^[a-zA-Z]+$/.test(s)) return true;
    if (/[ñáéíóúü¿¡]/i.test(s)) return false;

    const tokens = s.toLowerCase().replace(/[^a-zA-Z'\s]/g," ").split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return true;

    let spHits = 0, enHits = 0;
    for (const w of tokens){
      if (SP.includes(w)) spHits++;
      if (EN.includes(w)) enHits++;
    }

    if (spHits >= 2 && enHits === 0) return false;
    return true;
  }

  function canSend(){
    const profile = getProfile();
    if (!profile) return false;
    const text = ($("nvChatInput")?.value || "").trim();
    return text.length > 0;
  }

  function openChat(focus){
    $("nvChatLauncher").style.display = "none";
    $("nvChatWidget").classList.add("open");
    if (focus) setTimeout(()=> $("nvChatInput")?.focus(), 30);
    state.isOpen = true;
    maybeStart();
  }
  function closeChat(showLauncher){
    $("nvChatWidget").classList.remove("open");
    state.isOpen = false;
    if (showLauncher) $("nvChatLauncher").style.display = "block";
  }
  function minimizeChat(){ closeChat(true); }

  function escapeHtml(str){
    return (str||"").replace(/[&<>"']/g, (m)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
    }[m]));
  }

  function fmtTime(ts){
    try{
      const d = new Date(ts);
      return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    }catch(_){ return ""; }
  }

  function appendMsg(msg){
    const body = $("nvChatBody");
    if (!body) return;
    const sys = $("nvChatSystem");
    if (sys) sys.remove();

    const profile = getProfile();
    const isMe = profile && msg.email && profile.email && msg.email === profile.email;

    const wrap = document.createElement("div");
    wrap.className = "nvMsg" + (isMe ? " me" : "");
    const pic = msg.picture ? `<img class="pic" src="${escapeHtml(msg.picture)}" alt="">` : `<div class="pic"></div>`;
    wrap.innerHTML = `
      ${pic}
      <div class="bubble">
        <div class="meta">${escapeHtml(msg.name || "Usuario")} • ${fmtTime(msg.ts)}</div>
        <div class="text">${escapeHtml(msg.text)}</div>
      </div>
    `;
    body.appendChild(wrap);

    while (body.children.length > 260) body.removeChild(body.firstElementChild);
    body.scrollTop = body.scrollHeight;
  }

  function renderSystem(text){
    const body = $("nvChatBody");
    if (!body) return;
    body.innerHTML = `<div id="nvChatSystem">${escapeHtml(text)}</div>`;
  }

  async function apiFetch(path, opts){
    const url = DEFAULT_API_BASE + path;
    const r = await fetch(url, {
      method: (opts && opts.method) || "GET",
      headers: Object.assign({"Content-Type":"application/json"}, (opts && opts.headers) || {}),
      body: opts && opts.body ? JSON.stringify(opts.body) : undefined
    });
    const data = await r.json().catch(()=> ({}));
    if (!r.ok) throw new Error(data?.error || ("HTTP " + r.status));
    return data;
  }

  async function sendCurrent(){
    if (!canSend()) return;
    const text = ($("nvChatInput").value || "").trim();

    if (!isEnglishLikely(text)){
      showToast("⚠️ English only. Intenta escribir el mensaje en inglés.");
      return;
    }

    const profile = getProfile();
    if (!profile){
      showToast("Inicia sesión para usar el chat.");
      renderSystem("Inicia sesión para chatear con otros usuarios.");
      return;
    }

    const payload = {
      room: state.room || "global",
      text,
      user: profile,
      ts: Date.now()
    };

    $("nvChatSend").disabled = true;

    try{
      const res = await apiFetch("/internal-chat/send", {method:"POST", body: payload});
      if (res && res.message) appendMsg(res.message);
      $("nvChatInput").value = "";
      autoGrow($("nvChatInput"));
      $("nvChatSend").disabled = true;
      if (res && res.message && res.message.ts) state.lastTs = Math.max(state.lastTs, res.message.ts);
    }catch(err){
      console.error(err);
      showToast("No se pudo enviar. Revisa la configuración del chat.");
      if ($("nvChatBody") && $("nvChatBody").children.length === 0){
        renderSystem("Chat no disponible. Configura el backend (Worker + KV) o verifica el dominio permitido.");
      }
    }finally{
      $("nvChatSend").disabled = !canSend();
    }
  }

  async function poll(){
    if (!state.isOpen) return;
    const profile = getProfile();
    if (!profile){
      renderSystem("Inicia sesión para chatear con otros usuarios.");
      return;
    }

    try{
      const data = await apiFetch(`/internal-chat/messages?room=${encodeURIComponent(state.room || "global")}&after=${encodeURIComponent(state.lastTs)}`);
      const msgs = (data && data.messages) || [];
      if (msgs.length){
        for (const m of msgs) appendMsg(m);
        state.lastTs = Math.max(state.lastTs, ...msgs.map(m=>m.ts||0));
      }
      state.hasBackend = true;
    }catch(err){
      state.hasBackend = false;
      console.warn("chat poll error", err);
      if ($("nvChatBody") && $("nvChatBody").children.length === 0){
        renderSystem("Chat no disponible. Configura el backend (Worker + KV) para usarlo.");
      }
    }
  }

  function maybeStart(){
    const profile = getProfile();
    if (!profile){
      renderSystem("Inicia sesión para chatear con otros usuarios.");
      return;
    }
    if (state.started) return;
    state.started = true;
    state.isOpen && poll();
    state.timer = setInterval(()=> poll(), 3200);

    window.addEventListener("storage", (e)=>{
      if (e.key === "user_profile" || e.key === "google_id_token"){
        state.lastTs = 0;
        state.started = false;
        clearInterval(state.timer);
        state.timer = null;
        if ($("nvChatWidget")){
          // reset UI state
          const open = state.isOpen;
          ensureUI();
          if (open) openChat(false);
        }
      }
    });
  }

  const state = {
    isOpen: false,
    started: false,
    timer: null,
    lastTs: 0,
    hasBackend: false,
    room: "global",
    roomMeta: {room:"global", group:"Global", code:""},
    _teacherRoom: null
  };

  function init(){
    // join room from URL (?room=10-2@ABC123) — aplica antes de pintar UI
    try{
      const params = new URLSearchParams(window.location.search);
      const r = params.get("room") || params.get("chat_room") || params.get("chatroom");
      const parsed = parseRoomCode(r);
      if(parsed){
        safeSet(ROOM_LS_KEY, parsed.room);
        const rooms = readRooms();
        if(!rooms.some(x=>x && x.room === parsed.room)){
          rooms.push({room: parsed.room, group: parsed.group || "", code: parsed.code || ""});
          writeRooms(rooms.slice(-20));
        }
      }
    }catch(_){ }

    if (document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", ()=> ensureUI());
    }else{
      ensureUI();
    }
  }
  init();

})();
