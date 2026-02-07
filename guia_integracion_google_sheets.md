# Guía Completa: Integración Frontend NEUROVERBS con Google Sheets

Esta guía te mostrará paso a paso cómo conectar el sistema de puntuación del frontend con una base de datos en Google Sheets usando Google Apps Script.

---

## 📋 TABLA DE CONTENIDOS

1. [Configuración de Google Sheets](#1-configuración-de-google-sheets)
2. [Creación del Apps Script (Backend)](#2-creación-del-apps-script-backend)
3. [Publicación del Web App](#3-publicación-del-web-app)
4. [Actualización del Frontend](#4-actualización-del-frontend)
5. [Testing y Troubleshooting](#5-testing-y-troubleshooting)

---

## 1. CONFIGURACIÓN DE GOOGLE SHEETS

### Paso 1.1: Crear la Hoja de Cálculo

1. Ve a [Google Sheets](https://sheets.google.com)
2. Crea una nueva hoja llamada **"NEUROVERBS_DB"**
3. Renombra la primera pestaña a **"Users"**

### Paso 1.2: Configurar las Columnas

En la pestaña **"Users"**, crea los siguientes encabezados en la **fila 1**:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| sub | name | email | picture | xp | level | streak | hearts | freeze | last_login |

**Descripción de columnas:**
- **sub**: ID único de Google (del JWT)
- **name**: Nombre del usuario
- **email**: Correo electrónico
- **picture**: URL de foto de perfil
- **xp**: Puntos acumulados
- **level**: Nivel calculado
- **streak**: Racha de días consecutivos
- **hearts**: Vidas disponibles
- **freeze**: Tokens de protección de racha
- **last_login**: Última vez que se conectó (timestamp)

### Paso 1.3: Obtener el ID de la Hoja

1. Abre tu hoja de cálculo
2. Mira la URL: `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit`
3. Copia el ID (lo necesitarás en el siguiente paso)

---

## 2. CREACIÓN DEL APPS SCRIPT (BACKEND)

### Paso 2.1: Abrir el Editor de Script

1. En tu hoja de Google Sheets, ve a **Extensiones → Apps Script**
2. Se abrirá el editor de código
3. Borra el código de ejemplo que viene por defecto

### Paso 2.2: Pegar el Código del Backend

Copia y pega el siguiente código:

```javascript
// =====================================================
// NEUROVERBS - Google Apps Script Backend
// Conecta el frontend con Google Sheets
// =====================================================

const SHEET_ID = "PEGA_AQUI_EL_ID_DE_TU_HOJA"; // ← IMPORTANTE: Cambia esto
const USERS_SHEET_NAME = "Users";

// Configuración
const ALLOWED_DOMAIN = "iemanueljbetancur.edu.co";
const ALLOW_GET_UPSERT = true; // Permite JSONP para evitar CORS

// =====================================================
// FUNCIÓN PRINCIPAL: doGet (para JSONP)
// =====================================================
function doGet(e) {
  try {
    const callback = e.parameter.callback || "callback";
    const action = e.parameter.action || "";
    
    let result = { ok: false, error: "Unknown action" };
    
    switch(action) {
      case "debug":
        result = handleDebug();
        break;
        
      case "upsert":
        if (ALLOW_GET_UPSERT) {
          result = handleUpsert(e.parameter);
        } else {
          result = { ok: false, error: "Use POST for upsert" };
        }
        break;
        
      case "user":
        result = handleGetUser(e.parameter);
        break;
        
      case "leaderboard":
        result = handleLeaderboard(e.parameter);
        break;
        
      default:
        result = { ok: false, error: "Invalid action: " + action };
    }
    
    // Respuesta JSONP
    const json = JSON.stringify(result);
    return ContentService
      .createTextOutput(callback + "(" + json + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
      
  } catch (error) {
    const errorResponse = { ok: false, error: error.toString() };
    const callback = (e && e.parameter && e.parameter.callback) || "callback";
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(errorResponse) + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

// =====================================================
// FUNCIÓN PRINCIPAL: doPost (para POST requests)
// =====================================================
function doPost(e) {
  try {
    let params = {};
    
    // Parsear el body (puede ser JSON o form-data)
    if (e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch(err) {
        // Si no es JSON, intentar parsear como text/plain
        const raw = e.postData.contents;
        const obj = JSON.parse(raw);
        params = obj;
      }
    }
    
    const action = params.action || e.parameter?.action || "";
    let result = { ok: false, error: "Unknown action" };
    
    switch(action) {
      case "upsert":
        result = handleUpsert(params);
        break;
        
      default:
        result = { ok: false, error: "Invalid action: " + action };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =====================================================
// HANDLERS
// =====================================================

function handleDebug() {
  return {
    ok: true,
    message: "NEUROVERBS Backend funcionando correctamente",
    timestamp: new Date().toISOString(),
    sheetId: SHEET_ID,
    allowedDomain: ALLOWED_DOMAIN
  };
}

function handleUpsert(params) {
  try {
    const idToken = params.idToken;
    const xpDelta = parseInt(params.xpDelta || 0, 10);
    
    if (!idToken) {
      return { ok: false, error: "Missing idToken" };
    }
    
    // Decodificar el JWT
    const payload = decodeJWT(idToken);
    if (!payload) {
      return { ok: false, error: "Invalid token" };
    }
    
    // Validar dominio
    const email = (payload.email || "").toLowerCase();
    if (!email.endsWith("@" + ALLOWED_DOMAIN)) {
      return { ok: false, error: "Unauthorized domain" };
    }
    
    // Obtener o crear usuario
    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const subIndex = headers.indexOf("sub");
    const emailIndex = headers.indexOf("email");
    const nameIndex = headers.indexOf("name");
    const pictureIndex = headers.indexOf("picture");
    const xpIndex = headers.indexOf("xp");
    const levelIndex = headers.indexOf("level");
    const lastLoginIndex = headers.indexOf("last_login");
    
    // Buscar usuario existente
    let userRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][subIndex] === payload.sub) {
        userRow = i;
        break;
      }
    }
    
    const now = new Date().toISOString();
    let currentXP = 0;
    
    if (userRow === -1) {
      // Usuario nuevo - crear fila
      const newRow = [
        payload.sub,                    // sub
        payload.name || "Usuario",      // name
        email,                          // email
        payload.picture || "",          // picture
        xpDelta,                        // xp
        calculateLevel(xpDelta),        // level
        0,                              // streak
        5,                              // hearts
        0,                              // freeze
        now                             // last_login
      ];
      sheet.appendRow(newRow);
      currentXP = xpDelta;
      
    } else {
      // Usuario existente - actualizar
      currentXP = parseInt(data[userRow][xpIndex] || 0, 10);
      currentXP += xpDelta;
      
      // Actualizar valores
      sheet.getRange(userRow + 1, xpIndex + 1).setValue(currentXP);
      sheet.getRange(userRow + 1, levelIndex + 1).setValue(calculateLevel(currentXP));
      sheet.getRange(userRow + 1, lastLoginIndex + 1).setValue(now);
      
      // Actualizar nombre/foto si cambiaron
      if (payload.name) {
        sheet.getRange(userRow + 1, nameIndex + 1).setValue(payload.name);
      }
      if (payload.picture) {
        sheet.getRange(userRow + 1, pictureIndex + 1).setValue(payload.picture);
      }
    }
    
    return {
      ok: true,
      user: {
        sub: payload.sub,
        name: payload.name,
        email: email,
        xp: currentXP,
        level: calculateLevel(currentXP),
        xpDelta: xpDelta
      }
    };
    
  } catch (error) {
    return { ok: false, error: error.toString() };
  }
}

function handleGetUser(params) {
  try {
    const sub = params.sub;
    if (!sub) {
      return { ok: false, error: "Missing sub parameter" };
    }
    
    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const subIndex = headers.indexOf("sub");
    
    // Buscar usuario
    for (let i = 1; i < data.length; i++) {
      if (data[i][subIndex] === sub) {
        const user = {};
        headers.forEach((header, idx) => {
          user[header] = data[i][idx];
        });
        return { ok: true, user: user };
      }
    }
    
    return { ok: false, error: "User not found" };
    
  } catch (error) {
    return { ok: false, error: error.toString() };
  }
}

function handleLeaderboard(params) {
  try {
    const limit = parseInt(params.limit || 5, 10);
    const offset = parseInt(params.offset || 0, 10);
    
    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const xpIndex = headers.indexOf("xp");
    
    // Crear array de usuarios (excluir header)
    const users = [];
    for (let i = 1; i < data.length; i++) {
      const user = {};
      headers.forEach((header, idx) => {
        user[header] = data[i][idx];
      });
      user.xp = parseInt(user.xp || 0, 10);
      
      // Solo incluir usuarios con XP > 0
      if (user.xp > 0) {
        users.push(user);
      }
    }
    
    // Ordenar por XP descendente
    users.sort((a, b) => b.xp - a.xp);
    
    // Agregar posición
    users.forEach((user, idx) => {
      user.position = idx + 1;
    });
    
    // Paginar
    const paginatedUsers = users.slice(offset, offset + limit);
    
    return {
      ok: true,
      leaderboard: paginatedUsers,
      total: users.length,
      limit: limit,
      offset: offset
    };
    
  } catch (error) {
    return { ok: false, error: error.toString() };
  }
}

// =====================================================
// UTILIDADES
// =====================================================

function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    // Crear la hoja si no existe
    sheet = ss.insertSheet(sheetName);
    
    // Agregar headers si es la hoja de usuarios
    if (sheetName === USERS_SHEET_NAME) {
      sheet.appendRow([
        "sub", "name", "email", "picture", "xp", 
        "level", "streak", "hearts", "freeze", "last_login"
      ]);
    }
  }
  
  return sheet;
}

function decodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = Utilities.base64Decode(payload, Utilities.Charset.UTF_8);
    const json = Utilities.newBlob(decoded).getDataAsString();
    return JSON.parse(json);
    
  } catch (error) {
    Logger.log("Error decoding JWT: " + error);
    return null;
  }
}

function calculateLevel(xp) {
  // Nivel cada 250 XP
  return Math.floor(xp / 250) + 1;
}
```

### Paso 2.3: Configurar el SHEET_ID

1. En la línea que dice `const SHEET_ID = "PEGA_AQUI_EL_ID_DE_TU_HOJA";`
2. Reemplaza con el ID que copiaste en el Paso 1.3
3. Ejemplo: `const SHEET_ID = "1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ";`

---

## 3. PUBLICACIÓN DEL WEB APP

### Paso 3.1: Guardar y Nombrar el Proyecto

1. Click en el icono de **disquete** (💾) o `Ctrl+S`
2. Nombra el proyecto: **"NEUROVERBS Backend"**

### Paso 3.2: Desplegar como Web App

1. Click en **Implementar → Nueva implementación**
2. En "Tipo", selecciona **Aplicación web**
3. Configuración:
   - **Descripción**: "NEUROVERBS API v1"
   - **Ejecutar como**: **Yo** (tu cuenta)
   - **Quién tiene acceso**: **Cualquier usuario** (importante para que funcione)
4. Click en **Implementar**

### Paso 3.3: Autorizar Permisos

1. Google te pedirá que autorices la aplicación
2. Click en **Autorizar acceso**
3. Selecciona tu cuenta de Google
4. Click en **Avanzado** (si aparece advertencia)
5. Click en **Ir a NEUROVERBS Backend (no seguro)**
6. Click en **Permitir**

### Paso 3.4: Copiar la URL del Web App

1. Después de autorizar, verás un mensaje de éxito
2. Copia la **URL de implementación**
3. Se verá así: `https://script.google.com/macros/s/AKfycby.../exec`
4. **Guarda esta URL** - la necesitarás para el frontend

---

## 4. ACTUALIZACIÓN DEL FRONTEND

### Paso 4.1: Crear Archivo de Configuración Mejorado

Crea un nuevo archivo llamado `sheets-config.js` en la carpeta raíz de tu proyecto:

```javascript
// =====================================================
// NEUROVERBS - Configuración de Google Sheets
// =====================================================

(function() {
  // 🔧 PEGA AQUÍ LA URL DE TU WEB APP
  const PRODUCTION_URL = "https://script.google.com/macros/s/TU_URL_AQUI/exec";
  
  // Permitir override desde URL o localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const urlOverride = urlParams.get("webapp");
  
  if (urlOverride) {
    localStorage.setItem("WEB_APP_URL_V5", urlOverride);
    console.log("[Sheets] URL actualizada desde parámetro:", urlOverride);
  }
  
  const storedUrl = localStorage.getItem("WEB_APP_URL_V5");
  const finalUrl = storedUrl || PRODUCTION_URL;
  
  // Configuración global
  window.NEUROVERBS_SHEETS = {
    WEB_APP_URL: finalUrl,
    ALLOWED_DOMAIN: "iemanueljbetancur.edu.co",
    DEBUG: false // Cambia a true para ver logs detallados
  };
  
  console.log("[Sheets] Configurado:", finalUrl);
})();
```

### Paso 4.2: Actualizar core.js

Busca estas líneas al inicio de `core.js`:

```javascript
const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwh3qTioH-xVnVL43V5_Y7_lc-Ng6BYCvNsj3E6IPDpanwUGa6cgqYpbR6yt724E5UF/exec";
const WEB_APP_URL = (new URLSearchParams(location.search).get("webapp")
  || localStorage.getItem("WEB_APP_URL_V5")
  || DEFAULT_WEB_APP_URL);
```

Reemplázalas con:

```javascript
// Usar la configuración de sheets-config.js si está disponible
const DEFAULT_WEB_APP_URL = window.NEUROVERBS_SHEETS?.WEB_APP_URL || "https://script.google.com/macros/s/TU_URL_AQUI/exec";
const WEB_APP_URL = DEFAULT_WEB_APP_URL;
```

### Paso 4.3: Mejorar la Función de Sincronización de XP

Busca la función `awardXP` en `core.js` y agrega al final (antes del `return gained;`):

```javascript
// Sincronizar XP con Sheets
try {
  const profile = localStorage.getItem("user_profile");
  if (profile) {
    const user = JSON.parse(profile);
    const idToken = localStorage.getItem("google_id_token");
    
    if (idToken && gained > 0) {
      // Evitar spam - solo sincronizar si han pasado al menos 2 segundos
      const now = Date.now();
      if (!window.__lastXpSync || (now - window.__lastXpSync) > 2000) {
        window.__lastXpSync = now;
        queueXpDelta(idToken, gained);
        
        if (window.NEUROVERBS_SHEETS?.DEBUG) {
          console.log("[XP] Sincronizando:", gained, "XP");
        }
      }
    }
  }
} catch (e) {
  console.warn("[XP] Error al sincronizar:", e);
}
```

### Paso 4.4: Agregar Script en HTML

En todos los archivos HTML que usan el sistema de puntuación (`neuroverbs.html`, `index.html`, etc.), agrega ANTES de `<script src="core.js">`:

```html
<!-- Configuración de Google Sheets -->
<script src="sheets-config.js"></script>
```

El orden correcto debe ser:

```html
<!-- Google Sign-In -->
<script async defer src="https://accounts.google.com/gsi/client"></script>

<!-- Configuración de Sheets -->
<script src="sheets-config.js"></script>

<!-- Core JavaScript -->
<script src="core.js"></script>
```

---

## 5. TESTING Y TROUBLESHOOTING

### Paso 5.1: Probar la Conexión

1. **Abrir la Consola del Navegador**:
   - Chrome/Edge: `F12` o `Ctrl+Shift+J`
   - Firefox: `F12` o `Ctrl+Shift+K`

2. **Habilitar Debug Mode**:
   ```javascript
   localStorage.setItem("NEUROVERBS_DEBUG", "true");
   location.reload();
   ```

3. **Probar el Endpoint Manualmente**:
   ```javascript
   // En la consola del navegador:
   fetch("TU_URL_DEL_WEBAPP/exec?action=debug&callback=test")
     .then(r => r.text())
     .then(console.log);
   ```

### Paso 5.2: Verificar Flujo Completo

1. **Login**: Inicia sesión con tu cuenta @iemanueljbetancur.edu.co
2. **Ganar XP**: Completa un ejercicio para ganar puntos
3. **Verificar Consola**: Deberías ver mensajes como:
   ```
   [Sheets] Configurado: https://script.google.com/...
   [XP] Sincronizando: 10 XP
   [Sheets] OK: {ok: true, user: {...}}
   ```
4. **Verificar Google Sheets**: Abre tu hoja y verifica que aparezca tu usuario con el XP correcto

### Paso 5.3: Problemas Comunes

#### ❌ Error: "JSONP timeout"

**Causa**: El Web App no está respondiendo
**Solución**:
1. Verifica que la URL sea correcta
2. Asegúrate de que el Web App esté publicado con acceso "Cualquier usuario"
3. Reemplaza implementación:
   - En Apps Script: **Implementar → Administrar implementaciones**
   - Click en el ícono de editar (✏️)
   - Click en **Versión → Nueva versión**
   - Click en **Implementar**

#### ❌ Error: "Unauthorized domain"

**Causa**: El correo no termina en @iemanueljbetancur.edu.co
**Solución**:
- Solo usuarios con correos del dominio autorizado pueden usar la app
- Verifica que iniciaste sesión con la cuenta correcta

#### ❌ XP no se sincroniza

**Causa**: Token JWT no está disponible o expiró
**Solución**:
```javascript
// Verificar en consola:
console.log("Token:", localStorage.getItem("google_id_token"));
console.log("Profile:", localStorage.getItem("user_profile"));

// Si están vacíos, volver a hacer login:
localStorage.clear();
location.reload();
```

#### ❌ Ranking no carga

**Causa**: Función `handleLeaderboard` tiene error o no hay usuarios
**Solución**:
1. Agrega al menos un usuario manualmente en Google Sheets
2. Verifica que la columna `xp` tenga valores numéricos
3. Prueba el endpoint en la consola:
   ```javascript
   fetch("TU_URL?action=leaderboard&limit=5&offset=0&callback=test")
     .then(r => r.text())
     .then(console.log);
   ```

### Paso 5.4: Ver Logs del Apps Script

1. En el editor de Apps Script, click en **Ejecuciones**
2. Verás todas las llamadas al Web App
3. Click en cada ejecución para ver logs detallados
4. Busca errores en rojo

---

## 📊 ESTRUCTURA FINAL DE ARCHIVOS

```
neuroverbs/
├── index.html                 (actualizado)
├── neuroverbs.html           (actualizado)
├── sheets-config.js          (NUEVO - configuración)
├── core.js                   (actualizado con sincronización)
├── ui.css
└── assets/
    └── ...
```

---

## 🔄 FLUJO DE DATOS COMPLETO

```
Usuario Gana XP
    ↓
awardXP() en core.js
    ↓
queueXpDelta(idToken, xpDelta)
    ↓
postToSheets() vía JSONP
    ↓
doGet() en Apps Script
    ↓
handleUpsert()
    ↓
Actualizar Google Sheets
    ↓
Respuesta: { ok: true, user: {...} }
    ↓
Frontend actualiza UI
```

---

## 🎯 VERIFICACIÓN FINAL

### Checklist Pre-Producción

- [ ] Sheet ID configurado correctamente en Apps Script
- [ ] Web App publicado con acceso "Cualquier usuario"
- [ ] URL del Web App copiada y pegada en `sheets-config.js`
- [ ] Archivo `sheets-config.js` incluido en todos los HTML
- [ ] Función `awardXP()` actualizada con sincronización
- [ ] Probado login con cuenta @iemanueljbetancur.edu.co
- [ ] Verificado que XP se guarda en Google Sheets
- [ ] Ranking funciona y muestra usuarios correctamente
- [ ] Consola del navegador no muestra errores

---

## 🚀 OPTIMIZACIONES AVANZADAS (OPCIONAL)

### Sincronización Offline

Para mejorar la experiencia cuando no hay internet:

```javascript
// Agregar a core.js
function syncPendingXP() {
  const pending = JSON.parse(localStorage.getItem("pending_xp") || "[]");
  
  if (pending.length === 0) return;
  
  const idToken = localStorage.getItem("google_id_token");
  if (!idToken) return;
  
  // Sumar todo el XP pendiente
  const totalXP = pending.reduce((sum, item) => sum + item.xp, 0);
  
  if (totalXP > 0) {
    postToSheets({ action: "upsert", idToken, xpDelta: totalXP });
    localStorage.removeItem("pending_xp");
    console.log("[Sync] Sincronizado XP pendiente:", totalXP);
  }
}

// Llamar al cargar la página
window.addEventListener("load", syncPendingXP);
window.addEventListener("online", syncPendingXP);
```

### Rate Limiting

Para evitar demasiadas llamadas:

```javascript
// Agregar a core.js
let xpBatch = 0;
let xpBatchTimer = null;

function batchQueueXpDelta(idToken, xpDelta) {
  xpBatch += xpDelta;
  
  // Cancelar timer anterior
  if (xpBatchTimer) clearTimeout(xpBatchTimer);
  
  // Sincronizar después de 5 segundos de inactividad
  xpBatchTimer = setTimeout(() => {
    if (xpBatch > 0) {
      postToSheets({ action: "upsert", idToken, xpDelta: xpBatch });
      xpBatch = 0;
    }
  }, 5000);
}
```

---

## 📞 SOPORTE

Si tienes problemas:

1. **Verifica los logs** en la consola del navegador y en Apps Script
2. **Revisa el SHEET_ID** - debe ser exactamente el de tu hoja
3. **Confirma la URL** del Web App - debe terminar en `/exec`
4. **Valida permisos** - el Web App debe estar publicado para "Cualquier usuario"

---

## ✅ CONCLUSIÓN

Ahora tienes una conexión completa entre el frontend de NEUROVERBS y Google Sheets. Los datos de puntuación, nivel, racha y ranking se sincronizan automáticamente cada vez que un usuario gana XP.

**Ventajas de esta implementación**:
- ✅ Sin servidor propio necesario
- ✅ Gratis para hasta 20,000 usuarios/día
- ✅ Datos centralizados en Google Sheets
- ✅ Fácil de exportar/analizar
- ✅ Funciona con JSONP (evita problemas de CORS)
- ✅ Respaldo automático de Google

¡Listo para producción! 🎉
