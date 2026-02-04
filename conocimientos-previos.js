
// NEUROVERBS - Conocimientos previos (actividades con XP)
(function(){
  "use strict";

  const GAME_KEY = "yoguis_neuro_gamification_v1";
  const PENDING_XP_KEY = "yoguis_xp_pending_delta_v1";
  const AWARD_KEY = "yoguis_neuro_preknowledge_awards_v1";
  const KP_BADGE_KEY = "yoguis_kp_badge_v1";

  function safeGet(key){
    try{ return localStorage.getItem(key); }catch(_){ return null; }
  }
  function safeSet(key,val){
    try{ localStorage.setItem(key,val); }catch(_){}
  }
  function todayKey(){
    const d=new Date();
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    const day=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

// Ajusta el "safe top" para que la barra fija no tape contenido (varía si la barra cambia de altura)
function clampNV(n, min, max){
  return Math.max(min, Math.min(max, n));
}

function computeTopSafes(){
  const root = document.documentElement;
  const bar  = document.getElementById("statsBar");
  const dock = document.getElementById("kpTopDock");
  if(!bar) return;

  const safeTop = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safeTop")) || 0);
  const vh = Math.max(1, window.innerHeight || 1);

  // Medición estable: usa el bottom real del rect (incluye top + altura)
  const r = bar.getBoundingClientRect();
  let statsBottom = Math.round(r.bottom);

  // Guard rails: evita un padding enorme si el navegador reporta valores raros
  const MIN_BOTTOM = Math.round(safeTop + 60);
  const MAX_BOTTOM = Math.round(safeTop + Math.min(240, Math.round(vh * 0.28) + 40));

  if(!Number.isFinite(statsBottom) || statsBottom <= 0) statsBottom = MIN_BOTTOM;
  statsBottom = clampNV(statsBottom, MIN_BOTTOM, MAX_BOTTOM);

  const GAP = 6;
  const dockTop = statsBottom + GAP;

  root.style.setProperty("--statsBottom", `${statsBottom}px`);
  root.style.setProperty("--dockTop", `${dockTop}px`);

  // Mide el alto del dock para reservar espacio al hacer scroll (tabs + header)
  let dockH = 0;
  if(dock){
    const dr = dock.getBoundingClientRect();
    dockH = Math.round(dr.height || dock.offsetHeight || dock.scrollHeight || 0);
    dockH = clampNV(dockH, 120, 420);
  }

  const hudSafe = dockTop + dockH + 14;
  root.style.setProperty("--hudSafeTop", `${hudSafe}px`);
  root.style.setProperty("--hudSafe", `${hudSafe}px`);
  document.body.style.setProperty("--hudSafeTop", `${hudSafe}px`);
  document.body.style.setProperty("--hudSafe", `${hudSafe}px`);
}


  function applyHudSafe(){
    computeTopSafes();
  }
  function onResizeDebounced(){
    let t=null;
    return function(){
      if(t) clearTimeout(t);
      t=setTimeout(()=>{ applyHudSafe();
    setupBottomTabs();
    // Re-medición corta para evitar 'vacíos' si el CSS/fuentes cargan tarde
    requestAnimationFrame(()=>{ applyHudSafe(); });
    setTimeout(()=>{ applyHudSafe(); }, 350);
    setTimeout(()=>{ applyHudSafe(); }, 1000); }, 120);
    };
  }
  const _onResize = onResizeDebounced();
function getGame(){
    const raw = safeGet(GAME_KEY);
    let st = {};
    if(raw){
      try{ st = JSON.parse(raw)||{}; }catch(_){ st={}; }
    }
    // defaults mínimos (no rompemos lo que ya tenga core.js)
    if(typeof st.xp !== "number") st.xp = Number(st.xp||0);
    if(typeof st.dailyXP !== "number") st.dailyXP = Number(st.dailyXP||0);
    if(typeof st.dailyGoal !== "number") st.dailyGoal = Number(st.dailyGoal||200);
    if(!st.lastDailyKey) st.lastDailyKey = todayKey();
    if(typeof st.streak !== "number") st.streak = Number(st.streak||0);
    if(typeof st.att !== "number") st.att = Number(st.att||0);
    if(typeof st.corr !== "number") st.corr = Number(st.corr||0);
    if(typeof st.freezeTokens !== "number") st.freezeTokens = Number(st.freezeTokens||0);
    if(typeof st.hearts !== "number") st.hearts = Number((st.hearts ?? 5));

    // reset si cambió el día
    const tk = todayKey();
    if(st.lastDailyKey !== tk){
      st.dailyXP = 0;
      st.lastDailyKey = tk;
    }
    return st;
  }

  function setGame(st){
    safeSet(GAME_KEY, JSON.stringify(st));
  }

  function addPending(delta){
    const cur = Number(safeGet(PENDING_XP_KEY)||0);
    const next = (Number.isFinite(cur)?cur:0) + delta;
    safeSet(PENDING_XP_KEY, String(next));
    return next;
  }

  function awardXP(amount, reason){
    const a = Number(amount||0);
    if(!Number.isFinite(a) || a<=0) return {ok:false};
    const st = getGame();
    st.xp = Number(st.xp||0) + a;
    st.dailyXP = Number(st.dailyXP||0) + a;
    setGame(st);
    const pending = addPending(a);
    updateHUD();
    toast(`+${a} XP`, reason || "Actividad completada");
    return {ok:true, xp:st.xp, pending};
  }

  
  function launchConfetti(){
    const host = document.getElementById("kpConfetti") || (function(){
      const d=document.createElement("div");
      d.id="kpConfetti"; d.className="kpConfetti";
      document.body.appendChild(d);
      return d;
    })();

    // limpiar restos
    host.innerHTML = "";

    const colors = ["#f59e0b","#fb7185","#a78bfa","#22c55e","#38bdf8","#f97316"];
    const pieces = 28;
    const w = window.innerWidth || 1200;

    for(let i=0;i<pieces;i++){
      const p=document.createElement("div");
      p.className="c";
      const left = Math.random()*w;
      const delay = Math.random()*0.18;
      const size = 8 + Math.random()*10;
      p.style.left = left+"px";
      p.style.width = size+"px";
      p.style.height = size+"px";
      p.style.animationDelay = delay+"s";
      p.style.background = colors[i % colors.length];
      host.appendChild(p);
    }
    // auto limpiar después
    setTimeout(()=>{ host.innerHTML=""; }, 2200);
  }

  function markKpBadgeDone(){
    // guarda una insignia persistente (para mostrar en neuroverbs.html)
    const exists = safeGet(KP_BADGE_KEY);
    if(exists) return false;
    safeSet(KP_BADGE_KEY, JSON.stringify({ done:true, at: Date.now() }));
    return true;
  }

function toast(title, desc){
    const el = document.createElement("div");
    el.style.position="fixed";
    el.style.left="50%";
    el.style.bottom="22px";
    el.style.transform="translateX(-50%)";
    el.style.zIndex="9999";
    el.style.padding="10px 12px";
    el.style.borderRadius="14px";
    el.style.background="rgba(16,185,129,.18)";
    el.style.border="1px solid rgba(16,185,129,.35)";
    el.style.color="#fff";
    el.style.fontWeight="950";
    el.style.boxShadow="0 20px 40px rgba(0,0,0,.35)";
    el.innerHTML = `<div style="font-size:14px;">${escapeHtml(title)}</div><div style="font-size:12px;color:#cbd5e1;font-weight:800;margin-top:2px;">${escapeHtml(desc||"")}</div>`;
    document.body.appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .35s"; }, 1300);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 1800);
  }

  function escapeHtml(s){
    return String(s||"")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function getAwards(){
    const raw = safeGet(AWARD_KEY);
    if(!raw) return {done:{}};
    try{ return JSON.parse(raw)||{done:{}}; }catch(_){ return {done:{}}; }
  }
  function setAwards(st){
    safeSet(AWARD_KEY, JSON.stringify(st));
  }
  function isDone(id){
    const a = getAwards();
    return !!(a.done && a.done[id]);
  }
  function markDone(id, meta){
    const a = getAwards();
    if(!a.done) a.done = {};
    a.done[id] = Object.assign({ts:Date.now()}, meta||{});
    setAwards(a);
    updateBadges();
    setStudentHUD();
    updateHUD();
  }

  function computeLevel(totalXP){
    // Nivel estable: 250 XP por nivel (igual a la app principal)
    const xpPerLevel = 250;
    const xp = Number(totalXP||0);
    const lvl = Math.floor(xp/xpPerLevel) + 1;
    const into = xp % xpPerLevel;
    return {lvl, into, xpPerLevel};
  }

  function heartsString(h, max){
    const MAX = Number.isFinite(max)?max:5;
    const hh = Math.max(0, Math.min(MAX, Number(h ?? MAX)));
    const full = "❤️".repeat(hh);
    const empty = "🤍".repeat(Math.max(0, MAX - hh));
    return (full + empty) || "🤍🤍🤍🤍🤍";
  }

  
  // Ajusta el "safe area" superior según la altura real de la barra de puntajes
  function syncHudSafe(){
    computeTopSafes();
  }

  // Re-mide varias veces para evitar el bug de "vacío" arriba (cuando ui.css o fonts terminan de aplicar)
  function kickHUD(){
    syncHudSafe();
    requestAnimationFrame(()=>{
      syncHudSafe();
      requestAnimationFrame(syncHudSafe);
    });
    [60, 120, 220, 420, 800, 1200].forEach(ms=>setTimeout(syncHudSafe, ms));
    window.addEventListener("load", ()=>setTimeout(syncHudSafe, 40), {once:true});
  }

  // Mantén el espacio superior correcto si cambia el tamaño del menú
  (function(){
    const bar = document.getElementById("statsBar");
    const dock = document.getElementById("kpTopDock");
    if((!bar && !dock) || typeof ResizeObserver==="undefined") return;
    const ro = new ResizeObserver(()=>{ syncHudSafe(); });
    if(bar) ro.observe(bar);
    if(dock) ro.observe(dock);
  })();

  /* ✅ Menú de puntajes: carrusel horizontal premium (una sola fila) */
  function initStatsCarousel(){
    const bar = document.getElementById("statsBar");
    if(!bar) return;


    const prevBtn = bar.querySelector(".statsNavBtn.left");
    const nextBtn = bar.querySelector(".statsNavBtn.right");
    const scrollAmt = ()=>Math.max(240, Math.floor(bar.clientWidth * 0.60));

    const bindOnce = (btn, dir)=>{
      if(!btn || btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", ()=>{
        bar.scrollBy({ left: dir * scrollAmt(), behavior: "smooth" });
        setTimeout(()=>{ try{ refresh(); }catch(_){} }, 90);
      });
    };
    bindOnce(prevBtn, -1);
    bindOnce(nextBtn,  1);

    // Estado scrollable + fades
    const refresh = ()=>{
      const scrollable = (bar.scrollWidth - bar.clientWidth) > 2;
      bar.classList.toggle("isScrollable", scrollable);
      if(!scrollable){
        bar.classList.remove("atStart","atEnd");
        return;
      }
      bar.classList.toggle("atStart", bar.scrollLeft <= 1);
      bar.classList.toggle("atEnd", bar.scrollLeft >= (bar.scrollWidth - bar.clientWidth - 1));

      const prevBtn = bar.querySelector(".statsNavBtn.left");
      const nextBtn = bar.querySelector(".statsNavBtn.right");
      if(prevBtn) prevBtn.disabled = (!scrollable || bar.scrollLeft <= 1);
      if(nextBtn) nextBtn.disabled = (!scrollable || bar.scrollLeft >= (bar.scrollWidth - bar.clientWidth - 1));
    };

    // Wheel vertical -> horizontal (sin shift) cuando haya overflow
    const onWheel = (e)=>{
      if(!bar.classList.contains("isScrollable")) return;
      if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
        bar.scrollLeft += e.deltaY;
        e.preventDefault();
        refresh();
      }
    };

    // Drag con mouse / touchpad (pointer)
    let dragging = false;
    let startX = 0;
    let startLeft = 0;

    const onDown = (e)=>{
      // Solo click izquierdo si es mouse
      if(e.pointerType === "mouse" && e.button !== 0) return;
      if(!bar.classList.contains("isScrollable")) return;
      dragging = true;
      startX = e.clientX;
      startLeft = bar.scrollLeft;
      bar.classList.add("isDragging");
      try{ bar.setPointerCapture(e.pointerId); }catch(_){}
    };
    const onMove = (e)=>{
      if(!dragging) return;
      const dx = e.clientX - startX;
      bar.scrollLeft = startLeft - dx;
      refresh();
    };
    const onUp = ()=>{
      dragging = false;
      bar.classList.remove("isDragging");
      refresh();
    };

    bar.addEventListener("scroll", ()=>{ requestAnimationFrame(refresh); }, {passive:true});
    bar.addEventListener("wheel", onWheel, {passive:false});
    bar.addEventListener("pointerdown", onDown, {passive:true});
    bar.addEventListener("pointermove", onMove, {passive:true});
    bar.addEventListener("pointerup", onUp, {passive:true});
    bar.addEventListener("pointercancel", onUp, {passive:true});

    // Primera medición
    refresh();
    // Re-medir luego del render
    setTimeout(refresh, 50);
    window.addEventListener("resize", ()=>requestAnimationFrame(refresh), {passive:true});
  }

  // Lee un CSS var (px) como número
  function cssVarPx(name){
    try{
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    }catch(_){ return 0; }
  }

  // Modo compacto automático para el encabezado fijo (solo afecta la zona superior)
  // - En pantallas pequeñas, cuando el usuario baja, se reduce el alto del dock
  // - Mantiene siempre visibles los botones 1–4
  function initDockCompactMode(){
    const dock = document.getElementById("kpTopDock");
    if(!dock) return;

    let compact = false;
    const onY  = 140; // activa
    const offY = 90;  // desactiva (histeresis)

    const prefers = () => (window.innerWidth < 980 || window.innerHeight < 760);

    const apply = (next)=>{
      if(next === compact) return;

      // Compensa el cambio de padding-top (pageTopPad) para evitar saltos bruscos
      const oldPad = cssVarPx("--pageTopPad") || parseFloat(getComputedStyle(document.body).paddingTop) || 0;

      compact = next;
      dock.classList.toggle("isCompact", next);
      document.body.classList.toggle("kpDockCompact", next);

      requestAnimationFrame(()=>{
        syncHudSafe();
        const newPad = cssVarPx("--pageTopPad") || parseFloat(getComputedStyle(document.body).paddingTop) || 0;
        const diff = Math.round(newPad - oldPad);
        if(Math.abs(diff) > 2){
          try{ window.scrollBy({ top: diff, left: 0, behavior: "auto" }); }
          catch(_){ window.scrollBy(0, diff); }
        }
      });
    };

    const evaluate = ()=>{
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      if(!prefers()) return apply(false);
      const want = compact ? (y > offY) : (y > onY);
      apply(want);
    };

    window.addEventListener("scroll", evaluate, {passive:true});
    window.addEventListener("resize", evaluate, {passive:true});
    setTimeout(evaluate, 0);
  }


function updateHUD(){
    const st = getGame();
    const pending = Number(safeGet(PENDING_XP_KEY)||0);

    const streakEl = document.getElementById("streak");
    if(streakEl) streakEl.textContent = String(Math.round(st.streak||0));

    const xpEl = document.getElementById("xp");
    if(xpEl) xpEl.textContent = String(Math.round(st.xp||0));

    const att = Number(st.att||0);
    const corr = Number(st.corr||0);
    const accPct = att>0 ? Math.max(0, Math.min(100, Math.round((corr/att)*100))) : 100;
    const accEl = document.getElementById("acc");
    if(accEl) accEl.textContent = accPct + "%";

    const lvl = computeLevel(st.xp||0);
    const lvlEl = document.getElementById("level");
    if(lvlEl) lvlEl.textContent = String(lvl.lvl);

    const heartsEl = document.getElementById("hearts");
    if(heartsEl) heartsEl.textContent = heartsString(st.hearts, 5);

    const freezeEl = document.getElementById("freeze");
    if(freezeEl) freezeEl.textContent = String(Math.round(st.freezeTokens||0));

    const tEl = document.getElementById("dailyGoalText");
    const fill = document.getElementById("dailyGoalFill");
    const goal = Number(st.dailyGoal||200);
    const daily = Number(st.dailyXP||0);
    if(tEl) tEl.textContent = `${Math.min(daily, goal)}/${goal}`;
    if(fill){
      const pct = Math.max(0, Math.min(100, Math.round((daily/Math.max(1,goal))*100)));
      fill.style.width = pct + "%";
    }

    const pendEl = document.getElementById("kpPending");
    if(pendEl) pendEl.textContent = String(Math.round(pending||0));
  
    // KP misiones completadas (mini indicador)
    const c = countDone();
    const kpMEl = document.getElementById("kpMissionsText");
    if(kpMEl) kpMEl.textContent = `${c.done}/${c.total}`;

    // ✅ Estilo "KP terminado" cuando llega a 7/7
    const isDoneAll = (c.done === c.total);
    const pill = document.getElementById("kpMiniPill");
    if(pill) pill.classList.toggle("isDone", isDoneAll);

    const doneMsg = document.getElementById("kpDoneMsg");
    if(doneMsg) doneMsg.hidden = !isDoneAll;

    // ✅ Badge + confetti solo la primera vez que alcanzas 7/7
    if(isDoneAll){
      const isFirst = markKpBadgeDone();
      if(isFirst){
        // micro celebración
        launchConfetti();
        toast("✅ KP terminado", "¡Conocimientos previos completados!");
      }
    }
}


  const roadmap = [
    {title:"Pronombres personales (Subject)", desc:"I / You / He / She / It / We / They", chips:["mínimo"]},
    {title:"Regla 3ª persona (-s)", desc:"He/She/It + verb+s (Present Simple)", chips:["clave"]},
    {title:"Regulares vs Irregulares", desc:"Identifica si cambia en pasado/participio", chips:["vocabulario"]},
    {title:"Have: HABER (aux) vs TENER", desc:"Perfect = have/has + V3", chips:["punto crítico"]},
    {title:"Tenses: afirmativa/negativa/interrogativa", desc:"Do/Did/Have al frente", chips:["estructura"]},
    {title:"Linking Words", desc:"Conectores para unir ideas", chips:["escritura"]},
  ];

  function renderRoadmap(){
    const root = document.getElementById("kpRoadmap");
    if(!root) return;
    root.innerHTML = "";
    roadmap.forEach((s)=>{
      const div = document.createElement("div");
      div.className = "kpStep";
      div.innerHTML = `
        <div class="kpDot"></div>
        <div>
          <div class="kpStepTitle">${escapeHtml(s.title)}</div>
          <div class="kpStepDesc">${escapeHtml(s.desc)}</div>
          <div class="kpStepMeta">${(s.chips||[]).map(c=>`<span class="kpChip">${escapeHtml(c)}</span>`).join("")}</div>
        </div>
      `;
      root.appendChild(div);
    });
  }

  // =========================
  // QUIZZES
  // =========================
  function makeQuiz(rootId, questions){
    const root = document.getElementById(rootId);
    if(!root) return;
    root.innerHTML = "";
    questions.forEach((q, i)=>{
      const qEl = document.createElement("div");
      qEl.className="kpQ";
      qEl.dataset.correct = q.correct;
      qEl.innerHTML = `
        <div class="kpQTitle">${i+1}. ${escapeHtml(q.prompt)}</div>
        ${q.options.map((opt, j)=>`
          <label><input type="radio" name="${rootId}_q${i}" value="${escapeHtml(opt)}"> ${escapeHtml(opt)}</label>
        `).join("")}
      `;
      root.appendChild(qEl);
    });
  }

  function gradeQuiz(rootId){
    const root = document.getElementById(rootId);
    if(!root) return {score:0,total:0};
    const qEls = Array.from(root.querySelectorAll(".kpQ"));
    let correct = 0;
    qEls.forEach((qEl)=>{
      const corr = qEl.dataset.correct;
      const checked = qEl.querySelector("input[type=radio]:checked");
      const val = checked ? checked.value : "";
      if(val === corr){
        correct++;
        qEl.style.borderColor="rgba(16,185,129,.55)";
      }else{
        qEl.style.borderColor="rgba(239,68,68,.45)";
      }
    });
    return {score:correct, total:qEls.length};
  }

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function pickN(arr,n){
    return shuffle(arr).slice(0,n);
  }

  // Data sets (derivados del PDF)
  const pronouns = [
    {es:"Yo", en:"I"},
    {es:"Tú / Usted", en:"You"},
    {es:"Él", en:"He"},
    {es:"Ella", en:"She"},
    {es:"Eso / Cosa", en:"It"},
    {es:"Nosotros", en:"We"},
    {es:"Ustedes", en:"You"},
    {es:"Ellos / Ellas", en:"They"},
  ];

  const thirdPersonPairs = [
    ["I", "work", "I work"],
    ["You", "work", "You work"],
    ["We", "work", "We work"],
    ["They", "work", "They work"],
    ["He", "work", "He works"],
    ["She", "work", "She works"],
    ["It", "work", "It works"],
    ["He", "play", "He plays"],
    ["She", "dance", "She dances"],
    ["It", "listen", "It listens"],
    ["He", "write", "He writes"],
    ["She", "buy", "She buys"],
    ["It", "eat", "It eats"],
    ["He", "sleep", "He sleeps"],
  ];

  const haveSentences = [
    {s:"I have eaten pizza.", a:"HABER"},
    {s:"She has gone home.", a:"HABER"},
    {s:"They have studied a lot.", a:"HABER"},
    {s:"I have a new computer.", a:"TENER"},
    {s:"They have three children.", a:"TENER"},
    {s:"Do you have a cold?", a:"TENER"},
    {s:"I have to work.", a:"HAVE TO"},
    {s:"She has to study.", a:"HAVE TO"},
    {s:"We have finished the report.", a:"HABER"},
    {s:"He has a dog.", a:"TENER"},
    {s:"Have you visited Rome?", a:"HABER"},
    {s:"I have to wash the car.", a:"HAVE TO"},
  ];

  const tensesAux = [
    {p:"___ I ask? (present)", opts:["Do", "Did", "Have"], c:"Do"},
    {p:"___ I ask? (past)", opts:["Do", "Did", "Have"], c:"Did"},
    {p:"___ I asked? (present perfect)", opts:["Do", "Did", "Have"], c:"Have"},
    {p:"I ___ ask. (present negative)", opts:["don't", "didn't", "haven't"], c:"don't"},
    {p:"I ___ ask. (past negative)", opts:["don't", "didn't", "haven't"], c:"didn't"},
    {p:"I ___ asked. (present perfect negative)", opts:["don't", "didn't", "haven't"], c:"haven't"},
    {p:"___ she work? (present)", opts:["Does", "Did", "Has"], c:"Does"},
    {p:"She ___ worked. (present perfect)", opts:["have", "has", "did"], c:"has"},
    {p:"She ___ work. (present negative)", opts:["doesn't", "didn't", "hasn't"], c:"doesn't"},
    {p:"___ she work? (past)", opts:["Does", "Did", "Has"], c:"Did"},
  ];

  const linkingTables = {
    add: [
      ["And", "Y", "I work in the morning and I study at night.", "Present Simple"],
      ["Also", "También", "She walked to the park. She also visited the museum.", "Past Simple"],
      ["In addition", "Además", "He has finished the report. In addition, he has printed the files.", "Present Perfect"],
      ["Moreover", "Además", "The computer works fast. Moreover, it prints quickly.", "Present Simple"],
      ["Too", "También", "I washed the car. I cleaned the room too.", "Past Simple"],
    ],
    contrast: [
      ["But", "Pero", "I have studied a lot, but I failed the test.", "Present Perfect + Past Simple"],
      ["However", "Sin embargo", "It rained all day. However, we played soccer.", "Past Simple"],
      ["Although", "Aunque", "Although she works hard, she doesn't earn much money.", "Present Simple"],
      ["On the other hand", "Por otro lado", "I have lived here for years. On the other hand, I have never traveled.", "Present Perfect"],
      ["Despite", "A pesar de", "We walked home despite the rain.", "Past Simple"],
    ],
    cause: [
      ["Because", "Porque", "I smile because I have passed the exam.", "Present Simple + Present Perfect"],
      ["So", "Así que", "It rained heavily, so I stayed home.", "Past Simple"],
      ["Therefore", "Por lo tanto", "He doesn't listen. Therefore, he fails the exams.", "Present Simple"],
      ["As a result", "Como resultado", "The store closed. As a result, they looked for new jobs.", "Past Simple"],
      ["Due to", "Debido a", "We have canceled the trip due to the storm.", "Present Perfect"],
    ],
    seq: [
      ["First", "Primero", "First, I wash the vegetables.", "Present Simple"],
      ["Next", "Siguiente", "Next, I mixed the sugar and butter.", "Past Simple"],
      ["Then", "Luego", "I walked to the gym. Then, I exercised for an hour.", "Past Simple"],
      ["Finally", "Finalmente", "I have finally finished the project.", "Present Perfect"],
      ["Meanwhile", "Mientras tanto", "I cook dinner. Meanwhile, he cleans the table.", "Present Simple"],
    ],
    illus: [
      ["For example", "Por ejemplo", "I have visited many cities, for example, Rome and Paris.", "Present Perfect"],
      ["For instance", "Por ejemplo", "Bright colors help. For instance, red attracts attention.", "Present Simple"],
      ["Such as", "Tal como", "She cooked Italian dishes such as lasagna.", "Past Simple"],
    ],
  };

  const linkingQuizPool = [
    {s:"I work in the morning, ___ I study at night.", a:"and", opts:["and","however","because"]},
    {s:"It rained all day. ___ , we played soccer.", a:"However", opts:["However","First","Because"]},
    {s:"I smile ___ I have passed the exam.", a:"because", opts:["because","despite","next"]},
    {s:"First, I wash the vegetables. ___ , I cook them.", a:"Then", opts:["Then","Moreover","Although"]},
    {s:"I have visited many cities, ___ , Rome and Paris.", a:"for example", opts:["for example","so","despite"]},
    {s:"I studied a lot, ___ I failed the test.", a:"but", opts:["but","therefore","too"]},
    {s:"The computer works fast. ___ , it prints quickly.", a:"Moreover", opts:["Moreover","Due to","Then"]},
    {s:"The store closed. ___ , they looked for new jobs.", a:"As a result", opts:["As a result","Although","And"]},
    {s:"I washed the car. I cleaned the room ___ .", a:"too", opts:["too","however","because"]},
    {s:"We walked home ___ the rain.", a:"despite", opts:["despite","in addition","first"]},
  ];

  // 3-column examples (PDF section 2.4)
  const threeCols = [
    ["To Play", "Played", "Played", "Jugar"],
    ["To Cook", "Cooked", "Cooked", "Cocinar"],
    ["To Walk", "Walked", "Walked", "Caminar"],
    ["To Dance", "Danced", "Danced", "Bailar"],
    ["To Listen", "Listened", "Listened", "Escuchar"],
    ["To Drink", "Drank", "Drunk", "Beber"],
    ["To Sleep", "Slept", "Slept", "Dormir"],
    ["To Eat", "Ate", "Eaten", "Comer"],
    ["To Buy", "Bought", "Bought", "Comprar"],
    ["To Write", "Wrote", "Written", "Escribir"],
  ];

  // Tenses tables (resumen organizado por temática como PDF)
  const tensesThemes = [
    {theme:"1. Comunicación y Expresión", verbs:[
      ["To Ask","Preguntar","I ask","I asked","I have asked","I don't ask","I didn't ask","I haven't asked","Do I ask?","Did I ask?","Have I asked?"],
      ["To Answer","Responder","I answer","I answered","I have answered","I don't answer","I didn't answer","I haven't answered","Do I answer?","Did I answer?","Have I answered?"],
      ["To Talk","Hablar","I talk","I talked","I have talked","I don't talk","I didn't talk","I haven't talked","Do I talk?","Did I talk?","Have I talked?"],
      ["To Call","Llamar","I call","I called","I have called","I don't call","I didn't call","I haven't called","Do I call?","Did I call?","Have I called?"],
      ["To Explain","Explicar","I explain","I explained","I have explained","I don't explain","I didn't explain","I haven't explained","Do I explain?","Did I explain?","Have I explained?"],
      ["To Cry","Llorar","I cry","I cried","I have cried","I don't cry","I didn't cry","I haven't cried","Do I cry?","Did I cry?","Have I cried?"],
      ["To Laugh","Reír","I laugh","I laughed","I have laughed","I don't laugh","I didn't laugh","I haven't laughed","Do I laugh?","Did I laugh?","Have I laughed?"],
      ["To Smile","Sonreír","I smile","I smiled","I have smiled","I don't smile","I didn't smile","I haven't smiled","Do I smile?","Did I smile?","Have I smiled?"],
    ]},
    {theme:"2. Sentimientos, Deseos y Mente", verbs:[
      ["To Love","Amar","I love","I loved","I have loved","I don't love","I didn't love","I haven't loved","Do I love?","Did I love?","Have I loved?"],
      ["To Like","Gustar","I like","I liked","I have liked","I don't like","I didn't like","I haven't liked","Do I like?","Did I like?","Have I liked?"],
      ["To Want","Querer","I want","I wanted","I have wanted","I don't want","I didn't want","I haven't wanted","Do I want?","Did I want?","Have I wanted?"],
      ["To Need","Necesitar","I need","I needed","I have needed","I don't need","I didn't need","I haven't needed","Do I need?","Did I need?","Have I needed?"],
      ["To Believe","Creer","I believe","I believed","I have believed","I don't believe","I didn't believe","I haven't believed","Do I believe?","Did I believe?","Have I believed?"],
      ["To Remember","Recordar","I remember","I remembered","I have remembered","I don't remember","I didn't remember","I haven't remembered","Do I remember?","Did I remember?","Have I remembered?"],
      ["To Decide","Decidir","I decide","I decided","I have decided","I don't decide","I didn't decide","I haven't decided","Do I decide?","Did I decide?","Have I decided?"],
      ["To Hope","Esperar (deseo)","I hope","I hoped","I have hoped","I don't hope","I didn't hope","I haven't hoped","Do I hope?","Did I hope?","Have I hoped?"],
      ["To Enjoy","Disfrutar","I enjoy","I enjoyed","I have enjoyed","I don't enjoy","I didn't enjoy","I haven't enjoyed","Do I enjoy?","Did I enjoy?","Have I enjoyed?"],
    ]},
    {theme:"3. Movimiento y Desplazamiento", verbs:[
      ["To Walk","Caminar","I walk","I walked","I have walked","I don't walk","I didn't walk","I haven't walked","Do I walk?","Did I walk?","Have I walked?"],
      ["To Move","Moverse","I move","I moved","I have moved","I don't move","I didn't move","I haven't moved","Do I move?","Did I move?","Have I moved?"],
      ["To Travel","Viajar","I travel","I traveled","I have traveled","I don't travel","I didn't travel","I haven't traveled","Do I travel?","Did I travel?","Have I traveled?"],
      ["To Arrive","Llegar","I arrive","I arrived","I have arrived","I don't arrive","I didn't arrive","I haven't arrived","Do I arrive?","Did I arrive?","Have I arrived?"],
      ["To Dance","Bailar","I dance","I danced","I have danced","I don't dance","I didn't dance","I haven't danced","Do I dance?","Did I dance?","Have I danced?"],
      ["To Visit","Visitar","I visit","I visited","I have visited","I don't visit","I didn't visit","I haven't visited","Do I visit?","Did I visit?","Have I visited?"],
    ]},
    {theme:"4. Acciones Físicas / Manipulación", verbs:[
      ["To Open","Abrir","I open","I opened","I have opened","I don't open","I didn't open","I haven't opened","Do I open?","Did I open?","Have I opened?"],
      ["To Close","Cerrar","I close","I closed","I have closed","I don't close","I didn't close","I haven't closed","Do I close?","Did I close?","Have I closed?"],
      ["To Push","Empujar","I push","I pushed","I have pushed","I don't push","I didn't push","I haven't pushed","Do I push?","Did I push?","Have I pushed?"],
      ["To Pull","Halar / Tirar","I pull","I pulled","I have pulled","I don't pull","I didn't pull","I haven't pulled","Do I pull?","Did I pull?","Have I pulled?"],
      ["To Touch","Tocar","I touch","I touched","I have touched","I don't touch","I didn't touch","I haven't touched","Do I touch?","Did I touch?","Have I touched?"],
      ["To Clean","Limpiar","I clean","I cleaned","I have cleaned","I don't clean","I didn't clean","I haven't cleaned","Do I clean?","Did I clean?","Have I cleaned?"],
      ["To Wash","Lavar","I wash","I washed","I have washed","I don't wash","I didn't wash","I haven't washed","Do I wash?","Did I wash?","Have I washed?"],
      ["To Cook","Cocinar","I cook","I cooked","I have cooked","I don't cook","I didn't cook","I haven't cooked","Do I cook?","Did I cook?","Have I cooked?"],
      ["To Fix","Reparar","I fix","I fixed","I have fixed","I don't fix","I didn't fix","I haven't fixed","Do I fix?","Did I fix?","Have I fixed?"],
    ]},
    {theme:"5. Trabajo, Estudio y Logros", verbs:[
      ["To Work","Trabajar","I work","I worked","I have worked","I don't work","I didn't work","I haven't worked","Do I work?","Did I work?","Have I worked?"],
      ["To Study","Estudiar","I study","I studied","I have studied","I don't study","I didn't study","I haven't studied","Do I study?","Did I study?","Have I studied?"],
      ["To Learn","Aprender","I learn","I learned","I have learned","I don't learn","I didn't learn","I haven't learned","Do I learn?","Did I learn?","Have I learned?"],
      ["To Finish","Terminar","I finish","I finished","I have finished","I don't finish","I didn't finish","I haven't finished","Do I finish?","Did I finish?","Have I finished?"],
      ["To Try","Intentar","I try","I tried","I have tried","I don't try","I didn't try","I haven't tried","Do I try?","Did I try?","Have I tried?"],
      ["To Plan","Planear","I plan","I planned","I have planned","I don't plan","I didn't plan","I haven't planned","Do I plan?","Did I plan?","Have I planned?"],
      ["To Copy","Copiar","I copy","I copied","I have copied","I don't copy","I didn't copy","I haven't copied","Do I copy?","Did I copy?","Have I copied?"],
    ]},
    {theme:"6. Interacción Social y Ayuda", verbs:[
      ["To Help","Ayudar","I help","I helped","I have helped","I don't help","I didn't help","I haven't helped","Do I help?","Did I help?","Have I helped?"],
      ["To Invite","Invitar","I invite","I invited","I have invited","I don't invite","I didn't invite","I haven't invited","Do I invite?","Did I invite?","Have I invited?"],
      ["To Join","Unirse","I join","I joined","I have joined","I don't join","I didn't join","I haven't joined","Do I join?","Did I join?","Have I joined?"],
      ["To Agree","Estar de acuerdo","I agree","I agreed","I have agreed","I don't agree","I didn't agree","I haven't agreed","Do I agree?","Did I agree?","Have I agreed?"],
      ["To Accept","Aceptar","I accept","I accepted","I have accepted","I don't accept","I didn't accept","I haven't accepted","Do I accept?","Did I accept?","Have I accepted?"],
      ["To Offer","Ofrecer","I offer","I offered","I have offered","I don't offer","I didn't offer","I haven't offered","Do I offer?","Did I offer?","Have I offered?"],
    ]},
    {theme:"7. Percepción (Sentidos)", verbs:[
      ["To Look","Mirar","I look","I looked","I have looked","I don't look","I didn't look","I haven't looked","Do I look?","Did I look?","Have I looked?"],
      ["To Watch","Observar","I watch","I watched","I have watched","I don't watch","I didn't watch","I haven't watched","Do I watch?","Did I watch?","Have I watched?"],
      ["To Listen","Escuchar","I listen","I listened","I have listened","I don't listen","I didn't listen","I haven't listened","Do I listen?","Did I listen?","Have I listened?"],
      ["To Notice","Notar","I notice","I noticed","I have noticed","I don't notice","I didn't notice","I haven't noticed","Do I notice?","Did I notice?","Have I noticed?"],
    ]},
    {theme:"8. Inicio, Fin y Cambio", verbs:[
      ["To Start","Comenzar","I start","I started","I have started","I don't start","I didn't start","I haven't started","Do I start?","Did I start?","Have I started?"],
      ["To Stop","Parar","I stop","I stopped","I have stopped","I don't stop","I didn't stop","I haven't stopped","Do I stop?","Did I stop?","Have I stopped?"],
      ["To Change","Cambiar","I change","I changed","I have changed","I don't change","I didn't change","I haven't changed","Do I change?","Did I change?","Have I changed?"],
      ["To Wait","Esperar","I wait","I waited","I have waited","I don't wait","I didn't wait","I haven't waited","Do I wait?","Did I wait?","Have I waited?"],
      ["To Use","Usar","I use","I used","I have used","I don't use","I didn't use","I haven't used","Do I use?","Did I use?","Have I used?"],
    ]},
  ];

  function renderThreeCols(){
    const t = document.getElementById("tbl_3cols");
    if(!t) return;
    t.innerHTML = `
      <thead><tr><th>Infinitivo (V1)</th><th>Past (V2)</th><th>Participle (V3)</th><th>Traducción</th></tr></thead>
      <tbody>
        ${threeCols.map(r=>`<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td><td>${escapeHtml(r[2])}</td><td>${escapeHtml(r[3])}</td></tr>`).join("")}
      </tbody>
    `;
  }

  function renderTensesTables(){
    const aff = document.getElementById("tbl_tenses_aff");
    const neg = document.getElementById("tbl_tenses_neg");
    const itg = document.getElementById("tbl_tenses_int");
    if(!aff || !neg || !itg) return;

    function themeRows(modeIdx){
      return tensesThemes.map(th=>{
        const rows = th.verbs.map(v=>{
          // columns: 0 infinitive,1 es,2 present,3 past,4 perfect,5 neg present,6 neg past,7 neg perfect,8 int present,9 int past,10 int perfect
          const col = v[modeIdx];
          const col2 = v[modeIdx+1];
          const col3 = v[modeIdx+2];
          return `<tr><td>${escapeHtml(v[0])}</td><td>${escapeHtml(v[1])}</td><td>${escapeHtml(col)}</td><td>${escapeHtml(col2)}</td><td>${escapeHtml(col3)}</td></tr>`;
        }).join("");
        return `<tr><td colspan="5" style="background:rgba(242,139,22,.12);font-weight:950;color:#fff;">${escapeHtml(th.theme)}</td></tr>` + rows;
      }).join("");
    }

    aff.innerHTML = `
      <thead><tr><th>Verb</th><th>Traducción</th><th>Present</th><th>Past</th><th>Present Perfect</th></tr></thead>
      <tbody>${themeRows(2)}</tbody>
    `;
    neg.innerHTML = `
      <thead><tr><th>Verb</th><th>Traducción</th><th>Present (don't)</th><th>Past (didn't)</th><th>Perfect (haven't)</th></tr></thead>
      <tbody>${themeRows(5)}</tbody>
    `;
    itg.innerHTML = `
      <thead><tr><th>Verb</th><th>Traducción</th><th>Present (Do)</th><th>Past (Did)</th><th>Perfect (Have)</th></tr></thead>
      <tbody>${themeRows(8)}</tbody>
    `;
  }

  function renderLinkingTables(){
    function fill(id, rows){
      const t=document.getElementById(id);
      if(!t) return;
      t.innerHTML = `
        <thead><tr><th>Linking Word</th><th>Traducción</th><th>Ejemplo (solo verbos regulares)</th><th>Tiempos utilizados</th></tr></thead>
        <tbody>${rows.map(r=>`<tr><td><b>${escapeHtml(r[0])}</b></td><td>${escapeHtml(r[1])}</td><td>${escapeHtml(r[2])}</td><td>${escapeHtml(r[3])}</td></tr>`).join("")}</tbody>
      `;
    }
    fill("tbl_linking_add", linkingTables.add);
    fill("tbl_linking_contrast", linkingTables.contrast);
    fill("tbl_linking_cause", linkingTables.cause);
    fill("tbl_linking_seq", linkingTables.seq);
    fill("tbl_linking_illus", linkingTables.illus);
  }

  function updateBadges(){
    const ids = ["roadmap_check","pronouns_quiz","thirdperson_quiz","have_quiz","tenses_quiz","linking_quiz","writing_challenge"];
    ids.forEach((id)=>{
      const nodes = document.querySelectorAll(`.kpBadge[data-badge="${id}"]`);
      if(!nodes || !nodes.length) return;
      nodes.forEach((badge)=>{
        if(isDone(id)){
          badge.textContent = "Completada ✅";
          badge.classList.add("done");
        }else{
          badge.textContent = "Disponible";
          badge.classList.remove("done");
        }
      });
    });
  }

  const _attemptCache = {};

  function quizSignature(rootId){
    const root = document.getElementById(rootId);
    if(!root) return "";
    const qEls = Array.from(root.querySelectorAll('.kpQ'));
    const parts = qEls.map((qEl,i)=>{
      const checked = qEl.querySelector('input[type=radio]:checked');
      return checked ? checked.value : '';
    });
    return parts.join('|');
  }

  function startQuiz(id){
    if(id === "pronouns_quiz"){
      const qs = pickN(pronouns.map(p=>{
        const opts = shuffle([p.en, ...pickN(["I","You","He","She","It","We","They"].filter(x=>x!==p.en), 3)]);
        return {prompt:`¿Cómo se dice "${p.es}" en inglés?`, options: opts, correct: p.en};
      }), 10);
      makeQuiz("quiz_pronouns_quiz", qs);
      setResult(id, "Listo. Responde y luego presiona Calificar.");
    }
    if(id === "thirdperson_quiz"){
      const qs = pickN(thirdPersonPairs.map(([sub,verb,correct])=>{
        const wrong1 = `${sub} ${verb}`;
        const wrong2 = `${sub} ${verb}ed`;
        const wrong3 = `${sub} ${verb}s`;
        const opts = shuffle([correct, wrong1, wrong2, wrong3].filter((v,i,a)=>a.indexOf(v)===i));
        return {prompt:`Elige la forma correcta en Present Simple: (${sub} + ${verb})`, options: opts, correct};
      }), 10);
      makeQuiz("quiz_thirdperson_quiz", qs);
      setResult(id, "Listo. Responde y luego presiona Calificar.");
    }
    if(id === "have_quiz"){
      const qs = pickN(haveSentences.map(x=>{
        const opts = shuffle(["HABER","TENER","HAVE TO"]);
        return {prompt:`Clasifica: "${x.s}"`, options: opts, correct: x.a};
      }), 10);
      makeQuiz("quiz_have_quiz", qs);
      setResult(id, "Listo. Responde y luego presiona Calificar.");
    }
    if(id === "tenses_quiz"){
      const qs = pickN(tensesAux.map(x=>{
        return {prompt:x.p, options: x.opts, correct: x.c};
      }), 10);
      makeQuiz("quiz_tenses_quiz", qs);
      setResult(id, "Listo. Responde y luego presiona Calificar.");
    }
    if(id === "linking_quiz"){
      const qs = pickN(linkingQuizPool.map(x=>{
        const opts = shuffle(x.opts);
        return {prompt: x.s, options: opts, correct: x.a};
      }), 10);
      makeQuiz("quiz_linking_quiz", qs);
      setResult(id, "Listo. Responde y luego presiona Calificar.");
    }
  }

  function setResult(id, html){
    const el = document.getElementById(`res_${id}`);
    if(el) el.innerHTML = html;
  }

  function checkQuiz(id){
    const rootMap = {
      pronouns_quiz:"quiz_pronouns_quiz",
      thirdperson_quiz:"quiz_thirdperson_quiz",
      have_quiz:"quiz_have_quiz",
      tenses_quiz:"quiz_tenses_quiz",
      linking_quiz:"quiz_linking_quiz"
    };
    const rootId = rootMap[id];
    const r = gradeQuiz(rootId);
    const sig = quizSignature(rootId);
    const prevSig = _attemptCache[id] || "";
    const isNewAttempt = (sig !== prevSig);
    _attemptCache[id] = sig;

    const pass = r.total>0 ? (r.score >= 8) : false;
    const already = isDone(id);

    const awardById = {
      pronouns_quiz: 40,
      thirdperson_quiz: 40,
      have_quiz: 50,
      tenses_quiz: 50,
      linking_quiz: 40
    };

    // ✅ Actualizar métricas globales (barra superior) por intento NUEVO
    if(isNewAttempt){
      const st = getGame();
      st.att = Number(st.att||0) + Number(r.total||0);
      st.corr = Number(st.corr||0) + Number(r.score||0);

      if(pass){
        st.streak = Number(st.streak||0) + 1;
      }else{
        // Freeze protege la racha si existe
        if(Number(st.freezeTokens||0) > 0 && Number(st.streak||0) > 0){
          st.freezeTokens = Math.max(0, Number(st.freezeTokens||0) - 1);
        }else{
          st.streak = 0;
        }
        st.hearts = Math.max(0, Number((st.hearts ?? 5)) - 1);
      }
      setGame(st);
    }

    if(pass && !already){
      const amount = awardById[id] || 30;
      awardXP(amount, `Premio por ${id.replace("_"," ")}`);
      markDone(id, {score:r.score,total:r.total, xp:amount});
      setResult(id, `<span style="color:var(--success)">✅ ${r.score}/${r.total} • ¡Aprobado! Premio: +${amount} XP</span>`);
    }else if(pass && already){
      setResult(id, `<span style="color:var(--success)">✅ ${r.score}/${r.total} • Aprobado, pero ya reclamaste el premio.</span>`);
    }else{
      setResult(id, `<span style="color:var(--error)">❌ ${r.score}/${r.total} • Te faltan ${Math.max(0,8-r.score)} para aprobar. Intenta de nuevo.</span>`);
    }
    updateHUD();
  }

  

  // =========================
  // Propuesta A + B extras
  // =========================
  function qsParam(name){
    try{
      const u = new URL(window.location.href);
      return u.searchParams.get(name) || "";
    }catch(_){
      return "";
    }
  }
  function base64UrlEncode(str){
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function base64UrlDecode(b64url){
    let b64 = String(b64url||"").replace(/-/g,'+').replace(/_/g,'/');
    while(b64.length % 4) b64 += '=';
    const s = decodeURIComponent(escape(atob(b64)));
    return s;
  }
  async function copyText(txt){
    const t = String(txt||"");
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(t);
        toast("Copiado ✅", "Listo para pegar");
        return true;
      }
    }catch(_){}
    try{
      const ta=document.createElement("textarea");
      ta.value=t;
      ta.style.position="fixed";
      ta.style.left="-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("Copiado ✅", "Listo para pegar");
      return true;
    }catch(_){}
    return false;
  }

  function getUserProfile(){
    try{
      const raw = safeGet("user_profile");
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(_){
      return null;
    }
  }
  function getStudentIdentity(){
    const p = getUserProfile();
    const savedName = safeGet("kp_student_name_v1");
    const savedEmail = safeGet("kp_student_email_v1");
    let name = (p && (p.name || p.fullName)) || savedName || "";
    let email = (p && (p.email || p.mail)) || savedEmail || "";
    return {name, email};
  }
  function ensureStudentName(){
    const id = getStudentIdentity();
    if(id.name) return id;
    const asked = prompt("Escribe tu nombre (para la evidencia NVKP):") || "";
    const clean = asked.trim();
    if(clean){
      safeSet("kp_student_name_v1", clean);
      return {name:clean, email:id.email||""};
    }
    return {name:"", email:id.email||""};
  }

  function getClassCode(){
    const fromUrl = qsParam("class");
    const saved = safeGet("kp_class_code_v1") || "";
    return (fromUrl || saved || "").trim();
  }
  function setClassCode(code){
    const c = String(code||"").trim();
    safeSet("kp_class_code_v1", c);
    return c;
  }

  function computeKPXP(){
    const a = getAwards();
    let sum = 0;
    if(a && a.done){
      Object.keys(a.done).forEach((k)=>{
        const meta = a.done[k] || {};
        if(typeof meta.xp === "number") sum += meta.xp;
      });
    }
    return sum;
  }
  function countDone(){
    const ids = ["roadmap_check","pronouns_quiz","thirdperson_quiz","have_quiz","tenses_quiz","linking_quiz","writing_challenge"];
    let done = 0;
    ids.forEach(id=>{ if(isDone(id)) done++; });
    return {done, total:ids.length};
  }

  function setStudentHUD(){
    const id = getStudentIdentity();
    const nameEl = document.getElementById("kpStudentName");
    const classEl = document.getElementById("kpStudentClass");
    const compEl = document.getElementById("kpCompletion");
    if(nameEl) nameEl.textContent = id.name || "—";
    const cc = getClassCode();
    if(classEl) classEl.textContent = cc || "—";
    const c = countDone();
    if(compEl) compEl.textContent = `${c.done}/${c.total}`;
  }

  function setupTabs(){
    const tabs = Array.from(document.querySelectorAll(".kpTab"));
    const panes = Array.from(document.querySelectorAll(".kpTabPane"));
    function activate(which){
      tabs.forEach(t=>{
        const on = t.getAttribute("data-tab")===which;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      panes.forEach(p=>{
        const on = p.getAttribute("data-pane")===which;
        p.classList.toggle("hidden", !on);
      });
    }
    tabs.forEach(t=>{
      t.addEventListener("click", ()=>{
        activate(t.getAttribute("data-tab"));
      });
    });

    // Auto: si viene con #docente o #teacher, abre Docente
    const h = String(window.location.hash||"").toLowerCase();
    if(h.includes("docente") || h.includes("teacher")){
      activate("teacher");
      const sec = document.getElementById("docente");
      if(sec) sec.scrollIntoView({behavior:"smooth", block:"start"});
    }else{
      activate("student");
    }
  }

  function generateEvidence(){
    const ident = ensureStudentName();
    const cc = getClassCode();
    const c = countDone();
    const payload = {
      v: 1,
      app: "NEUROVERBS_KP",
      name: ident.name || "",
      email: ident.email || "",
      class: cc || "",
      xp_kp: computeKPXP(),
      activities_done: c.done,
      activities_total: c.total,
      completed: (c.done >= c.total),
      ts: Date.now()
    };
    const code = "NVKP1." + base64UrlEncode(JSON.stringify(payload));
    return code;
  }

  function parseEvidence(line){
    const s = String(line||"").trim();
    if(!s) return null;
    const clean = s.replace(/^NVKP1\./i, "");
    try{
      const jsonStr = base64UrlDecode(clean);
      const obj = JSON.parse(jsonStr);
      if(obj && obj.app === "NEUROVERBS_KP") return obj;
    }catch(_){}
    return null;
  }

  function formatDate(ts){
    try{
      const d = new Date(ts);
      const y=d.getFullYear();
      const m=String(d.getMonth()+1).padStart(2,"0");
      const day=String(d.getDate()).padStart(2,"0");
      const hh=String(d.getHours()).padStart(2,"0");
      const mm=String(d.getMinutes()).padStart(2,"0");
      return `${y}-${m}-${day} ${hh}:${mm}`;
    }catch(_){
      return "";
    }
  }

  
  function renderTeacherTable(items){
    const tbody = document.querySelector("#kpTeacherTable tbody");
    if(!tbody) return;
    tbody.innerHTML = "";
    const norm = (s)=> String(s||"").toLowerCase().trim().replace(/\s+/g," ").replace(/[^\w\u00C0-\u017F ]/g,"");
    (items||[]).forEach((it, idx)=>{
      const tr = document.createElement("tr");
      const done = Number(it.activities_done||0);
      const total = Number(it.activities_total||0);
      const rec = Number(it._records||1);

      const pasted = String(it.name_pasted||"").trim();
      const codeName = String(it.name_in_code||"").trim();
      const mismatch = pasted && codeName && (norm(pasted) !== norm(codeName));

      tr.innerHTML = `
        <td>${idx+1}</td>
        <td>
          <b>${escapeHtml(it.name||"")}</b>
          ${mismatch ? `<div class="kpSub">Código: ${escapeHtml(codeName)}</div>` : ``}
        </td>
        <td>${escapeHtml(it.class||"")}</td>
        <td>${rec > 1 ? `<b>${rec}x</b>` : `1`}</td>
        <td>${escapeHtml(String(it.xp_kp||0))}</td>
        <td>${escapeHtml(`${done}/${total}`)}</td>
        <td>${it.completed ? "✅" : "—"}</td>
        <td>${escapeHtml(formatDate(it.ts))}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function exportCsv(items){
    const rows = [
      ["name","email","class","records","xp_kp","activities_done","activities_total","completed","timestamp","name_in_code","name_pasted"]
    ];
    (items||[]).forEach(it=>{
      rows.push([
        it.name||"",
        it.email||"",
        it.class||"",
        String(it._records||1),
        String(it.xp_kp||0),
        String(it.activities_done||0),
        String(it.activities_total||0),
        it.completed ? "1" : "0",
        formatDate(it.ts),
        it.name_in_code || "",
        it.name_pasted || ""
      ]);
    });
    const csv = rows.map(r=>r.map(x=>{
      const v=String(x).replace(/"/g,'""');
      return `"${v}"`;
    }).join(",")).join("\n");

    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "neuroverbs_conocimientos_previos_clase.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(_){ } }, 300);
  }

  function setupClassMode(){
    const classFromUrl = qsParam("class");
    if(classFromUrl){
      setClassCode(classFromUrl);
    }

    const inpClass = document.getElementById("kpClassCode");
    const btnSave = document.getElementById("kpSaveClass");
    if(inpClass) inpClass.value = getClassCode();
    if(btnSave){
      btnSave.addEventListener("click", ()=>{
        const code = setClassCode(inpClass ? inpClass.value : "");
        toast("Clase guardada", code ? `Código: ${code}` : "Sin código");
        setStudentHUD();
      });
    }

    const btnGen = document.getElementById("kpGenEvidence");
    const btnCopy = document.getElementById("kpCopyEvidence");
    const box = document.getElementById("kpEvidenceBox");

    if(btnGen){
      btnGen.addEventListener("click", (e)=>{
        e.preventDefault();
        const code = generateEvidence();
        if(box) box.value = code;
        toast("Evidencia creada ✅", "Tu código NVKP ya está listo.");
        setStudentHUD();
      });
    }

    if(btnCopy){
      btnCopy.addEventListener("click", (e)=>{
        e.preventDefault();
        if(!box) return;
        copyText(box.value);
      });
    }

    const btnSend = document.getElementById("kpSendEvidence");

    function buildGmailUrlForKP(evidence){
      // Identidad del estudiante (Workspace si está logueado)
      let name = "Estudiante";
      let email = "";
      try{
        const prof = JSON.parse(safeGet("user_profile") || "null");
        if(prof){
          name = prof.name || name;
          email = prof.email || email;
        }
      }catch(_){}

      // Respaldo: nombre mostrado en KP
      try{
        const n = (document.getElementById("kpStudentName")?.textContent || "").trim();
        if(n && n !== "—") name = n;
      }catch(_){}

      const classCode = (getClassCode() || "").trim() || "SIN_CLASE";
      const completion = (document.getElementById("kpCompletion")?.textContent || "").trim() || "";
      const to = "neuroaprendizajedelosverbosirregulares@iemanueljbetancur.edu.co";

      const subject = `NVKP | ${name} | Clase ${classCode}`;
      const body =
`EVIDENCIA NVKP (Conocimientos Previos)\n\n` +
`Nombre: ${name}\n` +
`Email: ${email || "—"}\n` +
`Clase: ${classCode}\n` +
`Actividades: ${completion || "—"}\n` +
`Fecha/Hora: ${new Date().toLocaleString()}\n\n` +
`CÓDIGO NVKP:\n${evidence}\n\n` +
`Enviado desde: NeuroVerbs (Conocimientos Previos)`;

      const gmailUrl =
        "https://mail.google.com/mail/?view=cm&fs=1" +
        "&to=" + encodeURIComponent(to) +
        "&cc=" + encodeURIComponent((email || "")) +
        "&su=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      return gmailUrl;
    }

    function openOneGmailTab(url){
      // Abrir SOLO 1 pestaña nueva (sin abrir la app)
      let w = null;
      try{
        w = window.open("about:blank", "_blank");
      }catch(_){ w = null; }
      if(w){
        try{ w.opener = null; }catch(_){}
        try{
          w.location.href = url;
        }catch(_){
          try{ w.location.replace(url); }catch(__){}
        }
        return true;
      }
      return false;
    }

    if(btnSend){
      // Evitar múltiples listeners (doble pestaña)
      if(!btnSend.dataset.nvBound){
        btnSend.dataset.nvBound = "1";
        btnSend.addEventListener("click", (e)=>{
          e.preventDefault();

          // Si no hay evidencia aún, la generamos
          if(box && (!box.value || !box.value.trim())){
            const code = generateEvidence();
            if(box) box.value = code;
            setStudentHUD();
          }

          const evidence = box ? (box.value||"").trim() : "";
          if(!evidence){
            toast("No hay evidencia", "Primero genera tu código NVKP.");
            return;
          }

          const gmailUrl = buildGmailUrlForKP(evidence);
          const opened = openOneGmailTab(gmailUrl);

          toast(
            "Correo listo",
            opened
              ? "Se abrió Gmail en una nueva pestaña. Va para el profesor y con copia (CC) a tu correo. Solo presiona ENVIAR."
              : "Tu navegador bloqueó la pestaña nueva. Activa pop-ups para este sitio e intenta de nuevo."
          );
        });
      }
    }

// Teacher: code + link
    const tClass = document.getElementById("kpTeacherClass");
    const btnNew = document.getElementById("kpNewClass");
    const linkBox = document.getElementById("kpStudentLink");
    const btnCopyLink = document.getElementById("kpCopyLink");

    function makeClassCode(){
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let out="";
      for(let i=0;i<6;i++) out += alphabet[Math.floor(Math.random()*alphabet.length)];
      return out;
    }
    function updateLink(code){
      const base = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, "/") + "conocimientos-previos.html";
      const url = `${base}?class=${encodeURIComponent(code)}`;
      if(linkBox) linkBox.value = url;
      return url;
    }
    if(btnNew){
      btnNew.addEventListener("click", ()=>{
        const typed = (tClass && tClass.value || "").trim();
        const code = typed || makeClassCode();
        if(tClass) tClass.value = code;
        updateLink(code);
        toast("Código de clase", code);
      });
    }
    if(btnCopyLink){
      btnCopyLink.addEventListener("click", ()=>{
        if(!linkBox) return;
        copyText(linkBox.value);
      });
    }

    // Teacher: paste evidences
    const paste = document.getElementById("kpEvidencePaste");
    const btnLoad = document.getElementById("kpLoadEvidence");
    const btnClear = document.getElementById("kpClearEvidence");
    const btnCsv = document.getElementById("kpExportCsv");

    let teacherItems = [];

    
    function extractNameAndCode(rawLine){
      const s = String(rawLine||"").trim();
      if(!s) return {name:"", code:""};
      const m = s.match(/NVKP1\.[A-Za-z0-9\-_]+/i);
      if(m){
        const code = m[0];
        const before = s.slice(0, m.index).trim();
        const after = s.slice((m.index||0) + code.length).trim();
        let name = (before || after || "").trim();
        name = name.replace(/^[\s\-\–\—\|\:\;\,]+/,"").replace(/[\s\-\–\—\|\:\;\,]+$/,"").trim();
        name = name.replace(/^[\"'“”‘’]+|[\"'“”‘’]+$/g,"").trim();
        return {name, code};
      }
      return {name:"", code:s};
    }

    function normKey(s){
      return String(s||"")
        .toLowerCase()
        .trim()
        .replace(/\s+/g," ")
        .replace(/[^\w\u00C0-\u017F ]/g,"");
    }

    function loadFromPaste(){
      const raw = (paste ? paste.value : "");
      const lines = raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

      const parsed = [];
      let invalid = 0;

      const teacherDefaultClass = (tClass && tClass.value || "").trim();

      lines.forEach((line)=>{
        const pair = extractNameAndCode(line);
        const code = pair.code;
        const obj = parseEvidence(code);
        if(!obj){
          invalid++;
          return;
        }

        obj.evidence_code = code;
        obj.raw_line = line;

        const pastedName = (pair.name||"").trim();
        const nameInCode = (obj.name||"").trim();

        obj.name_in_code = nameInCode;
        obj.name_pasted = pastedName;

        if(pastedName){
          obj.name = pastedName; // prioridad al nombre pegado
        }

        if(!obj.class && teacherDefaultClass){
          obj.class = teacherDefaultClass;
        }

        if(!obj.name){
          invalid++;
          return;
        }

        parsed.push(obj);
      });

      // Dedup por (Nombre + Clase): conserva el más reciente
      const best = new Map();
      const counts = new Map();

      parsed.forEach((o)=>{
        const k = `${normKey(o.class)}__${normKey(o.name)}`;
        counts.set(k, (counts.get(k)||0) + 1);

        const prev = best.get(k);
        if(!prev || Number(o.ts||0) > Number(prev.ts||0)){
          best.set(k, o);
        }
      });

      teacherItems = Array.from(best.entries()).map(([k,o])=>{
        o._records = counts.get(k) || 1;
        return o;
      }).sort((a,b)=> (b.ts||0) - (a.ts||0));

      const unique = teacherItems.length;
      const dups = parsed.length - unique;

      renderTeacherTable(teacherItems);

      const info = document.getElementById("kpDupInfo");
      if(info){
        info.classList.remove("hidden");
        info.innerHTML = `
          <div><b>Resumen</b></div>
          <div>Total líneas: <b>${lines.length}</b></div>
          <div>Válidas: <b>${parsed.length}</b></div>
          <div>Únicas (Nombre+Clase): <b>${unique}</b></div>
          <div>Duplicadas eliminadas: <b>${dups}</b></div>
          <div>Inválidas: <b>${invalid}</b></div>
        `;
      }

      toast("Tablero actualizado", `${unique} estudiantes • ${dups} duplicados • ${invalid} inválidas`);
    }

    if(btnLoad){
      btnLoad.addEventListener("click", loadFromPaste);
    }
    if(btnClear){
      btnClear.addEventListener("click", ()=>{
        if(paste) paste.value="";
        teacherItems = [];
        renderTeacherTable([]);
        const info = document.getElementById("kpDupInfo");
        if(info){
          info.classList.add("hidden");
          info.innerHTML = "";
        }
      });
    }
    if(btnCsv){
      btnCsv.addEventListener("click", ()=>{
        exportCsv(teacherItems);
      });
    }

    // Pre-fill link if teacher typed before
    const preset = safeGet("kp_teacher_class_v1") || "";
    if(preset && tClass && !tClass.value){
      tClass.value = preset;
      updateLink(preset);
    }
    if(tClass){
      tClass.addEventListener("input", ()=>{
        const code = (tClass.value||"").trim();
        safeSet("kp_teacher_class_v1", code);
        if(code) updateLink(code);
      });
    }

    // Student info initial
    setStudentHUD();
  }

  // Regular verbs: load JSON and render searchable table
  let __regList = [];
  function renderRegularVerbs(filter){
    const tbody = document.querySelector("#kpRegTable tbody");
    if(!tbody) return;
    const q = String(filter||"").trim().toLowerCase();
    const list = (__regList||[]).filter(x=>{
      if(!q) return true;
      return String(x.v1||"").toLowerCase().includes(q)
        || String(x.v2||"").toLowerCase().includes(q)
        || String(x.v3||"").toLowerCase().includes(q)
        || String(x.es||"").toLowerCase().includes(q);
    });
    tbody.innerHTML = list.map(x=>`
      <tr>
        <td>${x.n}</td>
        <td><b>${escapeHtml(x.v1)}</b></td>
        <td>${escapeHtml(x.v2)}</td>
        <td>${escapeHtml(x.v3)}</td>
        <td>${escapeHtml(x.es)}</td>
      </tr>
    `).join("");
  }

  async function loadRegularVerbs(){
    // Prefer inline JSON (works even when fetch is blocked)
    try{
      const inline = document.getElementById("kpRegData");
      if(inline && (inline.textContent||"").trim().length){
        __regList = JSON.parse(inline.textContent);
        renderRegularVerbs("");
      }else{
        const r = await fetch("assets/kp_regular_verbs.json", {cache:"force-cache"});
        if(!r.ok) throw new Error("HTTP "+r.status);
        __regList = await r.json();
        renderRegularVerbs("");
      }
    }catch(_){
      // no-op
    }
    const inp = document.getElementById("kpRegSearch");
    const btn = document.getElementById("kpRegClear");
    if(inp && !inp.dataset.bound){
      inp.dataset.bound="1";
      inp.addEventListener("input", ()=>renderRegularVerbs(inp.value||""));
    }
    if(btn && !btn.dataset.bound){
      btn.dataset.bound="1";
      btn.addEventListener("click", ()=>{
        if(inp) inp.value="";
        renderRegularVerbs("");
        if(inp) inp.focus();
      });
    }
  }

  function checkChecklist(id){
    if(id !== "roadmap_check") return;
    const already = isDone(id);
    const box = document.getElementById("chk_roadmap_check");
    if(!box){
      setResult(id, `<span style="color:var(--error)">No se encontró el checklist.</span>`);
      return;
    }
    const checked = Array.from(box.querySelectorAll("input[type='checkbox']")).filter(x=>x.checked).length;
    if(checked < 4){
      setResult(id, `<span style="color:var(--error)">Te faltan ${4-checked} casillas para completar.</span>`);
      return;
    }
    if(!already){
      const amount = 20;
      awardXP(amount, "Checklist completado");
      markDone(id, {checked, xp:amount});
      setResult(id, `<span style="color:var(--success)">✅ Checklist completado • Premio: +${amount} XP</span>`);
    }else{
      setResult(id, `<span style="color:var(--success)">✅ Checklist ya reclamado.</span>`);
    }
    setStudentHUD();
  }

  function checkWriting(id){
    if(id !== "writing_challenge") return;
    const already = isDone(id);
    const ta = document.getElementById("txt_writing_challenge");
    const txt = (ta ? ta.value : "").trim();
    const minLen = 120;
    const linking = ["and","but","because","so","then","however","therefore","also","moreover","besides","although","while","when","after","before","first","next","finally"];
    const low = txt.toLowerCase();
    const used = linking.filter(w=> new RegExp(`\\b${w}\\b`,"i").test(low));
    const distinct = Array.from(new Set(used));
    const sentenceCount = txt.split(/[.!?]+/).map(s=>s.trim()).filter(Boolean).length;
    if(txt.length < minLen){
      setResult(id, `<span style="color:var(--error)">Necesitas mínimo ${minLen} caracteres.</span>`);
      return;
    }
    if(sentenceCount < 3){
      setResult(id, `<span style="color:var(--error)">Escribe al menos 3 oraciones (separadas por punto).</span>`);
      return;
    }
    if(distinct.length < 2){
      setResult(id, `<span style="color:var(--error)">Usa al menos 2 conectores (and, but, because, so, then...).</span>`);
      return;
    }
    if(!already){
      const amount = 60;
      awardXP(amount, "Mini Writing completado");
      markDone(id, {sentences:sentenceCount, linking:distinct, xp:amount});
      setResult(id, `<span style="color:var(--success)">✅ ¡Muy bien! Conectores usados: <b>${escapeHtml(distinct.join(", "))}</b> • Premio: +${amount} XP</span>`);
    }else{
      setResult(id, `<span style="color:var(--success)">✅ Actividad ya reclamada.</span>`);
    }
    setStudentHUD();
  }

// =========================
  // EVENTS
  // =========================
  function bind(){
    document.addEventListener("click", (e)=>{
      const btn = e.target && e.target.closest && e.target.closest("[data-action]");
      if(!btn) return;
      const action = btn.getAttribute("data-action");
      const target = btn.getAttribute("data-target");
      if(!action || !target) return;

      if(action === "start") startQuiz(target);
      if(action === "check") checkQuiz(target);
      if(action === "checklist") checkChecklist(target);
      if(action === "checkwriting") checkWriting(target);
    });
  }

  
  function setupAccordionNav(){
    // Solo cierra entre secciones principales (1-4)
    const mainAccs = Array.from(document.querySelectorAll("details.kpMainAcc"));

    const sectionNavBtns = Array.from(document.querySelectorAll(".kpSecBtn"));

    // Scroll con offset: evita que el encabezado fijo tape el inicio de la sección/actividad
    function hudSafePx(){
      const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hudSafe")) || 0;
      return Number.isFinite(v) ? v : 0;
    }
    function smartScrollTo(node){
      if(!node) return;
      // Recalcula por si cambió el alto del dock al abrir/cerrar
      if(typeof syncHudSafe === "function"){ try{ syncHudSafe(); }catch(_){ } }
      const safe = hudSafePx() || 0;
      const rect = node.getBoundingClientRect();
      const y = rect.top + window.scrollY - (safe + 18);
      window.scrollTo({top: Math.max(0, y), behavior: "smooth"});
    }

    function setActiveSection(mainId){
      const hintEl = document.getElementById("kpSectionHint");
      sectionNavBtns.forEach(btn=>{
        const href = (btn.getAttribute("href")||"").trim();
        const id = href.startsWith("#") ? href.slice(1) : href;
        const isActive = (id === mainId);
        btn.classList.toggle("isActive", isActive);
        btn.classList.toggle("active", isActive); // ✅ igual a neuroverbs.html (Round 1/2)
        if(isActive) btn.setAttribute("aria-current","true");
        else btn.removeAttribute("aria-current");
      });

      // ✅ Hint tipo index: muestra meta del acordeón activo
      if(hintEl){
        if(!mainId){
          hintEl.textContent = "Selecciona una sección para comenzar.";
        }else{
          const d = document.getElementById(mainId);
          const t = d?.querySelector("summary .kpAccTitle")?.textContent?.trim() || mainId;
          const meta = d?.querySelector("summary .kpAccMeta")?.textContent?.trim() || "";
          hintEl.textContent = meta ? `${t}: ${meta}` : t;
        }
      }
    }


    function syncBottomTabs(hash){
      const tabs = document.getElementById("kpBottomTabs");
      if(!tabs) return;
      const btns = Array.from(tabs.querySelectorAll(".kpTabBtn"));
      btns.forEach(b=>{
        const h = (b.getAttribute("data-jump")||"").trim();
        b.classList.toggle("isActive", h===hash);
      });
    }

    function closeOthers(current){
      mainAccs.forEach(d=>{ if(d!==current) d.open = false; });
    }

    function openDetailsChain(detailsEl){
      // Abre el acordeón objetivo y también sus padres (por ejemplo #extras)
      const chain = [];
      let cur = detailsEl;
      while(cur){
        if(cur.tagName === "DETAILS") chain.push(cur);
        cur = cur.parentElement;
      }
      chain.reverse().forEach(d=>{
        d.open = true;
        if(d.classList && d.classList.contains("kpMainAcc")){
          closeOthers(d);
        }
      });
    }

    function openSection(sectionId, activityId){
      setActiveSection(sectionId);
      syncBottomTabs("#"+sectionId);
      const el = document.getElementById(sectionId);
      if(!el) return;

      const detailsEl = (el.tagName === "DETAILS") ? el : el.closest("details");
      if(detailsEl){
        openDetailsChain(detailsEl);
      }

      // Si buscan actividad dentro de la sección, baja directo
      let target = null;
      if(activityId){
        const scope = detailsEl || el;
        target = scope.querySelector(`[data-activity="${activityId}"]`);
      }

      setTimeout(()=>{
        smartScrollTo(target || el);
      }, 60);
    }

    // Cierra otras secciones principales cuando una se abre + sincroniza activo
    mainAccs.forEach(d=>{
      d.addEventListener("toggle", ()=>{
        if(d.open){
          closeOthers(d);
          setActiveSection(d.id);
          syncBottomTabs("#"+d.id);
        }
      });
    });

    // Botones que abren secciones
    document.querySelectorAll("[data-open]").forEach(btn=>{
      btn.addEventListener("click", (ev)=>{
        ev.preventDefault();
        openSection(btn.getAttribute("data-open"), btn.getAttribute("data-open-activity"));
      });
    });

    // Botones 1-4 tipo "tabs": abre la sección y cierra las otras sin salto brusco
    sectionNavBtns.forEach(btn=>{
      btn.addEventListener("click", (ev)=>{
        const href = (btn.getAttribute("href")||"").trim();
        if(!href.startsWith("#")) return;
        ev.preventDefault();
        const id = href.slice(1);
        // Actualiza la URL sin disparar hashchange (evita doble scroll)
        try{ history.replaceState(null, "", "#"+id); }catch(_){ location.hash = id; }
        openSection(id);
      });
    });


    // Abre por hash (links)
    function openFromHash(){
      const id = (location.hash || "").replace("#","").trim();
      if(!id) return;
      const el = document.getElementById(id);
      if(!el) return;

      // Resalta la pestaña principal (1-4) cuando el hash apunta a un elemento interno
      const main = (el.tagName === "DETAILS" && el.classList.contains("kpMainAcc")) ? el : el.closest("details.kpMainAcc");
      if(main && main.id) setActiveSection(main.id);
      else setActiveSection("");

      const detailsEl = (el.tagName === "DETAILS") ? el : el.closest("details");
      if(detailsEl){
        openDetailsChain(detailsEl);
      }

      setTimeout(()=> smartScrollTo(el), 50);
    }
    window.addEventListener("hashchange", openFromHash, {passive:true});
    openFromHash();

    // Activo automático por scroll: resalta el botón 1-4 y el tab móvil según la sección visible
    (function(){
      const watch = Array.from(document.querySelectorAll("details.kpMainAcc")).filter(d=>d.id);
      if(!watch.length) return;
      let lastId = "";
      function pick(){
        if(typeof syncHudSafe === "function"){ try{ syncHudSafe(); }catch(_){ } }
        const safe = hudSafePx() || 0;
        const posY = (window.scrollY || 0) + safe + 24;
        let current = watch[0].id;
        for(const el of watch){
          const top = el.getBoundingClientRect().top + (window.scrollY || 0);
          if(top <= posY) current = el.id;
        }
        if(current !== lastId){
          lastId = current;
          setActiveSection(current);
          syncBottomTabs("#"+current);
        }
      }
      const onScroll = ()=>{ window.requestAnimationFrame(pick); };
      window.addEventListener("scroll", onScroll, {passive:true});
      window.addEventListener("resize", onScroll, {passive:true});
      setTimeout(pick, 60);
    })();

    // Exponer helper por si otra parte lo necesita
    window.NVKP_openSection = openSection;
  }


  function setupBottomTabs(){
    // Inicializa una sola vez (esta función se invoca en resize, así que usamos un guard)
    if(window.__NVKP_bottomTabsInit) return;
    window.__NVKP_bottomTabsInit = true;

    const tabs = document.getElementById("kpBottomTabs");
    if(!tabs) return;
    const btns = Array.from(tabs.querySelectorAll(".kpTabBtn"));

    function setActive(hash){
      btns.forEach(b=>{
        const h = (b.getAttribute("data-jump")||"").trim();
        b.classList.toggle("isActive", h===hash);
      });
    }

    function openAndScroll(hash){
      const id = (hash||"").replace("#","");
      if(!id) return;

      // Usa la misma navegación del header (mantiene acordeones y botones sincronizados)
      if(typeof window.NVKP_openSection === "function"){
        window.NVKP_openSection(id);
        setActive("#"+id);
        return;
      }

      // Fallback simple
      const target = document.getElementById(id);
      if(!target) return;
      const safe = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hudSafe")) || 0);
      const y = target.getBoundingClientRect().top + window.scrollY - (safe + 12);
      window.scrollTo({ top: Math.max(0,y), behavior: "smooth" });
      setActive("#"+id);
    }

    btns.forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const hash = btn.getAttribute("data-jump");
        if(hash) openAndScroll(hash);
      });
    });

    // Estado inicial
    if(location.hash && btns.some(b=>(b.getAttribute("data-jump")||"")===location.hash)){
      setActive(location.hash);
    }else{
      setActive("#pronombres");
    }
  }

function init(){
    kickHUD();
    initStatsCarousel();
    initDockCompactMode();
    window.addEventListener("resize", (typeof _onResize==="function"?_onResize:syncHudSafe), {passive:true});
    renderRoadmap();
    renderThreeCols();
    renderTensesTables();
    renderLinkingTables();
    updateHUD();
    updateBadges();
    bind();


    setupAccordionNav();
    setupBottomTabs();
    // Propuesta A + B
    setupTabs();
    setupClassMode();
    loadRegularVerbs();
    setStudentHUD();
  }

  
  // Boot
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  }else{
    init();
  }

})();


// =========================
// NVKP_TTS_PRONOUNS (EN)
// =========================
(function(){
  const SPEAK_BTN_CLASS = "kpSpeakBtn";
  const SPEAK_COL_CLASS = "kpSpeakCol";
  let enVoice = null;

  function safeToast(msg){
    try{
      if(typeof toast === "function") toast(msg);
    }catch(_){}
  }

  function pickEnglishVoice(){
    try{
      const vs = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      enVoice = vs.find(v => /en(-|_)?US/i.test(v.lang)) ||
                vs.find(v => /^en/i.test(v.lang)) ||
                null;
    }catch(_){ enVoice = null; }
  }

  function speakEN(text){
    let t = String(text||"").replace(/\s+/g," ").trim();
    if(!t) return;

    // Fix for "I" -> should sound like "eye"
    const speakText = (/^i$/i.test(t)) ? "eye" : t;

    if(!window.speechSynthesis || !window.SpeechSynthesisUtterance){
      safeToast("Audio no disponible en este navegador.");
      return;
    }

    try{ pickEnglishVoice(); }catch(_){}
    try{ window.speechSynthesis.cancel(); }catch(_){}

    const u = new SpeechSynthesisUtterance(speakText);
    u.lang = "en-US";
    if(enVoice) u.voice = enVoice;
    u.rate = 1;
    u.pitch = 1;

    try{ window.speechSynthesis.speak(u); }catch(_){}
  }

  function addAudioToPronounsTable(){
    // Only target the 2-column pronouns table: headers Español + English
    const tables = Array.from(document.querySelectorAll("table.kpTable"));
    tables.forEach(table=>{
      if(table.dataset.kpAudio === "1") return;

      const ths = Array.from(table.querySelectorAll("thead th")).map(th=>th.textContent.trim().toLowerCase());
      if(ths.length < 2) return;
      const isPronouns2Col = ths[0] === "español" && ths[1] === "english";
      if(!isPronouns2Col) return;

      // Ensure header has audio column
      const headRow = table.querySelector("thead tr");
      if(headRow && headRow.children.length === 2){
        const th = document.createElement("th");
        th.className = SPEAK_COL_CLASS;
        th.setAttribute("aria-label","Audio");
        th.textContent = "";
        headRow.appendChild(th);
      }

      const rows = Array.from(table.querySelectorAll("tbody tr"));
      rows.forEach(r=>{
        const tds = r.querySelectorAll("td");
        if(tds.length < 2) return;
        const englishCell = tds[1];
        const englishText = (englishCell.textContent || "").replace(/\s+/g," ").trim();
        if(!englishText) return;

        // Ensure 3rd cell for button
        let audioTd = (tds.length >= 3) ? tds[2] : null;
        if(!audioTd){
          audioTd = document.createElement("td");
          r.appendChild(audioTd);
        }
        audioTd.className = SPEAK_COL_CLASS;

        // Prevent duplicates
        if(audioTd.querySelector("button."+SPEAK_BTN_CLASS)) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = SPEAK_BTN_CLASS;
        btn.setAttribute("aria-label", "Escuchar pronunciación");
        btn.innerHTML = "🔊";
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          e.stopPropagation();
          speakEN(englishText);
        });
        audioTd.appendChild(btn);
      });

      table.dataset.kpAudio = "1";
    });
  }

  function init(){
    if(!window.speechSynthesis) return;

    // In Chrome, voices load async
    try{
      window.speechSynthesis.onvoiceschanged = () => { try{ pickEnglishVoice(); }catch(_){ } };
      pickEnglishVoice();
    }catch(_){}

    addAudioToPronounsTable();
    // In case content is injected later
    setTimeout(addAudioToPronounsTable, 500);
    setTimeout(addAudioToPronounsTable, 1500);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, { once:true });
  }else{
    init();
  }
})();


// =========================
// NVKP_TTS_TABLES_GENERIC (EN)
// Adds audio buttons to English columns in KP tables (verbs examples, tenses, V1/V2/V3, etc.)
// =========================
(function(){
  const BTN_CLASS = "kpSpeakBtn";
  const CELL_CLASS = "kpCellAudio";
  let enVoice = null;

  function normalize(s){
    return String(s||"")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,""); // remove accents
  }

  function pickEnglishVoice(){
    try{
      const vs = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      enVoice = vs.find(v => /en(-|_)?us/i.test(v.lang)) ||
                vs.find(v => /^en/i.test(v.lang)) ||
                null;
    }catch(_){ enVoice = null; }
  }

  function cleanSpeakText(t){
    let s = String(t||"").replace(/\s+/g," ").trim();
    // remove warning / emoji symbols that confuse speech
    s = s.replace(/[⚠️🚫✅❌🔊🎧📌📍⭐️⭐✳️]/g,"").trim();
    // remove trailing markers like * or punctuation-only
    s = s.replace(/\*+$/g,"").trim();
    // special-case "I"
    if(/^i$/i.test(s)) return "eye";
    return s;
  }

  function speakEN(text){
    const speakText = cleanSpeakText(text);
    if(!speakText) return;

    if(!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

    try{ pickEnglishVoice(); }catch(_){}
    try{ window.speechSynthesis.cancel(); }catch(_){}

    const u = new SpeechSynthesisUtterance(speakText);
    u.lang = "en-US";
    if(enVoice) u.voice = enVoice;
    u.rate = 1;
    u.pitch = 1;
    try{ window.speechSynthesis.speak(u); }catch(_){}
  }

    function shouldAudioForHeader(h){
    const x = normalize(h);
    if(!x) return false;

    // Explicit Spanish headers -> no audio
    const stop = ["traduccion","espanol","tipo","usuario","presente","pasado","futuro"];
    if(stop.some(s => x.includes(s))) return false;

    // Utility: whole-word match (prevents 'presente' matching 'present')
    function hasWord(w){
      const ww = normalize(w).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      const re = new RegExp("(^|[^a-z])"+ww+"([^a-z]|$)","i");
      return re.test(x);
    }

    // Strong English indicators / verb columns
    if(x.includes("verbo (ingles)") || x.includes("verb (english)")) return true;
    if(hasWord("english") || hasWord("ingles")) return true;

    // v1/v2/v3 columns
    const compact = x.replace(/\s+/g,"");
    if(/^v[123]$/.test(compact)) return true;

    // Present/Past/Future in English only (word boundary)
    if(hasWord("present") || hasWord("past") || hasWord("future")) return true;

    // 3rd person column
    if(x.includes("3a persona") || x.includes("tercera persona") || x.includes("he/she/it")) return true;

    // NOTE: "subject" excluded on purpose (pronoun-only lists)
    return false;
  }

  function addBtnToCell(cell, displayText, speakText){
    if(!cell) return;
    if(cell.querySelector("button."+BTN_CLASS)) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.setAttribute("aria-label","Escuchar pronunciación");
    btn.title = "Listen (EN)";
    btn.innerHTML = "🔊";
    const toSpeak = (speakText != null ? speakText : displayText);
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      speakEN(toSpeak);
    });

    cell.classList.add(CELL_CLASS);
    cell.appendChild(btn);
  }

  function processTable(table){
    if(!table || table.dataset.kpAudioGen === "1") return;

    const thead = table.querySelector("thead");
    const headRow = thead ? thead.querySelector("tr") : null;
    const ths = headRow ? Array.from(headRow.querySelectorAll("th")) : [];
    const headers = ths.map(th => (th.textContent || "").trim());
    const headersN = headers.map(h => normalize(h));

    if(headers.length === 0) return;

    // identify special columns
    const subjIdx = headersN.findIndex(h => h === "subject");
    const transIdx = headersN.findIndex(h => h.includes("traduccion"));
    const ejemploIdx = headersN.findIndex(h => h === "ejemplo");

    // base audio columns by header heuristics
    const audioCols = [];
    headers.forEach((h, idx)=>{
      if(shouldAudioForHeader(h)) audioCols.push(idx);
    });

    // Special case: Spanish header "Ejemplo" usually contains the English phrase (e.g., "I work")
    if(ejemploIdx >= 0 && subjIdx >= 0 && transIdx >= 0 && !audioCols.includes(ejemploIdx)){
      audioCols.push(ejemploIdx);
    }

    // Special case: conjugation tables with Subject + (Present/Past/Future)
    const tenseCols = [];
    headersN.forEach((h, idx)=>{
      if(h === "present" || h === "past" || h === "future" || h === "present perfect") tenseCols.push(idx);
    });

    // If we have subject+tense, we ensure tense cols are included, and we speak "Subject + cell"
    if(subjIdx >= 0 && tenseCols.length){
      tenseCols.forEach(ci=>{
        if(!audioCols.includes(ci)) audioCols.push(ci);
      });
    }

    if(audioCols.length === 0) return;

    const rows = Array.from(table.querySelectorAll("tbody tr"));
    rows.forEach(r=>{
      const cells = Array.from(r.querySelectorAll("td"));
      if(!cells.length) return;

      const subjectVal = (subjIdx >= 0 && cells[subjIdx]) 
        ? (cells[subjIdx].textContent || "").replace(/\s+/g," ").trim()
        : "";

      audioCols.forEach(ci=>{
        const cell = cells[ci];
        if(!cell) return;

        const raw = (cell.textContent || "").replace(/\s+/g," ").trim();
        if(!raw) return;

        // For tense tables: speak "Subject + tense"
        if(subjIdx >= 0 && subjectVal && (headersN[ci] === "present" || headersN[ci] === "past" || headersN[ci] === "future" || headersN[ci] === "present perfect")){
          const combined = `${subjectVal} ${raw}`.replace(/\s+/g," ").trim();
          addBtnToCell(cell, raw, combined);
          return;
        }

        // For example tables: cell already contains the full English phrase (e.g., "I work")
        if(ejemploIdx === ci){
          addBtnToCell(cell, raw, raw);
          return;
        }

        // Default: speak cell text as-is
        addBtnToCell(cell, raw, raw);
      });
    });

    table.dataset.kpAudioGen = "1";
  }

  function run(){
    if(!window.speechSynthesis) return;

    // voices async on Chrome
    try{
      window.speechSynthesis.onvoiceschanged = () => { try{ pickEnglishVoice(); }catch(_){ } };
      pickEnglishVoice();
    }catch(_){}

    const tables = Array.from(document.querySelectorAll("table.kpTable"));
    tables.forEach(processTable);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run, { once:true });
  }else{
    run();
  }
  // in case content loads later
  setTimeout(run, 600);
  setTimeout(run, 1400);
})();
