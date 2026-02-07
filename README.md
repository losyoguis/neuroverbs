# 🧠 NEUROVERBS

**Plataforma educativa gamificada para el aprendizaje de 180 verbos irregulares en inglés**

---

## 📖 Descripción

NEUROVERBS es una aplicación web diseñada para estudiantes de **I.E. Manuel J. Betancur** que combina neurociencia, gamificación y tecnología para facilitar el aprendizaje de verbos irregulares en inglés.

### 🎯 Objetivos

- Aprender 180 verbos irregulares en 80 días
- Dominar conjugaciones en voz activa y pasiva
- Practicar 3 tiempos verbales (Present, Past, Present Perfect)
- Crear hábitos de estudio consistentes

---

## ✨ Características Principales

### 🎮 Sistema de Gamificación Completo

- **XP (Puntos de Experiencia)**: Gana puntos completando ejercicios
- **Niveles**: Sube de nivel cada 250 XP
- **Racha**: Mantén días consecutivos practicando
- **Vidas**: Sistema de 5 corazones con regeneración
- **Freeze Tokens**: Protege tu racha cuando fallas
- **Meta Diaria**: 200 XP objetivo por día
- **Precisión**: Tracking de porcentaje de aciertos

### 📚 Modos de Aprendizaje

1. **Ruta del Inglés**: Programa estructurado de 80 días
   - 3 grupos de verbos (Day 1-8, 9-16, 17-24)
   - Progresión gradual de dificultad
   - Sistema de desbloqueo por días

2. **Voz Activa**: Conjugaciones afirmativas y negativas
   - Present Simple
   - Past Simple  
   - Present Perfect

3. **Voz Pasiva**: Construcciones pasivas
   - Present Simple Passive
   - Past Simple Passive
   - Present Perfect Passive

4. **Conocimientos Previos**: Repaso de verbos regulares
   - Lista de 100+ verbos regulares
   - Ejercicios de práctica
   - Sistema de logros

### 🎯 Tipos de Ejercicios

- **Spelling**: Escritura de conjugaciones
- **Writing**: Composición de oraciones
- **Speaking**: Práctica oral con reconocimiento de voz
- **Roleplay**: Conversaciones interactivas

### 📊 Sincronización con Google Sheets

- **Botón manual**: Sincroniza tu progreso cuando quieras
- **Atajo de teclado**: Ctrl+Shift+S
- **Leaderboard**: Ranking global de estudiantes
- **Datos persistentes**: Tu progreso guardado en la nube

---

## 🚀 Instalación

### Instalación Rápida

1. **Configura Google Sheets:**
   - Crea una hoja llamada "NEUROVERBS_DB"
   - Copia el ID de la hoja

2. **Configura Apps Script:**
   - Pega el código de `DOCS/apps-script-backend.js`
   - Actualiza el SHEET_ID
   - Publica como Web App

3. **Configura el Frontend:**
   - Actualiza la URL en `sheets-config.js`
   - Sube los archivos a tu hosting

4. **¡Listo!**

### Instalación Detallada

Ver **`DOCS/INSTALACION.md`** para instrucciones paso a paso.

---

## 📁 Estructura del Proyecto

```
neuroverbs/
├── index.html                    # Página de inicio/login
├── neuroverbs.html               # App principal de práctica
├── core.js                       # Lógica principal (✅ corregida)
├── sheets-config.js              # Configuración Google Sheets
├── ui.css                        # Estilos globales
│
├── assets/
│   ├── verbs_db.json            # Base de datos de 180 verbos
│   ├── ruta_del_ingles.json     # Programa de 80 días
│   └── kp_regular_verbs.json    # Verbos regulares
│
├── conocimientos-previos.*       # Módulo de verbos regulares
├── ruta-del-ingles.*            # Módulo de programa estructurado
├── seguimiento-estudiantes.*     # Dashboard para profesores
│
├── teacher-yoguis-*.html/js     # Módulos de ejercicios
│   ├── input.html               # Ejercicios de escritura
│   ├── speaking.html            # Ejercicios de pronunciación
│   ├── writing.html             # Ejercicios de composición
│   └── roleplay.html            # Conversaciones
│
├── cloudflare-worker/
│   └── worker.js                # Worker para IA (opcional)
│
└── DOCS/
    ├── apps-script-backend.js   # Backend para Google Sheets
    ├── INSTALACION.md           # Guía completa de instalación
    └── test-sync.html           # Herramienta de prueba
```

---

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Google Apps Script
- **Base de Datos**: Google Sheets
- **Autenticación**: Google OAuth 2.0
- **Hosting**: Compatible con GitHub Pages, Netlify, Vercel
- **IA (opcional)**: Cloudflare Workers + Claude API

---

## 🎨 Características Técnicas

### Offline-First
- Funciona sin conexión
- Datos guardados en localStorage
- Sincronización manual cuando hay internet

### Responsive Design
- Optimizado para móviles y tablets
- PWA-ready (puede instalarse como app)
- Interfaz adaptativa

### Seguridad
- Autenticación OAuth 2.0
- Restricción por dominio (@iemanueljbetancur.edu.co)
- Tokens JWT para validación
- HTTPS obligatorio

---

## 📊 Estructura de Datos (Google Sheets)

### Tabla "Users"

| Columna | Tipo | Descripción |
|---------|------|-------------|
| sub | String | ID único de Google |
| name | String | Nombre del usuario |
| email | String | Correo electrónico |
| picture | String | URL de foto de perfil |
| xp | Number | Puntos acumulados |
| level | Number | Nivel (calculado: xp/250) |
| streak | Number | Días consecutivos |
| hearts | Number | Vidas disponibles (max 5) |
| freeze | Number | Tokens de protección |
| last_login | Date | Última conexión |

---

## 🎯 Uso

### Para Estudiantes

1. **Ingresa** a la aplicación
2. **Inicia sesión** con tu cuenta @iemanueljbetancur.edu.co
3. **Elige** tu ruta de aprendizaje
4. **Completa** ejercicios para ganar XP
5. **Sincroniza** tu progreso con el botón 📊

### Para Profesores

1. Accede al módulo **Seguimiento a Estudiantes**
2. Consulta el ranking global
3. Revisa estadísticas en Google Sheets
4. Monitorea el progreso individual

---

## 🐛 Solución de Problemas

### El botón de sincronización no aparece
```bash
# Verifica que sheets-config.js se cargue
# Abre la consola (F12) y busca:
[Sheets] Configurado: https://script.google.com/...
```

### Error "Invalid token"
```bash
# Haz logout y vuelve a hacer login
# El token JWT expira después de 1 hora
```

### No se guarda el progreso
```bash
# Verifica en consola:
localStorage.getItem("xp")
# Debe mostrar tu XP actual
```

### Más soluciones en `DOCS/INSTALACION.md`

---

## 📱 Compatibilidad

| Navegador | Versión Mínima | Estado |
|-----------|----------------|--------|
| Chrome | 90+ | ✅ Totalmente compatible |
| Firefox | 88+ | ✅ Totalmente compatible |
| Safari | 14+ | ✅ Totalmente compatible |
| Edge | 90+ | ✅ Totalmente compatible |
| Opera | 76+ | ✅ Totalmente compatible |

---

## 🔒 Privacidad y Seguridad

- **Datos mínimos**: Solo guardamos sub, nombre, email, foto y estadísticas
- **Sin tracking**: No usamos Google Analytics ni cookies de terceros
- **Dominio restringido**: Solo usuarios @iemanueljbetancur.edu.co
- **Código abierto**: Todo el código es auditable
- **HTTPS**: Comunicación encriptada

---

## 📈 Roadmap

### Versión Actual: 2.0 (Febrero 2026)

**Completado:**
- ✅ Sistema de gamificación completo
- ✅ 180 verbos irregulares
- ✅ Programa de 80 días
- ✅ Sincronización manual con Google Sheets
- ✅ Botón de sincronización visual
- ✅ Sistema de vidas y racha
- ✅ Conocimientos previos (verbos regulares)

### Próximas Versiones

**v2.1 (Marzo 2026)**
- [ ] Auto-sincronización cada 5 minutos
- [ ] Badges y logros expandidos
- [ ] Sistema de notificaciones push
- [ ] Modo oscuro

**v2.2 (Abril 2026)**
- [ ] Ejercicios de listening
- [ ] Integración con Classroom
- [ ] Dashboard de analytics para profesores
- [ ] Exportación de reportes PDF

**v3.0 (Mayo 2026)**
- [ ] App móvil nativa (React Native)
- [ ] Modo multijugador (competencias)
- [ ] Sistema de misiones diarias
- [ ] Integración con WhatsApp para recordatorios

---

## 👥 Créditos

### Desarrollo
- **Profesor**: Juan Carlos Blandón Vargas
- **Institución**: I.E. Manuel J. Betancur
- **Año**: 2026

### Tecnologías Utilizadas
- Google Workspace (Sheets, Apps Script)
- Claude AI (Anthropic) - Asistencia en desarrollo
- Material Design Icons
- Font Awesome
- Web Speech API

---

## 📞 Contacto y Soporte

- **Email institucional**: juancarlosbv@iemanueljbetancur.edu.co
- **Dominio permitido**: @iemanueljbetancur.edu.co
- **Documentación**: Ver carpeta `DOCS/`

---

## 📄 Licencia

© 2026 I.E. Manuel J. Betancur - Todos los derechos reservados

Este proyecto es de uso exclusivo educativo para la Institución Educativa Manuel J. Betancur.

---

## 🙏 Agradecimientos

- A los estudiantes de I.E. Manuel J. Betancur por su feedback
- A la comunidad educativa por su apoyo
- A Google por las herramientas gratuitas (Sheets, Apps Script)
- A Anthropic por Claude AI

---

## 📚 Documentación Adicional

- **Guía de Instalación**: `DOCS/INSTALACION.md`
- **Backend API**: `DOCS/apps-script-backend.js`
- **Prueba de Sincronización**: `DOCS/test-sync.html`

---

## 🎉 ¡Empieza Ahora!

1. Sigue la guía en `DOCS/INSTALACION.md`
2. Configura tu Google Sheets
3. Sube los archivos
4. ¡Comienza a aprender!

**¿Preguntas?** Revisa `DOCS/INSTALACION.md` sección "Solución de Problemas"

---

**Versión**: 2.0  
**Última actualización**: Febrero 2026  
**Estado**: ✅ Producción
