/* NEUROVERBS — Chat interno (English only) + Salas por curso/grupo + Roles
   - Visible en todas las páginas
   - Requiere usuario logueado (localStorage.user_profile)
   - Backend: Cloudflare Worker + KV (CHAT_KV)
   - Docente owner por email: juancarlosbv@iemanueljbetancur.edu.co
*/
(function(){
  // 🔕 Chat desactivado temporalmente (maquetación en progreso).
  // Para reactivarlo más adelante, cambia CHAT_DISABLED a false.
  const CHAT_DISABLED = true;
  if(CHAT_DISABLED) return;

  const ROOM_LS_KEY  = "nv_chat_room_v2";
  const ROOMS_LS_KEY = "nv_chat_rooms_v2";

  const TEACHER_EMAIL = "juancarlosbv@iemanueljbetancur.edu.co".toLowerCase();

  const DEFAULT_API_BASE = (function(){
    const ls = (localStorage.getItem("NEUROVERBS_API_BASE") || "").trim();
    return (ls ? ls : "https://neuroverbs-api.yoguisindevoz.workers.dev").replace(/\/$/, "");
  })();

  function $(id){ return document.getElementById(id); }

  function safeParse(jsonStr){
    try{ return JSON.parse(jsonStr); }catch(_){ return null; }
  }

  function normEmail(e){ return String(e||"").trim().toLowerCase(); }

  function getProfile(){
    const p = safeParse(localStorage.getItem("user_profile") || "");
    if (!p || typeof p !== "object") return null;
    return {
      name: p.name || p.nombre || "Usuario",
      email: p.email || p.correo || "",
      picture: p.picture || p.foto || ""
    };
  }

  function isTeacher(profile){
    const e = normEmail(profile?.email);
    return !!e && e === TEACHER_EMAIL;
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
    writeRooms(rooms.slice(0,30));
  }

  function getCurrentRoom(){
    const raw = safeGet(ROOM_LS_KEY);
    const parsed = parseRoomCode(raw);
    if(parsed) return parsed;
    return { room:"global", group:"Global", code:"" };
  }

  function setCurrentRoom(roomObj, {silent=false}={}){
    if(!roomObj || !roomObj.room) return;

    // persist
    safeSet(ROOM_LS_KEY, roomObj.room);

    // ensure list includes
    const rooms = readRooms();
    const idx = rooms.findIndex(r=>r && r.room === roomObj.room);
    if(idx === -1){
      rooms.push({room: roomObj.room, group: roomObj.group || "", code: roomObj.code || ""});
      writeRooms(rooms.slice(-30));
    }

    state.room = roomObj.room;
    state.roomMeta = roomObj;

    if(!silent){
      refreshRoomUI();
      resetConversation();
      syncRoomAccess(); // async, but ok
      if(state.isOpen) poll();
    }
  }

  function removeRoom(room){
    const rooms = readRooms().filter(r=>r && r.room !== room && r.room !== "global");
    writeRooms([{room:"global", group:"Global", code:""}, ...rooms].slice(0,30));
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

  function canModerate(){
    return state.role === "owner" || state.role === "moderator";
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
            <span class="nvRoomPill" id="nvRolePill" style="display:none"><b>Role</b>: <span id="nvRoleName">member</span></span>
            <button class="nvRoomBtn" id="nvChatRoomsBtn" type="button">Salas</button>
            <button class="nvRoomBtn" id="nvChatAdminBtn" type="button" style="display:none">Admin</button>
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
            <div class="nvRoomHint">Tip: pega el código que te dio el docente (ej: <b>10-2@ABC123</b>).</div>
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

          <div class="nvRoomCard" id="nvAdminCard" style="display:none">
            <h4>Admin de sala</h4>
            <div class="nvRoomHint" style="margin-bottom:8px">Solo <b>docente/moderador</b> puede bloquear, silenciar o borrar.</div>

            <div class="nvRoomRow" style="justify-content:space-between">
              <label style="display:flex; gap:8px; align-items:center; font-size:12px; color:rgba(255,255,255,.85)">
                <input type="checkbox" id="nvRoomLock" />
                Sala bloqueada (requiere código)
              </label>
              <button class="nvRoomBtn" id="nvSaveLockBtn" type="button">Guardar</button>
            </div>

            <div class="nvRoomRow">
              <input id="nvModEmail" placeholder="moderator@email.com" />
              <button class="nvRoomBtn" id="nvAddModBtn" type="button">+Mod</button>
              <button class="nvRoomBtn" id="nvRemModBtn" type="button">-Mod</button>
            </div>

            <div class="nvRoomRow">
              <input id="nvTargetEmail" placeholder="estudiante@email.com" />
              <select id="nvMuteMinutes" style="flex:1; min-width:120px">
                <option value="10">Mute 10m</option>
                <option value="60" selected>Mute 1h</option>
                <option value="240">Mute 4h</option>
                <option value="1440">Mute 24h</option>
              </select>
              <button class="nvRoomBtn" id="nvMuteBtn" type="button">Mute</button>
              <button class="nvRoomBtn" id="nvUnmuteBtn" type="button">Unmute</button>
            </div>

            <div class="nvRoomRow">
              <button class="nvRoomBtn" id="nvBanBtn" type="button" style="flex:1">Ban</button>
              <button class="nvRoomBtn" id="nvUnbanBtn" type="button" style="flex:1">Unban</button>
            </div>

            <div class="nvRoomHint" id="nvAdminOut"></div>
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

    $("nvChatRoomsBtn").addEventListener("click", ()=> toggleRoomsPanel());
    $("nvChatAdminBtn").addEventListener("click", ()=> toggleRoomsPanel(true));

    $("nvJoinBtn").addEventListener("click", joinFromInput);
    $("nvCreateBtn").addEventListener("click", teacherCreateRoom);
    $("nvCopyRoomBtn").addEventListener("click", copyTeacherRoom);

    $("nvSaveLockBtn").addEventListener("click", saveLock);
    $("nvAddModBtn").addEventListener("click", ()=> modAction("add_mod"));
    $("nvRemModBtn").addEventListener("click", ()=> modAction("remove_mod"));
    $("nvMuteBtn").addEventListener("click", ()=> modAction("mute"));
    $("nvUnmuteBtn").addEventListener("click", ()=> modAction("unmute"));
    $("nvBanBtn").addEventListener("click", ()=> modAction("ban"));
    $("nvUnbanBtn").addEventListener("click", ()=> modAction("unban"));

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

    // default closed
    launcher.style.display = "block";
    widget.classList.remove("open");

    // init rooms
    ensureRoomListHasGlobal();
    const initial = getCurrentRoom();
    state.room = initial.room;
    state.roomMeta = initial;
    refreshRoomUI();
    syncRoomAccess();
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

    // Role pill
    const rolePill = $("nvRolePill");
    const roleName = $("nvRoleName");
    if(rolePill && roleName){
      roleName.textContent = state.role || "member";
      rolePill.style.display = state.role ? "inline-flex" : "none";
    }

    // Admin button
    const adminBtn = $("nvChatAdminBtn");
    if(adminBtn){
      adminBtn.style.display = canModerate() ? "inline-flex" : "none";
    }

    // Admin card
    const adminCard = $("nvAdminCard");
    if(adminCard){
      adminCard.style.display = canModerate() ? "block" : "none";
      const lock = $("nvRoomLock");
      if(lock) lock.checked = !!state.roomAccess?.locked;
    }

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

  function toggleRoomsPanel(forceOpenAdmin=false){
    const p = $("nvChatRoomsPanel");
    if(!p) return;
    const open = p.classList.toggle("open");
    p.setAttribute("aria-hidden", open?"false":"true");
    if(open){
      refreshRoomUI();
      if(forceOpenAdmin && $("nvAdminCard")){
        $("nvAdminCard").scrollIntoView({behavior:"smooth", block:"start"});
      }
    }
  }

  async function joinFromInput(){
    const inp = $("nvJoinRoom");
    const val = String(inp?.value||"").trim();
    if(!val){ showToast("Pega un código de sala."); return; }

    const parsed = parseRoomCode(val);
    if(!parsed){ showToast("Código inválido. Ej: 10-2@ABC123"); return; }

    const ok = await joinRoomBackend(parsed);
    if(!ok) return;

    setCurrentRoom(parsed);
    if(inp) inp.value = "";
    const p = $("nvChatRoomsPanel");
    if(p) { p.classList.remove("open"); p.setAttribute("aria-hidden","true"); }
    showToast(`Sala: ${parsed.group}`);
  }

  async function teacherCreateRoom(){
    const profile = getProfile();
    const out = $("nvTeacherOut");
    const copyBtn = $("nvCopyRoomBtn");
    if(!profile){
      showToast("Inicia sesión para crear una sala.");
      if(out) out.textContent = "Inicia sesión primero.";
      return;
    }
    if(!isTeacher(profile)){
      showToast("Solo el docente puede crear salas.");
      if(out) out.textContent = "Solo el docente (modo clase) puede crear salas.";
      return;
    }

    const gEl = $("nvTeacherGroup");
    const group = sanitizeGroup(gEl?.value || "");
    if(!group){
      if(out) out.textContent = "Escribe el grupo (ej: 10-2).";
      showToast("Falta el grupo.");
      return;
    }

    const code = genCode(6);
    const room = makeRoomCode(group, code);
    const link = buildRoomLink(room);

    // Create on backend (locked by default)
    try{
      const res = await apiFetch("/internal-chat/room/create", {method:"POST", body:{
        group, code, actor: profile
      }});
      state.roomAccess = res.meta || {locked:true};
      state.role = "owner";
    }catch(err){
      console.error(err);
      showToast("No se pudo crear la sala (backend).");
      if(out) out.textContent = "Error creando sala. Revisa Worker + KV.";
      return;
    }

    state._teacherRoom = {room, group, code, link};
    if(out) out.innerHTML = `Código de sala: <b>${escapeHtml(room)}</b><br>Link: <span style="opacity:.9">${escapeHtml(link)}</span>`;
    if(copyBtn) copyBtn.style.display = "inline-flex";

    // join & set room
    await joinRoomBackend({room, group, code});
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

  // Language filter (simple heuristic)
  // Regla: solo inglés. Bloquea señales fuertes de español.
  function isEnglishLikely(text){
    const s = (text || "").trim();
    if(!s) return false;

    // Señales fuertes de español
    if (/[ñáéíóúü¿¡]/i.test(s)) return false;

    const t = s.toLowerCase();

    // Si hay muchas palabras comunes en español y ninguna común en inglés, lo marcamos como NO.
    const hasSpanish = /\b(que|de|la|el|en|y|por|para|con|porque|cuando|pero|sin|sobre|tambien|también|mas|más|muy|donde|quien|quién|esto|esta|estos|estas|una|un|los|las|del|al|me|mi|tu|su)\b/.test(t);
    const hasEnglish = /\b(the|and|to|of|in|for|with|is|are|was|were|be|been|have|has|had|do|did|does|i|you|we|they|he|she|it|because|when|where|what|who|how|can|could|will|would|should|this|that)\b/.test(t);

    if(hasSpanish && !hasEnglish) return false;
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

  function removeMessageById(mid){
    const el = document.querySelector(`.nvMsg[data-mid="${CSS.escape(mid)}"]`);
    if(el) el.remove();
  }

  function appendMsg(msg){
    const body = $("nvChatBody");
    if (!body) return;

    // Event: delete
    if(msg && msg.type === "delete" && msg.target_id){
      removeMessageById(msg.target_id);
      // small system line
      const sys = document.createElement("div");
      sys.className = "nvSystemLine";
      sys.textContent = "🧹 A message was removed by a moderator.";
      body.appendChild(sys);
      body.scrollTop = body.scrollHeight;
      return;
    }

    const sys0 = $("nvChatSystem");
    if (sys0) sys0.remove();

    const profile = getProfile();
    const isMe = profile && msg.email && profile.email && normEmail(msg.email) === normEmail(profile.email);

    const wrap = document.createElement("div");
    wrap.className = "nvMsg" + (isMe ? " me" : "");
    if(msg.id) wrap.dataset.mid = msg.id;

    const pic = msg.picture ? `<img class="pic" src="${escapeHtml(msg.picture)}" alt="">` : `<div class="pic"></div>`;
    const delBtn = (canModerate() && msg.id && msg.type === "chat") ? `<button class="nvDelBtn" data-del="${escapeHtml(msg.id)}" title="Delete">🗑</button>` : "";
    const text = msg.deleted ? "[deleted]" : (msg.text || "");

    wrap.innerHTML = `
      ${pic}
      <div class="bubble">
        <div class="meta">
          <span>${escapeHtml(msg.name || "Usuario")} • ${fmtTime(msg.ts)}</span>
          ${delBtn}
        </div>
        <div class="text">${escapeHtml(text)}</div>
      </div>
    `;
    body.appendChild(wrap);

    // bind delete
    const btn = wrap.querySelector(".nvDelBtn");
    if(btn){
      btn.addEventListener("click", async ()=>{
        const mid = btn.getAttribute("data-del");
        if(!mid) return;
        await moderateDelete(mid);
      });
    }

    while (body.children.length > 280) body.removeChild(body.firstElementChild);
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

  async function joinRoomBackend(roomObj){
    const profile = getProfile();
    if(!profile){
      showToast("Inicia sesión para entrar al chat.");
      return false;
    }

    // global doesn't need join
    if(roomObj.room === "global"){
      state.role = "member";
      state.roomAccess = {locked:false};
      refreshRoomUI();
      return true;
    }

    try{
      const res = await apiFetch("/internal-chat/room/join", {method:"POST", body:{
        room: roomObj.room,
        code: roomObj.code || "",
        actor: profile
      }});
      state.roomAccess = res.meta || {locked:true};
      state.role = res.role || "member";
      refreshRoomUI();
      return true;
    }catch(err){
      console.error(err);
      showToast(String(err.message || "No se pudo entrar a la sala."));
      return false;
    }
  }

  async function syncRoomAccess(){
    const profile = getProfile();
    if(!profile){
      state.role = "";
      state.roomAccess = null;
      refreshRoomUI();
      return;
    }

    // try fetch meta/role (GET) — not blocking
    const room = state.room || "global";
    const code = state.roomMeta?.code || "";
    try{
      const res = await apiFetch(`/internal-chat/room/meta?room=${encodeURIComponent(room)}&code=${encodeURIComponent(code)}&email=${encodeURIComponent(profile.email||"")}`);
      state.roomAccess = res.meta || state.roomAccess;
      state.role = res.role || state.role || "member";
      refreshRoomUI();
    }catch(_){
      // fallback: attempt join for non-global
      if(room !== "global"){
        joinRoomBackend({room, group: state.roomMeta?.group||"", code});
      }else{
        state.role = "member";
        state.roomAccess = {locked:false};
      }
      refreshRoomUI();
    }
  }

  async function moderateDelete(messageId){
    if(!canModerate()){ showToast("No autorizado."); return; }
    const profile = getProfile();
    if(!profile) return;

    try{
      await apiFetch("/internal-chat/moderate", {method:"POST", body:{
        room: state.room || "global",
        code: state.roomMeta?.code || "",
        action: "delete",
        message_id: messageId,
        actor: profile
      }});
      // remove locally
      removeMessageById(messageId);
      showToast("Deleted ✅");
    }catch(err){
      console.error(err);
      showToast(String(err.message || "No se pudo borrar."));
    }
  }

  async function saveLock(){
    if(!canModerate()){ showToast("No autorizado."); return; }
    const profile = getProfile();
    if(!profile) return;
    const lockEl = $("nvRoomLock");
    const locked = !!lockEl?.checked;

    try{
      const res = await apiFetch("/internal-chat/moderate", {method:"POST", body:{
        room: state.room || "global",
        code: state.roomMeta?.code || "",
        action: "set_lock",
        locked,
        actor: profile
      }});
      state.roomAccess = res.meta || state.roomAccess;
      showToast("Guardado ✅");
      refreshRoomUI();
    }catch(err){
      console.error(err);
      showToast(String(err.message || "Error guardando."));
    }
  }

  async function modAction(action){
    if(!canModerate()){ showToast("No autorizado."); return; }
    const profile = getProfile();
    if(!profile) return;

    const target = $("nvTargetEmail")?.value?.trim() || $("nvModEmail")?.value?.trim() || "";
    const out = $("nvAdminOut");
    const minutes = Number($("nvMuteMinutes")?.value || 60) || 60;

    const body = {
      room: state.room || "global",
      code: state.roomMeta?.code || "",
      action,
      actor: profile
    };

    if(action === "add_mod" || action === "remove_mod"){
      const e = $("nvModEmail")?.value?.trim() || "";
      body.target_email = e;
    }else if(action === "mute"){
      body.target_email = target;
      body.minutes = minutes;
    }else if(action === "unmute" || action === "ban" || action === "unban"){
      body.target_email = target;
    }

    try{
      const res = await apiFetch("/internal-chat/moderate", {method:"POST", body});
      if(res && res.meta) state.roomAccess = res.meta;
      if(out) out.textContent = "✅ Actualizado.";
      showToast("Listo ✅");
      refreshRoomUI();
    }catch(err){
      console.error(err);
      if(out) out.textContent = "❌ " + String(err.message || "Error");
      showToast(String(err.message || "Error"));
    }
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

    // ensure joined/role if non-global
    if(state.room !== "global" && !state.roomAccess){
      const ok = await joinRoomBackend(state.roomMeta);
      if(!ok) return;
    }

    const payload = {
      room: state.room || "global",
      code: state.roomMeta?.code || "",
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
      showToast(String(err.message || "No se pudo enviar."));
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

    const room = state.room || "global";
    const code = state.roomMeta?.code || "";

    try{
      const data = await apiFetch(`/internal-chat/messages?room=${encodeURIComponent(room)}&after=${encodeURIComponent(state.lastTs)}&code=${encodeURIComponent(code)}`);
      const msgs = (data && data.messages) || [];
      if (msgs.length){
        for (const m of msgs) appendMsg(m);
        state.lastTs = Math.max(state.lastTs, ...msgs.map(m=>m.ts||0));
      }
      state.hasBackend = true;
      // occasional meta refresh
      state._metaTick = (state._metaTick || 0) + 1;
      if(state._metaTick % 6 === 0) syncRoomAccess();
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
          const open = state.isOpen;
          // reset role/meta
          state.role = "";
          state.roomAccess = null;
          ensureUI();
          if (open) openChat(false);
          syncRoomAccess();
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
    _teacherRoom: null,
    role: "",
    roomAccess: null,
    _metaTick: 0
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
          writeRooms(rooms.slice(-30));
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
