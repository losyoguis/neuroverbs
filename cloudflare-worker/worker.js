// Cloudflare Worker — NeuroVerbs API (generate + vocab + chat)
// 1) En Cloudflare -> Workers & Pages -> tu Worker -> Settings -> Variables & Secrets
//    Agrega el secret: OPENAI_API_KEY
// 2) Ajusta allowedOrigins según tu dominio (GitHub Pages, tu hosting, etc.)

const allowedOrigins = new Set([
  "https://losyoguis.github.io",
  "https://losyoguis.netlify.app",
  "https://teacherpoli.com",
  "https://www.teacherpoli.com",
  // agrega aquí tu dominio si lo necesitas:
  // "https://tudominio.com",
]);

function corsHeaders(origin){
  const h = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if(origin && allowedOrigins.has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(data, status=200, corsH={}){
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsH }
  });
}

async function readJson(request){
  try { return await request.json(); } catch { return null; }
}

async function callOpenAI(payload, apiKey){
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const raw = await res.text();
  let out;
  try{ out = JSON.parse(raw); } catch { out = { raw }; }
  // text output helper (Responses API)
  const outputText = out?.output?.[0]?.content?.[0]?.text ?? out?.output_text ?? "";
  return { ok: res.ok, status: res.status, raw: out, outputText };
}

function safeText(s){ return String(s||"").trim(); }

function makeGeneratePrompt(topic, level){
  // Nivel: facil / medio / dificil
  const rules = [
    "Devuelve SOLO JSON válido. Sin texto fuera del JSON.",
    "El texto debe ser IMPORTANTE y ENTRETENIDO: incluye 1-2 datos curiosos o ejemplos cercanos.",
    "Usa inglés claro. Evita información falsa o inventada: si no estás seguro, dilo con cuidado.",
  ];
  const cfg = {
    facil:  { paragraphs: 2, quiz: 5 },
    medio:  { paragraphs: 4, quiz: 5 },
    dificil:{ paragraphs: 6, quiz: 5 },
  }[level] || { paragraphs: 4, quiz: 5 };

  return {
    cfg,
    rules,
    user: {
      topic,
      level,
      required_json_schema: {
        title: "string",
        level: "facil|medio|dificil",
        paragraphs: "array of strings (length = cfg.paragraphs)",
        keywords: "array of strings (5-10)",
        quiz: "array of {q, options[4], answerIndex} length cfg.quiz",
      }
    }
  };
}

async function handleGenerate(request, env, corsH){
  const body = await readJson(request) || {};
  const topic = safeText(body.topic);
  const level = safeText(body.level) || "medio";
  if(!topic) return json({error:"topic requerido"}, 400, corsH);

  const { cfg, rules, user } = makeGeneratePrompt(topic, level);

  const payload = {
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: "Eres profesor. Devuelve SOLO JSON válido." },
      { role: "user", content: JSON.stringify({
          ...user,
          rules: rules.concat([
            `Párrafos exactamente: ${cfg.paragraphs}.`,
            `Quiz exactamente: ${cfg.quiz} preguntas.`,
          ])
      })}
    ]
  };

  const res = await callOpenAI(payload, env.OPENAI_API_KEY);
  if(!res.ok) return json({error:"OpenAI error", details: res.raw}, res.status, corsH);

  try{
    const parsed = JSON.parse(res.outputText);
    return json(parsed, 200, corsH);
  }catch{
    return json({error:"Salida no es JSON", raw: res.outputText}, 502, corsH);
  }
}

async function handleVocab(request, env, corsH){
  const body = await readJson(request) || {};
  const term = safeText(body.term);
  const context = safeText(body.context);
  if(!term) return json({error:"term requerido"}, 400, corsH);

  const payload = {
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: "Eres profesor. TODO en español. Devuelve SOLO JSON válido." },
      { role: "user", content: JSON.stringify({
          term,
          context,
          rules: [
            "Traducción (1 línea).",
            "Significado en español (corto y claro).",
            "3 ejemplos en inglés + traducción al español.",
            "Devuelve SOLO JSON: {term, traduccion, significado, ejemplos:[{en,es}]}"
          ]
      })}
    ]
  };

  const res = await callOpenAI(payload, env.OPENAI_API_KEY);
  if(!res.ok) return json({error:"OpenAI error", details: res.raw}, res.status, corsH);

  try{
    const parsed = JSON.parse(res.outputText);
    return json(parsed, 200, corsH);
  }catch{
    return json({error:"Salida no es JSON", raw: res.outputText}, 502, corsH);
  }
}

async function handleChat(request, env, corsH){
  const body = await readJson(request) || {};
  const mode = safeText(body.mode) || "writing"; // writing | speaking | roleplay
  const level = safeText(body.level) || "medio";
  const msgs = Array.isArray(body.messages) ? body.messages : [];

  const system = {
    writing:  "Eres tutor de escritura en inglés. Responde con feedback claro y breve.",
    speaking: "Eres tutor de speaking en inglés. Haz preguntas cortas y corrige suavemente.",
    roleplay: "Eres un personaje para roleplay en inglés. Mantén la conversación viva.",
  }[mode] || "Eres tutor de inglés.";

  const payload = {
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: system + ` Nivel: ${level}.` },
      ...msgs.map(m=>({ role: m.role==="assistant"?"assistant":"user", content: String(m.content||"") }))
    ]
  };

  const res = await callOpenAI(payload, env.OPENAI_API_KEY);
  if(!res.ok) return json({error:"OpenAI error", details: res.raw}, res.status, corsH);

  return json({reply: res.outputText}, 200, corsH);
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const corsH = corsHeaders(origin);

    if(request.method === "OPTIONS"){
      return new Response(null, { status: 204, headers: corsH });
    }

    // Evita ruido del navegador
    if(request.method === "GET" && (url.pathname === "/" || url.pathname === "/favicon.ico")){
      return new Response("OK", { status: 200, headers: { "Content-Type":"text/plain; charset=utf-8", ...corsH } });
    }

    if(request.method !== "POST"){
      return json({error:"POST requerido"}, 405, corsH);
    }

    if(origin && !allowedOrigins.has(origin)){
      // Si quieres permitir file:// o pruebas sin Origin, deja el if(origin && ...) como está.
      return json({error:"Origen no permitido", origin}, 403, corsH);
    }

    if(url.pathname === "/generate") return await handleGenerate(request, env, corsH);
    if(url.pathname === "/vocab")    return await handleVocab(request, env, corsH);
    if(url.pathname === "/chat")     return await handleChat(request, env, corsH);

    return json({error:"Ruta no encontrada"}, 404, corsH);
  }
};
