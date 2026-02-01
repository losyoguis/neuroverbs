/* NEUROVERBS — Chat interno (English only)
   - Visible en todas las páginas
   - Requiere usuario logueado (localStorage.user_profile)
   - Backend recomendado: Cloudflare Worker + KV (CHAT_KV)
*/
(function(){
  const CHAT_ROOM = "global";
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
        </div>
        <div class="nvChatBtns">
          <button id="nvChatMinBtn" title="Minimizar">—</button>
          <button id="nvChatCloseBtn" title="Cerrar">×</button>
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
      room: CHAT_ROOM,
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
      const data = await apiFetch(`/internal-chat/messages?room=${encodeURIComponent(CHAT_ROOM)}&after=${encodeURIComponent(state.lastTs)}`);
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
    hasBackend: false
  };

  function init(){
    if (document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", ()=> ensureUI());
    }else{
      ensureUI();
    }
  }
  init();

})();
