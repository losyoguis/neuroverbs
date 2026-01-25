# Cloudflare Worker (NeuroVerbs API)

Este folder incluye un `worker.js` listo para pegar en Cloudflare.

## 1) Crear Worker
Cloudflare Dashboard → **Workers & Pages** → **Create** → Worker.

## 2) Pegar el código
En tu Worker → **Edit code** → pega el contenido de `worker.js`.

## 3) Agregar el secret
Worker → **Settings** → **Variables and Secrets** → **Add**:
- Type: **Secret**
- Name: **OPENAI_API_KEY**
- Value: tu API Key de OpenAI

## 4) CORS
En `worker.js`, edita `allowedOrigins` y agrega el dominio desde donde vas a consumir el API (GitHub Pages, tu hosting, etc.).

## 5) Probar con cURL
```bash
curl -X POST "https://TU-WORKER.workers.dev/generate"   -H "Content-Type: application/json"   -d '{"topic":"irregular verbs","level":"medio"}'
```

Si ves `{"error":"POST requerido"}` en el navegador, es normal: el endpoint solo acepta POST.

## 6) Conectar con el Front
El front (Teacher Yoguis) usa:
- `/generate` para generar lectura + quiz
- `/vocab` para traducción + significado + ejemplos (modal de vocabulario)

Por defecto el front apunta a:
`https://neuroverbs-api.yoguisindevoz.workers.dev`

Puedes cambiarlo así (en consola del navegador):
```js
localStorage.setItem('NEUROVERBS_API_BASE','https://TU-WORKER.workers.dev');
location.reload();
```
