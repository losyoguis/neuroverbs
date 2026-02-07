# 📖 GUÍA DE INSTALACIÓN - NEUROVERBS

## 🎯 Objetivo
Configurar NEUROVERBS para que funcione con sincronización de datos a Google Sheets.

---

## ✅ PRE-REQUISITOS

- ✓ Cuenta de Google (@iemanueljbetancur.edu.co)
- ✓ Acceso a Google Sheets
- ✓ Acceso a Google Apps Script
- ✓ Hosting web (GitHub Pages, Netlify, Vercel, etc.)

---

## 📋 PASO 1: CONFIGURAR GOOGLE SHEETS

### 1.1 Crear la Hoja

1. Ve a [Google Sheets](https://sheets.google.com)
2. Clic en "+ Nuevo" → "Hoja de cálculo en blanco"
3. Renombra la hoja como: **NEUROVERBS_DB**
4. Renombra la primera pestaña como: **Users**

### 1.2 Copiar el ID de la Hoja

1. En la barra de direcciones, copia el ID de la hoja
2. Está entre `/d/` y `/edit` en la URL
3. Ejemplo:
   ```
   https://docs.google.com/spreadsheets/d/1mCJFrxxmIKrzWBPhOpF_NiA7NYrBXVdnM8bbihBbh0c/edit
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        Este es tu SHEET_ID
   ```
4. **Guarda este ID** - lo necesitarás en el paso 2.3

---

## 📋 PASO 2: CONFIGURAR GOOGLE APPS SCRIPT

### 2.1 Abrir el Editor

1. En tu hoja de Google Sheets (NEUROVERBS_DB)
2. Menú: **Extensiones → Apps Script**
3. Se abrirá el editor de código

### 2.2 Pegar el Código Backend

1. Borra todo el código que aparece por defecto
2. Abre el archivo `DOCS/apps-script-backend.js`
3. Copia **TODO** el contenido
4. Pégalo en el editor de Apps Script

### 2.3 Actualizar el SHEET_ID

1. Busca la línea 6:
   ```javascript
   const SHEET_ID = "PEGA_AQUI_EL_ID_DE_TU_HOJA";
   ```
2. Reemplázala con el ID que copiaste en el paso 1.2:
   ```javascript
   const SHEET_ID = "1mCJFrxxmIKrzWBPhOpF_NiA7NYrBXVdnM8bbihBbh0c";
   ```

### 2.4 Guardar el Proyecto

1. Clic en el ícono de disco 💾 o `Ctrl+S`
2. Nombra el proyecto como: **NEUROVERBS Backend**

---

## 📋 PASO 3: PUBLICAR EL WEB APP

### 3.1 Crear Nueva Implementación

1. En Apps Script, clic en **Implementar** (botón azul arriba a la derecha)
2. Selecciona **Nueva implementación**
3. En "Tipo de implementación", clic en el ícono de engranaje ⚙️
4. Selecciona **Aplicación web**

### 3.2 Configurar Permisos

Configura así:

| Campo | Valor |
|-------|-------|
| **Descripción** | NEUROVERBS API v1 |
| **Ejecutar como** | Yo (tu correo) |
| **Quién tiene acceso** | **Cualquier usuario** |

⚠️ **IMPORTANTE**: Debe ser "Cualquier usuario", no "Solo yo"

### 3.3 Autorizar Permisos

1. Clic en **Implementar**
2. Te pedirá autorizar permisos
3. Clic en **Autorizar acceso**
4. Selecciona tu cuenta Google
5. Verás una advertencia "Google no ha verificado esta aplicación"
6. Clic en **Configuración avanzada**
7. Clic en **Ir a NEUROVERBS Backend (inseguro)**
8. Clic en **Permitir**

### 3.4 Copiar la URL del Web App

1. Aparecerá una ventana con la **URL de implementación**
2. Copia la URL completa que termina en `/exec`
3. Ejemplo:
   ```
   https://script.google.com/macros/s/AKfycbw8guQDhKmDx83QN7Vb_wIJ7a-2s_QbsS6AW3uJaqoR3XQpEMZVK4XkZYSPuQl2oCu4Q/exec
   ```
4. **¡MUY IMPORTANTE!** Guarda esta URL, la necesitarás en el paso 4

---

## 📋 PASO 4: CONFIGURAR EL FRONTEND

### 4.1 Actualizar sheets-config.js

1. Abre el archivo `sheets-config.js`
2. Busca la línea 7:
   ```javascript
   const PRODUCTION_URL = "PEGA_AQUI_LA_URL_DE_TU_WEB_APP";
   ```
3. Reemplázala con la URL que copiaste en el paso 3.4:
   ```javascript
   const PRODUCTION_URL = "https://script.google.com/macros/s/AKfycbw8guQDhKmDx83QN7Vb_wIJ7a-2s_QbsS6AW3uJaqoR3XQpEMZVK4XkZYSPuQl2oCu4Q/exec";
   ```
4. Guarda el archivo

---

## 📋 PASO 5: SUBIR LOS ARCHIVOS AL SERVIDOR

### 5.1 Estructura de Archivos

Asegúrate de subir TODOS estos archivos:

```
neuroverbs/
├── index.html
├── neuroverbs.html
├── core.js ← (versión corregida)
├── sheets-config.js ← (configurado en paso 4.1)
├── ui.css
├── logout-widget.js
├── mensajeria-local.js
├── ai-client.js
├── ai-config.js
├── chat-widget.js
├── chat-widget.css
├── assets/
│   ├── verbs_db.json
│   ├── ruta_del_ingles.json
│   └── kp_regular_verbs.json
├── cloudflare-worker/
│   └── worker.js
├── conocimientos-previos.html
├── conocimientos-previos.js
├── conocimientos-previos.css
├── ruta-del-ingles.html
├── ruta-del-ingles.js
├── ruta-del-ingles.css
├── seguimiento-estudiantes.html
├── seguimiento-estudiantes.js
├── seguimiento-estudiantes.css
├── teacher-yoguis-*.html
├── teacher-yoguis-*.js
├── favicon.ico
├── favicon.png
├── apple-touch-icon.png
└── DOCS/ (opcional, solo documentación)
```

### 5.2 Opciones de Hosting

**Opción A: GitHub Pages**
1. Crea un repositorio en GitHub
2. Sube todos los archivos
3. Ve a Settings → Pages
4. Selecciona la rama y carpeta
5. Guarda

**Opción B: Netlify**
1. Ve a [netlify.com](https://www.netlify.com/)
2. Arrastra la carpeta del proyecto
3. Listo (deploy automático)

**Opción C: Vercel**
1. Ve a [vercel.com](https://vercel.com/)
2. Import Project
3. Selecciona la carpeta
4. Deploy

---

## 📋 PASO 6: PROBAR LA INSTALACIÓN

### 6.1 Prueba Básica con test-sync.html

1. Abre `DOCS/test-sync.html` en tu navegador
2. En el campo "URL del Web App", pega la URL del paso 3.4
3. Abre la consola del navegador (F12)
4. En la consola, escribe:
   ```javascript
   localStorage.getItem("google_id_token")
   ```
5. Si no hay token:
   - Ve a la app principal (index.html)
   - Haz login con tu cuenta @iemanueljbetancur.edu.co
   - Vuelve a test-sync.html
6. Clic en "📋 Cargar desde localStorage"
7. Clic en "🚀 Probar Sincronización"
8. Deberías ver: "✅ ¡Sincronización exitosa!"

### 6.2 Prueba Completa en la App

1. Abre `index.html` en tu navegador
2. Clic en **Iniciar sesión con Google**
3. Selecciona tu cuenta @iemanueljbetancur.edu.co
4. Deberías ver tu foto y nombre arriba a la derecha
5. Clic en **Ruta del Inglés**
6. Completa algunos ejercicios para ganar XP
7. Ve a `neuroverbs.html`
8. Deberías ver el botón **"📊 Sincronizar con Sheets"** abajo a la derecha
9. Clic en el botón
10. Espera el mensaje: "✅ Sincronizado: X XP (Nivel Y)"
11. Abre tu Google Sheet
12. Verifica que aparezca tu usuario con el XP correcto

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Error: "Invalid token"

**Causa:** El token JWT ha expirado o es inválido

**Solución:**
1. Haz logout (botón "Cerrar sesión")
2. Recarga la página (Ctrl+Shift+R)
3. Vuelve a hacer login

---

### Error: "Unauthorized domain"

**Causa:** Estás usando una cuenta que no termina en @iemanueljbetancur.edu.co

**Solución:**
1. Verifica que uses la cuenta correcta
2. Si necesitas cambiar el dominio:
   - Edita `apps-script-backend.js` línea 8
   - Edita `sheets-config.js` línea 22

---

### Error: "Timeout: El servidor no respondió"

**Causa:** La URL del Web App no es correcta o el Apps Script no está publicado

**Solución:**
1. Verifica la URL en `sheets-config.js`
2. Debe terminar en `/exec`
3. Verifica que el Web App esté publicado correctamente:
   - Apps Script → Implementar → Administrar implementaciones
   - Debe estar "Activo"

---

### Botón de sincronización no aparece

**Causa:** El archivo no se cargó correctamente

**Solución:**
1. Verifica que `sheets-config.js` esté en el mismo directorio que `neuroverbs.html`
2. Abre neuroverbs.html y busca esta línea (debe estar antes de `</body>`):
   ```html
   <script src="sheets-config.js"></script>
   ```
3. Recarga con Ctrl+Shift+R

---

### Ranking vacío

**Causa:** No hay usuarios con XP > 0

**Solución:**
1. Asegúrate de haber sincronizado XP
2. Abre Google Sheets
3. Verifica que la columna "xp" tenga números (no texto)
4. Clic en "Actualizar" en el ranking

---

## 🔧 CONFIGURACIÓN AVANZADA

### Cambiar dominio permitido

En `DOCS/apps-script-backend.js`, línea 8:
```javascript
const ALLOWED_DOMAIN = "tudominio.edu.co";
```

Luego:
1. Guarda
2. Implementar → Nueva implementación
3. Actualiza la URL en `sheets-config.js`

---

### Activar modo DEBUG

En `sheets-config.js`, línea 22:
```javascript
DEBUG: true
```

Esto mostrará logs detallados en la consola del navegador.

---

### Cambiar XP necesario por nivel

En `DOCS/apps-script-backend.js`, última función:
```javascript
function calculateLevel(xp) {
  return Math.floor(xp / 250) + 1; // Cambiar 250
}
```

---

### Auto-sincronización cada 5 minutos

Agregar al final de `core.js` (antes del último `}`):

```javascript
// Auto-sync cada 5 minutos
setInterval(() => {
  try {
    const idToken = localStorage.getItem("google_id_token");
    const profile = localStorage.getItem("user_profile");
    
    if (idToken && profile) {
      const currentXP = parseInt(localStorage.getItem("xp") || 0, 10);
      const lastSyncedXP = parseInt(localStorage.getItem("last_synced_xp") || 0, 10);
      
      if (currentXP !== lastSyncedXP && currentXP > 0) {
        const delta = currentXP - lastSyncedXP;
        postToSheets({ action: "upsert", idToken, xpDelta: delta });
        localStorage.setItem("last_synced_xp", currentXP.toString());
        console.log("[Auto-sync] +" + delta + " XP");
      }
    }
  } catch(e) {}
}, 300000); // 5 minutos = 300000 ms
```

---

## ✅ CHECKLIST FINAL

Antes de dar por terminada la instalación, verifica:

- [ ] Google Sheet creada con nombre "NEUROVERBS_DB"
- [ ] Apps Script configurado con SHEET_ID correcto
- [ ] Web App publicado con acceso "Cualquier usuario"
- [ ] URL copiada y pegada en sheets-config.js
- [ ] Archivos subidos al hosting
- [ ] Prueba con test-sync.html exitosa
- [ ] Login funciona en index.html
- [ ] XP se acumula en neuroverbs.html
- [ ] Botón "Sincronizar con Sheets" aparece
- [ ] Sincronización exitosa (mensaje verde)
- [ ] Datos visibles en Google Sheets

---

## 📞 SOPORTE

Si tienes problemas:

1. Revisa esta guía paso a paso
2. Usa `DOCS/test-sync.html` para diagnosticar
3. Activa DEBUG en `sheets-config.js`
4. Revisa la consola del navegador (F12)
5. Revisa los logs de Apps Script:
   - Apps Script → Ejecuciones (ícono de reloj)

---

## 🎉 ¡FELICIDADES!

Si llegaste hasta aquí y todo funciona, ¡has completado la instalación exitosamente!

Ahora tus estudiantes pueden:
- ✅ Practicar verbos irregulares
- ✅ Ganar XP y subir de nivel
- ✅ Ver el ranking global
- ✅ Sincronizar su progreso en la nube

---

**Última actualización**: Febrero 2026  
**Versión**: 2.0
