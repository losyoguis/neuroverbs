# NeuroVerbs

Actualización v4 (DEFINITIVA):
- Voz pasiva SIN traducción al español en READING (forzado a nivel de render)
- Voz pasiva SIN español en tablas
- Voz activa conserva EN/ES


## Chat interno (usuarios logueados)

Este proyecto incluye un chat interno (bottom-right) visible en todas las páginas. Reglas:
- Solo permite enviar mensajes en **inglés**.
- Solo funciona para usuarios que hayan iniciado sesión (se usa `localStorage.user_profile`).

### Backend recomendado (Cloudflare Worker + KV)

1. En Cloudflare, crea un **KV Namespace** (por ejemplo: `NEUROVERBS_CHAT`).
2. En tu Worker, agrega un **KV Namespace Binding**:
   - **Variable name:** `CHAT_KV`
   - **KV namespace:** `NEUROVERBS_CHAT`
3. Publica el Worker. La web app consumirá:
   - `POST /internal-chat/send`
   - `GET  /internal-chat/messages?room=global&after=0`

> Si `CHAT_KV` no está configurado, el chat mostrará “Chat no disponible”.
