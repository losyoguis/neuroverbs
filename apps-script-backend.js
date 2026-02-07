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
        payload.sub,
        payload.name || "Usuario",
        email,
        payload.picture || "",
        xpDelta,
        calculateLevel(xpDelta),
        0,
        5,
        0,
        now
      ];
      sheet.appendRow(newRow);
      currentXP = xpDelta;
      
    } else {
      // Usuario existente - actualizar
      currentXP = parseInt(data[userRow][xpIndex] || 0, 10);
      currentXP += xpDelta;
      
      sheet.getRange(userRow + 1, xpIndex + 1).setValue(currentXP);
      sheet.getRange(userRow + 1, levelIndex + 1).setValue(calculateLevel(currentXP));
      sheet.getRange(userRow + 1, lastLoginIndex + 1).setValue(now);
      
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
    
    const users = [];
    for (let i = 1; i < data.length; i++) {
      const user = {};
      headers.forEach((header, idx) => {
        user[header] = data[i][idx];
      });
      user.xp = parseInt(user.xp || 0, 10);
      
      if (user.xp > 0) {
        users.push(user);
      }
    }
    
    users.sort((a, b) => b.xp - a.xp);
    users.forEach((user, idx) => {
      user.position = idx + 1;
    });
    
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
    sheet = ss.insertSheet(sheetName);
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
  return Math.floor(xp / 250) + 1;
}
