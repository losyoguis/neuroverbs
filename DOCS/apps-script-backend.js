// =====================================================
// NEUROVERBS - Google Apps Script Backend
// VERSIÓN SIMPLIFICADA - MÁXIMA COMPATIBILIDAD
// =====================================================

const SHEET_ID = "1mCjFrxxmlKrzWBPhOpF_NiA7NYrBXVdnM8bbihBbh0c";
const USERS_SHEET_NAME = "Users";
const ALLOWED_DOMAIN = "iemanueljbetancur.edu.co";
const ALLOW_GET_UPSERT = true;

// =====================================================
// doGet - JSONP simple y directo
// =====================================================
function doGet(e) {
  const callback = e.parameter.callback || "callback";
  const action = e.parameter.action || "";
  
  let result;
  
  try {
    switch(action) {
      case "debug":
        result = { 
          ok: true, 
          message: "NEUROVERBS OK", 
          timestamp: new Date().toISOString(),
          sheetId: SHEET_ID
        };
        break;
        
      case "upsert":
        result = handleUpsert(e.parameter);
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
  } catch (error) {
    result = { ok: false, error: error.toString() };
  }
  
  // Retornar JSONP
  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(result) + ")")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// =====================================================
// Handlers
// =====================================================

function handleUpsert(params) {
  try {
    const idToken = params.idToken;
    const xpDelta = parseInt(params.xpDelta || 0, 10);
    
    if (!idToken) {
      return { ok: false, error: "Missing idToken" };
    }
    
    const payload = decodeJWT(idToken);
    if (!payload) {
      return { ok: false, error: "Invalid token" };
    }
    
    const email = (payload.email || "").toLowerCase();
    if (!email.endsWith("@" + ALLOWED_DOMAIN)) {
      return { ok: false, error: "Unauthorized domain" };
    }
    
    const sheet = getSheet(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const subIndex = headers.indexOf("sub");
    const xpIndex = headers.indexOf("xp");
    const levelIndex = headers.indexOf("level");
    const nameIndex = headers.indexOf("name");
    const emailIndex = headers.indexOf("email");
    const pictureIndex = headers.indexOf("picture");
    const lastLoginIndex = headers.indexOf("last_login");
    
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
      // Nuevo usuario
      currentXP = xpDelta;
      sheet.appendRow([
        payload.sub,
        payload.name || "Usuario",
        email,
        payload.picture || "",
        currentXP,
        calculateLevel(currentXP),
        0, 5, 0,
        now
      ]);
    } else {
      // Usuario existente
      currentXP = parseInt(data[userRow][xpIndex] || 0, 10) + xpDelta;
      
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
    if (!sub) return { ok: false, error: "Missing sub" };
    
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
      if (user.xp > 0) users.push(user);
    }
    
    users.sort((a, b) => b.xp - a.xp);
    users.forEach((user, idx) => {
      user.position = idx + 1;
    });
    
    return {
      ok: true,
      leaderboard: users.slice(offset, offset + limit),
      total: users.length,
      limit: limit,
      offset: offset
    };
  } catch (error) {
    return { ok: false, error: error.toString() };
  }
}

// =====================================================
// Utilidades
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
    return null;
  }
}

function calculateLevel(xp) {
  return Math.floor(xp / 250) + 1;
}
