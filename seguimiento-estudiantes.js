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


/* ========= Enviar seguimiento por correo (PDF adjunto cuando sea posible) ========= */
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

  function toast(title, msg){
    // Reutiliza estilos existentes creando un aviso simple
    const div = document.createElement("div");
    div.style.position="fixed";
    div.style.left="50%";
    div.style.bottom="18px";
    div.style.transform="translateX(-50%)";
    div.style.zIndex="99999";
    div.style.maxWidth="min(720px, calc(100vw - 26px))";
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

  function buildEmailLinks(summaryText){
    const to = "neuroaprendizajedelosverbosirregulares@iemanueljbetancur.edu.co";
    const prof = getProfile();
    const subject = `SEGUIMIENTO | ${prof.name} | ${prof.email || "sin-email"}`;
    const body =
`SEGUIMIENTO DEL ESTUDIANTE (NeuroVerbs)\\n\\n` +
`Nombre: ${prof.name}\\n` +
`Email: ${prof.email || "—"}\\n` +
`Fecha/Hora: ${new Date().toLocaleString()}\\n\\n` +
`RESUMEN:\\n${summaryText}\\n\\n` +
`Adjunto: PDF del seguimiento (si tu dispositivo lo permite).\\n` +
`Si no se adjunta automáticamente, por favor descárgalo con "Imprimir / PDF" y adjúntalo.\\n\\n` +
`Enviado desde: seguimiento-estudiantes.html`;

    const gmailUrl =
      "https://mail.google.com/mail/?view=cm&fs=1" +
      "&to=" + encodeURIComponent(to) +
      "&su=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);

    const mailto =
      "mailto:" + encodeURIComponent(to) +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);

    if(aGmail) aGmail.href = gmailUrl;
    if(aMailto) aMailto.href = mailto;
    if(sendCard) sendCard.style.display = "block";

    return { gmailUrl, mailto, subject, body };
  }

  function getSummaryText(){
    // Toma algunas métricas visibles del tablero para el cuerpo del correo
    const getTxt = (sel)=> (document.querySelector(sel)?.textContent || "").trim();
    const xp = getTxt("[data-kpi='xp_total']") || getTxt("#kpiXpTotal") || "";
    const level = getTxt("[data-kpi='level']") || getTxt("#kpiLevel") || "";
    const streak = getTxt("[data-kpi='streak']") || getTxt("#kpiStreak") || "";
    const acc = getTxt("[data-kpi='accuracy']") || getTxt("#kpiAccuracy") || "";
    const daily = getTxt("[data-kpi='daily']") || getTxt("#kpiDaily") || "";
    const mastered = getTxt("[data-kpi='mastered']") || getTxt("#kpiMastered") || "";
    const last = getTxt("[data-kpi='last_active']") || getTxt("#kpiLastActive") || "";

    const parts = [];
    if(xp) parts.push(`XP total: ${xp}`);
    if(level) parts.push(`Nivel: ${level}`);
    if(streak) parts.push(`Racha: ${streak}`);
    if(acc) parts.push(`Precisión: ${acc}`);
    if(daily) parts.push(`Meta diaria: ${daily}`);
    if(mastered) parts.push(`Dominio/Verbos: ${mastered}`);
    if(last) parts.push(`Última actividad: ${last}`);
    return parts.join("\\n") || "(Sin métricas visibles)";
  }

  async function generatePdfBlob(){
    // Genera un PDF del contenido usando html2canvas + jsPDF (CDN).
    const target = document.querySelector(".segMain") || document.body;
    if(!window.html2canvas) throw new Error("html2canvas no disponible");
    const jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
    if(!jsPDF) throw new Error("jsPDF no disponible");

    // Garantiza que el panel esté en el top antes de capturar
    try{ window.scrollTo({top:0, behavior:"instant"}); }catch(_){ window.scrollTo(0,0); }

    const canvas = await window.html2canvas(target, {
      scale: 2,
      backgroundColor: "#0a1020",
      useCORS: true
    });

    const imgData = canvas.toDataURL("image/png", 1.0);
    const pdf = new jsPDF("p", "pt", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while(heightLeft > 0){
      position = heightLeft - imgHeight; // posición negativa para "subir" la imagen
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const blob = pdf.output("blob");
    return blob;
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      try{ a.remove(); }catch(_){}
      try{ URL.revokeObjectURL(url); }catch(_){}
    }, 800);
  }

  async function sendReport(){
    if(!isLoggedIn()){
      toast("Debes iniciar sesión", "Inicia sesión con Google Workspace para enviar tu seguimiento.");
      return;
    }

    btnSend.disabled = true;
    btnSend.style.opacity = ".75";
    toast("Preparando...", "Generando el PDF de tu seguimiento...");

    const prof = getProfile();
    const safeName = (prof.name || "Estudiante").replace(/[^a-z0-9]+/gi,"_").slice(0,40);
    const fileName = `Seguimiento_${safeName}_${new Date().toISOString().slice(0,10)}.pdf`;

    const summary = getSummaryText();
    const links = buildEmailLinks(summary);

    let blob = null;
    try{
      blob = await generatePdfBlob();
    }catch(err){
      // si falla la generación del pdf, aún abrimos el correo con resumen
      console.warn(err);
    }

    // 1) Si el navegador permite compartir archivos (celular), enviamos con adjunto
    if(blob){
      try{
        const file = new File([blob], fileName, {type:"application/pdf"});
        if(navigator.canShare && navigator.canShare({files:[file]}) && navigator.share){
          await navigator.share({
            title: "Seguimiento NeuroVerbs",
            text: "Adjunto va tu PDF de seguimiento. Enviar a: neuroaprendizajedelosverbosirregulares@iemanueljbetancur.edu.co",
            files: [file]
          });
          toast("Listo", "Se abrió el menú de compartir con el PDF adjunto. Elige Gmail y envíalo.");
          btnSend.disabled = false;
          btnSend.style.opacity = "1";
          return;
        }
      }catch(err){
        console.warn("share failed", err);
      }
    }

    // 2) Desktop/otros: descargamos el PDF y abrimos Gmail con el mensaje listo (el usuario adjunta el archivo)
    if(blob){
      downloadBlob(blob, fileName);
    }
    // Intento abrir Gmail en nueva pestaña; si está bloqueado, mostramos enlaces.
    let w = null;
    try{ w = window.open(links.gmailUrl, "_blank", "noopener,noreferrer"); }catch(_){ w = null; }
    if(!w){
      try{ window.location.assign(links.gmailUrl); }catch(_){ window.location.href = links.mailto; }
    }
    toast("Correo listo", "Se abrió el correo con el resumen. Adjunta el PDF descargado y presiona ENVIAR.");
    btnSend.disabled = false;
    btnSend.style.opacity = "1";
  }

  btnSend.addEventListener("click", sendReport);
})();
