(()=>{"use strict";

  const GAME_KEY = "yoguis_neuro_gamification_v1";
  const AWARD_KEY = "yoguis_neuro_preknowledge_awards_v1";
  const KP_BADGE_KEY = "yoguis_kp_badge_v1";

  function safeGet(key){ try{ return localStorage.getItem(key); }catch(_){ return null; } }
  function safeJSON(key, fallback){
    const raw = safeGet(key);
    if(!raw) return fallback;
    try{ return JSON.parse(raw); }catch(_){ return fallback; }
  }
  function $(id){ return document.getElementById(id); }

  const THEME_KEY = "nv_seg_theme_v1"; // "dark" | "light"

  function getTheme(){
    try{ return (localStorage.getItem(THEME_KEY) || "dark"); }catch(_){ return "dark"; }
  }
  function setTheme(v){
    try{ localStorage.setItem(THEME_KEY, v); }catch(_){}
  }
  function applyTheme(v){
    const b = document.body;
    if(!b) return;
    b.classList.toggle("theme-light", v === "light");
    const btn = $("btnThemeToggle");
    if(btn){
      // Si estás en light, el botón ofrece "Noche"
      if(v === "light"){
        btn.textContent = "🌙 Noche";
        btn.title = "Cambiar a modo noche";
      }else{
        btn.textContent = "☀️ Día";
        btn.title = "Cambiar a modo día";
      }
    }
  }

  function esc(s){
    return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function todayKey(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  function computeLevel(totalXP){
    const xpPerLevel = 250;
    const xp = Number(totalXP||0);
    const lvl = Math.floor(xp/xpPerLevel) + 1;
    const into = xp % xpPerLevel;
    const pct = Math.round((into/xpPerLevel)*100);
    return {lvl, into, xpPerLevel, pct};
  }

  function heartsString(h, max){
    const H = Math.max(0, Number(h||0));
    const M = Math.max(0, Number(max||5));
    const full = "❤️".repeat(Math.min(H, M));
    const empty = "🤍".repeat(Math.max(0, M - Math.min(H, M)));
    return (full + empty) || "🤍🤍🤍🤍🤍";
  }

  function formatDate(ts){
    if(!ts) return "—";
    try{
      const d = new Date(ts);
      if(!isFinite(d.getTime())) return "—";
      return d.toLocaleString();
    }catch(_){ return "—"; }
  }

  function buildReco(state){
    const recos = [];
    const xp = Number(state.xp||0);
    const att = Number(state.att||0);
    const corr = Number(state.corr||0);
    const acc = att ? Math.round((corr/att)*100) : 0;

    const dailyGoal = Number(state.dailyGoal||200);
    const dailyXP = Number(state.dailyXP||0);
    const dailyPct = dailyGoal ? Math.round((dailyXP/dailyGoal)*100) : 0;

    const streak = Number(state.streak||0);
    const hearts = Number(state.hearts??5);

    // Reglas simples (claras y útiles)
    if(att < 20){
      recos.push({t:"Comienza con práctica corta", d:"Haz 1 quiz rápido hoy para que el sistema empiece a registrar tu rendimiento (intentos, precisión, errores frecuentes)."});
    }
    if(acc && acc < 60){
      recos.push({t:"Refuerza precisión", d:`Tu precisión está en ${acc}%. Repite los verbos donde más fallas (ver tabla de errores) y vuelve al cuestionario.`});
    }else if(att >= 20 && acc >= 80){
      recos.push({t:"Excelente precisión", d:`Vas muy bien (${acc}%). Sube dificultad o aumenta la meta diaria para acelerar el avance de nivel.`});
    }

    if(dailyPct < 50){
      recos.push({t:"Meta diaria", d:`Hoy llevas ${dailyXP} de ${dailyGoal} XP. Si haces 10-15 minutos más, puedes acercarte a la meta y mantener la racha.`});
    }else if(dailyPct >= 100){
      recos.push({t:"Meta cumplida", d:`¡Meta diaria completada! Puedes hacer un repaso de errores para convertirlos en dominio (mastery).`});
    }

    if(streak === 0){
      recos.push({t:"Activa la racha", d:"Intenta sumar XP hoy para iniciar una racha. Las rachas mejoran memoria a largo plazo."});
    }else if(streak >= 7){
      recos.push({t:"Racha fuerte", d:`¡${streak} días seguidos! Mantén constancia: incluso 50-100 XP diarios sostienen el hábito.`});
    }

    if(hearts <= 1){
      recos.push({t:"Cuida tus corazones", d:"Si te quedas sin corazones, el avance se frena. Haz repasos cortos y evita responder al azar."});
    }

    if(xp < 250){
      recos.push({t:"Primer nivel", d:"Estás en etapa de arranque. Enfócate en práctica diaria breve y consistente para pasar de nivel rápido."});
    }

    if(!recos.length){
      recos.push({t:"Sigue así", d:"Tu progreso luce estable. Mantén la constancia y revisa tus errores frecuentes para mejorar aún más."});
    }
    return recos;
  }

  function render(){
    const token = safeGet("google_id_token");
    const prof = safeJSON("user_profile", null);

    const gate = $("segGate");
    const content = $("segContent");

    if(!token || !prof){
      gate.style.display = "flex";
      content.style.display = "none";
      return;
    }

    gate.style.display = "none";
    content.style.display = "block";

    // Perfil
    $("profileName").textContent = prof.name || "—";
    $("profileEmail").textContent = prof.email || "—";
    $("profileSub").textContent = "ID: " + (prof.sub || "—");
    const pic = $("profilePic");
    if(pic){
      pic.src = prof.picture || "assets/brain.png";
    }
    $("pillDomain").textContent = (prof.email||"").includes("@") ? (prof.email.split("@").pop()) : "Workspace";

    // Estado principal
    const st = safeJSON(GAME_KEY, {});
    const xp = Number(st.xp||0);
    const streak = Number(st.streak||0);
    const hearts = Number(st.hearts ?? 5);
    const freezeTokens = Number(st.freezeTokens||0);
    const dailyGoal = Number(st.dailyGoal||200);
    const dailyXP = Number(st.dailyXP||0);
    const att = Number(st.att||0);
    const corr = Number(st.corr||0);
    const acc = att ? Math.round((corr/att)*100) : 0;

    $("xpTotal").textContent = xp.toLocaleString();
    $("streak").textContent = String(streak);
    $("hearts").textContent = heartsString(hearts, 5);

    const lvl = computeLevel(xp);
    $("pillLevel").textContent = "Nivel " + lvl.lvl;
    $("lvlInto").textContent = `${lvl.into} / ${lvl.xpPerLevel} XP`;
    $("lvlBar").style.width = Math.max(0, Math.min(100, lvl.pct)) + "%";

    // Meta diaria
    $("dailyGoal").textContent = String(dailyGoal);
    $("dailyXP").textContent = String(dailyXP);
    $("freeze").textContent = String(freezeTokens);

    const dailyPct = dailyGoal ? Math.round((dailyXP/dailyGoal)*100) : 0;
    $("dailyPct").textContent = dailyPct + "%";
    $("dailyBar").style.width = Math.max(0, Math.min(100, dailyPct)) + "%";

    // Rendimiento
    $("att").textContent = String(att);
    $("corr").textContent = String(corr);
    $("acc").textContent = acc + "%";
    $("pillAcc").textContent = "Precisión " + acc + "%";

    // Mastery
    const mastery = st.mastery || {};
    const keys = Object.keys(mastery||{});
    const values = keys.map(k=>Number(mastery[k]||0)).filter(n=>Number.isFinite(n));
    const mastered = values.filter(v=>v>=5).length;
    const avg = values.length ? (values.reduce((a,b)=>a+b,0)/values.length) : 0;

    $("mastered").textContent = String(mastered);
    $("masteryCount").textContent = String(values.length);
    $("masteryAvg").textContent = avg.toFixed(1);
    $("pillMastery").textContent = values.length ? (mastered + " dominados") : "Sin datos";

    const grid = $("masteryGrid");
    if(grid){
      const sample = keys.slice(0, 16).map(k=>({c1:k, v:Number(mastery[k]||0)}))
        .sort((a,b)=>b.v-a.v);
      grid.innerHTML = sample.length ? sample.map(x=>{
        const stars = "⭐".repeat(Math.max(0, Math.min(5, x.v)));
        return `<div class="segMini"><b>${esc(x.c1)}</b><small>${stars || "—"}</small></div>`;
      }).join("") : '<div class="segHint" style="grid-column:1/-1;">Aún no hay dominio registrado. Practica en “Verbos” para que aparezcan datos aquí.</div>';
    }

    // Mistakes
    const mistakes = Array.isArray(st.mistakes) ? st.mistakes : [];
    const agg = new Map();
    for(const m of mistakes){
      const c1 = String(m?.c1||"").trim();
      if(!c1) continue;
      const misses = Number(m?.misses||1);
      agg.set(c1, (agg.get(c1)||0) + (Number.isFinite(misses)?misses:1));
    }
    const top = Array.from(agg.entries()).sort((a,b)=>b[1]-a[1]).slice(0, 10);

    const tbody = $("mistakesBody");
    if(tbody){
      if(!top.length){
        tbody.innerHTML = '<tr><td colspan="3" style="opacity:.85;">Aún no hay errores registrados.</td></tr>';
      }else{
        tbody.innerHTML = top.map(([c1,count])=>{
          const reco = "Practica 3 veces + quiz";
          return `<tr><td><b>${esc(c1)}</b></td><td>${count}</td><td>${reco}</td></tr>`;
        }).join("");
      }
    }

    // KP
    const badge = safeJSON(KP_BADGE_KEY, null);
    $("kpBadge").textContent = (badge && badge.done) ? "Sí" : "No";
    const awards = safeJSON(AWARD_KEY, {done:{}});
    const done = awards && awards.done ? awards.done : {};
    const doneKeys = Object.keys(done||{});
    $("kpDone").textContent = String(doneKeys.length);
    let lastTs = 0;
    for(const k of doneKeys){
      const ts = Number(done?.[k]?.ts||0);
      if(ts>lastTs) lastTs = ts;
    }
    $("kpLast").textContent = lastTs ? formatDate(lastTs) : "—";
    const classCode = safeGet("kp_class_code_v1") || safeGet("kp_teacher_class_v1") || "—";
    $("kpClass").textContent = classCode;

    // Teacher Yoguis history
    const hist = safeJSON("ty_history", []);
    const arr = Array.isArray(hist) ? hist : [];
    $("tyCount").textContent = String(arr.length);
    const doneCount = arr.filter(x => (x.status||"open")==="done").length;
    const openCount = arr.filter(x => (x.status||"open")!=="done").length;
    $("tyDone").textContent = String(doneCount);
    $("tyOpen").textContent = String(openCount);

    const chips = $("tyChips");
    if(chips){
      const last = arr.slice(0, 8);
      chips.innerHTML = last.length ? last.map(x=>{
        const label = (x.topic||"Tema").slice(0, 42);
        const lvl = x.level || "mid";
        const badge = (lvl==="easy") ? "Fácil" : (lvl==="hard" ? "Difícil" : "Medio");
        return `<span class="segChip">${esc(label)} • ${badge}</span>`;
      }).join("") : '<span class="segSmall" style="opacity:.8;">Aún no hay historial en Teacher Yoguis.</span>';
    }

    // Hints (lectura humana)
    const nextXp = (lvl.xpPerLevel - lvl.into);
    $("hintProgress").innerHTML = `Te faltan <b>${nextXp}</b> XP para el siguiente nivel. Mantén consistencia diaria para acelerar el avance.`;
    $("hintDaily").innerHTML = `Fecha: <b>${todayKey()}</b>. Completar la meta ayuda a sostener la racha.`;
    $("hintPerf").innerHTML = att ? `Precisión calculada con <b>${att}</b> intentos. Entre más intentos, más confiable es la métrica.` : `Aún no hay intentos suficientes. Realiza un quiz para empezar a medir tu rendimiento.`;

    // Recos
    const recos = buildReco(st);
    const recoHost = $("recoList");
    if(recoHost){
      recoHost.innerHTML = recos.map((r,i)=>`<div class="segRecoItem"><b>${i+1}. ${esc(r.t)}</b>${esc(r.d)}</div>`).join("");
    }

    $("lastRead").textContent = new Date().toLocaleString();

    // Print

    const btnPrint = $("btnPrint");
    if(btnPrint){
      btnPrint.addEventListener("click", () => window.print());
    }
  }

  window.addEventListener("load", render);
})();



/* ========= Enviar seguimiento por correo (KPIs completos, SIN PDF) =========
   ✅ Sin backend: abre Gmail con el informe listo (texto).
   ✅ Incluye TODAS las métricas visibles del panel (KPIs, listas, tablas).
   ✅ Se sabe quién lo envía (nombre + email Workspace).
*/
(function(){
  const btnSend = document.getElementById("btnSendReport");
  if(!btnSend) return;

  const sendCard = document.getElementById("segSendCard");
  const aGmail = document.getElementById("segOpenGmail");
  const aMailto = document.getElementById("segOpenMailto");

  function safeGet(key){
    try{ return localStorage.getItem(key); }catch(_){ return null; }
  }
  function safeJsonParse(raw, fallback){
    if(!raw) return fallback;
    try{ return JSON.parse(raw); }catch(_){ return fallback; }
  }
  function isLoggedIn(){
    const prof = safeJsonParse(safeGet("user_profile"), null);
    const token = safeGet("google_id_token");
    return !!(prof && prof.email && token);
  }
  function getProfile(){
    const prof = safeJsonParse(safeGet("user_profile"), null);
    if(!prof) return {name:"Estudiante", email:"", picture:""};
    return { name: prof.name || "Estudiante", email: (prof.email||""), picture: prof.picture || "" };
  }
  function txt(el){
    if(!el) return "";
    return (el.textContent || "").replace(/\s+/g," ").trim();
  }
  function toast(title, msg){
    const div = document.createElement("div");
    div.style.position="fixed";
    div.style.left="50%";
    div.style.bottom="18px";
    div.style.transform="translateX(-50%)";
    div.style.zIndex="99999";
    div.style.maxWidth="min(760px, calc(100vw - 26px))";
    div.style.padding="12px 14px";
    div.style.borderRadius="14px";
    div.style.border="1px solid rgba(255,255,255,.14)";
    div.style.background="rgba(10,16,32,.92)";
    div.style.backdropFilter="blur(10px)";
    div.style.boxShadow="0 18px 50px rgba(0,0,0,.45)";
    div.style.color="rgba(255,255,255,.92)";
    div.innerHTML = `<div style="font-weight:950;margin-bottom:3px;">${title}</div><div style="opacity:.85;font-size:13px;line-height:1.25;">${msg}</div>`;
    document.body.appendChild(div);
    setTimeout(()=>{ try{ div.remove(); }catch(_){ } }, 4200);
  }

  function collectMetrics(){
    const lines = [];

    // Píldoras (nivel, precisión, etc.)
    const pills = Array.from(document.querySelectorAll(".segPill"))
      .map(p=>({id: p.id || "", value: txt(p)}))
      .filter(x=>x.value && x.value !== "—");
    if(pills.length){
      lines.push("PÍLDORAS / ESTADO:");
      pills.forEach(p=>{
        const label = p.id ? p.id.replace(/^pill/i,"") : "Estado";
        lines.push(`- ${label}: ${p.value}`);
      });
      lines.push("");
    }

    // Métricas (tarjetas de progreso)
    const metrics = Array.from(document.querySelectorAll(".segMetric")).map(m=>{
      const label = txt(m.querySelector(".segMetricLabel"));
      const value = txt(m.querySelector(".segMetricValue")) || txt(m);
      return {label, value};
    }).filter(x=>x.label && x.value);
    if(metrics.length){
      lines.push("KPIs (MÉTRICAS):");
      metrics.forEach(x=> lines.push(`- ${x.label}: ${x.value}`));
      lines.push("");
    }

    // Listas tipo KP / Teacher Yoguis
    const listRows = Array.from(document.querySelectorAll(".segListRow")).map(r=>{
      const label = txt(r.querySelector("span"));
      const value = txt(r.querySelector("b")) || txt(r);
      return {label, value};
    }).filter(x=>x.label && x.value);
    if(listRows.length){
      lines.push("KPIs (LISTAS):");
      listRows.forEach(x=> lines.push(`- ${x.label}: ${x.value}`));
      lines.push("");
    }

    // Dominio (mini grid)
    const minis = Array.from(document.querySelectorAll("#masteryGrid .segMini")).map(x=>{
      const c1 = txt(x.querySelector("b"));
      const stars = txt(x.querySelector("small"));
      return (c1 ? `${c1}: ${stars || "—"}` : "");
    }).filter(Boolean);
    if(minis.length){
      lines.push("DOMINIO (muestra):");
      minis.forEach((s,i)=> lines.push(`${i+1}. ${s}`));
      lines.push("");
    }

    // Errores frecuentes (tabla)
    const rows = Array.from(document.querySelectorAll("#mistakesBody tr"));
    const table = rows.map(tr=>{
      const tds = Array.from(tr.querySelectorAll("td")).map(td=>txt(td));
      if(!tds.length) return null;
      // si es fila "sin datos"
      if(tds.length === 1) return {empty: true, text: tds[0]};
      return {c1: tds[0], count: tds[1] || "", reco: tds[2] || ""};
    }).filter(Boolean);
    if(table.length){
      lines.push("ERRORES FRECUENTES (Top):");
      table.forEach((r,i)=>{
        if(r.empty){
          lines.push(`- ${r.text}`);
        }else{
          lines.push(`${i+1}. ${r.c1} | ${r.count} | ${r.reco}`);
        }
      });
      lines.push("");
    }

    // Teacher Yoguis chips
    const chips = Array.from(document.querySelectorAll("#tyChips .segChip")).map(c=>txt(c)).filter(Boolean);
    if(chips.length){
      lines.push("TEACHER YOGUIS (últimos temas):");
      chips.forEach((c,i)=> lines.push(`${i+1}. ${c}`));
      lines.push("");
    }

    // Recomendaciones
    const recos = Array.from(document.querySelectorAll("#recoList .segRecoItem")).map(r=>txt(r)).filter(Boolean);
    if(recos.length){
      lines.push("RECOMENDACIONES DEL SISTEMA:");
      recos.forEach((r,i)=> lines.push(`${i+1}. ${r}`));
      lines.push("");
    }

    // Hints (texto explicativo)
    const hintProgress = txt(document.getElementById("hintProgress"));
    const hintDaily = txt(document.getElementById("hintDaily"));
    const hintPerf = txt(document.getElementById("hintPerf"));
    if(hintProgress || hintDaily || hintPerf){
      lines.push("NOTAS / INTERPRETACIÓN:");
      if(hintProgress) lines.push(`- Progreso: ${hintProgress}`);
      if(hintDaily) lines.push(`- Meta diaria: ${hintDaily}`);
      if(hintPerf) lines.push(`- Rendimiento: ${hintPerf}`);
      lines.push("");
    }

    // Última lectura
    const lastRead = txt(document.getElementById("lastRead"));
    if(lastRead){
      lines.push(`Última lectura del panel: ${lastRead}`);
      lines.push("");
    }

    if(!lines.length){
      lines.push("(No se detectaron KPIs visibles en la página)");
    }

    return lines.join("\n");
  }

  function buildEmailLinks(reportText){
    const to = "neuroaprendizajedelosverbosirregulares@iemanueljbetancur.edu.co";
    const prof = getProfile();
    const subject = `SEGUIMIENTO | ${prof.name} | ${prof.email || "sin-email"}`;

    const header =
`SEGUIMIENTO DEL ESTUDIANTE (NeuroVerbs)\n\n` +
`Nombre: ${prof.name}\n` +
`Email: ${prof.email || "—"}\n` +
`Fecha/Hora: ${new Date().toLocaleString()}\n\n`;

    const body = header + reportText + `\n\nEnviado desde: seguimiento-estudiantes.html`;

    const gmailUrl =
      "https://mail.google.com/mail/?view=cm&fs=1" +
      "&to=" + encodeURIComponent(to) +
      "&cc=" + encodeURIComponent((prof.email || "")) +
      "&su=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);

    const mailto =
      "mailto:" + encodeURIComponent(to) +
      "?subject=" + encodeURIComponent(subject) +
      "&cc=" + encodeURIComponent((prof.email || "")) +
      "&body=" + encodeURIComponent(body);

    if(aGmail) aGmail.href = gmailUrl;
    if(aMailto) aMailto.href = mailto;
    if(sendCard) sendCard.style.display = "block";

    return { gmailUrl, mailto };
  }

  function send(){
    // Construir el reporte con TODO lo visible (KPIs completos)
    const reportText = collectMetrics();
    const links = buildEmailLinks(reportText);

    // Mantener esta pestaña en la APP: NO redireccionar aquí.
    try{ if(sendCard) sendCard.style.display = "block"; }catch(_){}

    // Si no está logueado, igual abrimos el correo (pero puede no haber CC)
    if(!isLoggedIn()){
      toast("Sesión no detectada", "No se detectó sesión activa. Se abrirá el correo igualmente (si hay email se incluirá en CC).");
    }

    // Abrir SOLO UNA pestaña de correo (máxima compatibilidad)
    let opened = false;
    try{
      const w = window.open("about:blank", "_blank"); // sin 'features' para evitar bloqueos/bugs
      if(w){
        try{ w.opener = null; }catch(_){}
        try{
          w.location.href = links.gmailUrl;
        }catch(_){
          try{ w.location.replace(links.gmailUrl); }catch(__){}
        }
        opened = true;
      }
    }catch(_){ opened = false; }

    toast(
      "Correo listo",
      opened
        ? "Se abrió Gmail en una nueva pestaña. Va para el profesor y con copia (CC) a tu correo (si está disponible)."
        : "El navegador bloqueó la nueva pestaña. Usa 'Abrir Gmail' (pestaña nueva) en el panel que aparece abajo."
    );
  }

  // Evitar múltiples listeners (que abren 2 pestañas)
  if(!btnSend.dataset.nvBound){
    btnSend.dataset.nvBound = "1";
    btnSend.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); send(); });
  }
})();

/* ========= Seguimiento: Modo Día / Noche (global, sin dependencias) =========
   Funciona aunque el tablero no llame render().
*/
(function(){
  const KEY = "nv_seg_theme_v1"; // "dark" | "light"
  const btn = document.getElementById("btnThemeToggle");
  if(!btn) return;

  function getTheme(){
    try{ return (localStorage.getItem(KEY) || "dark"); }catch(_){ return "dark"; }
  }
  function setTheme(v){
    try{ localStorage.setItem(KEY, v); }catch(_){}
  }
  function apply(v){
    document.body.classList.toggle("theme-light", v === "light");
    if(v === "light"){
      btn.textContent = "🌙 Noche";
      btn.title = "Cambiar a modo noche";
    }else{
      btn.textContent = "☀️ Día";
      btn.title = "Cambiar a modo día";
    }
  }

  // init
  apply(getTheme());

  // bind once
  if(!btn.__nvBoundTheme){
    btn.__nvBoundTheme = true;
    btn.addEventListener("click", ()=>{
      const next = (getTheme() === "light") ? "dark" : "light";
      setTheme(next);
      apply(next);
    });
  }
})();

