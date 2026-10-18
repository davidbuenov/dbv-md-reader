# Arquitectura de IA Integrada en Aplicaciones de Escritorio

> *Patrón canónico de integración de inteligencia artificial híbrida (local, nube y agentes por ACP) para aplicaciones de escritorio desarrolladas con **Tauri v2**, **Vanilla JS/CSS** y el framework **dbv-specs-ops**.*

---

## 🎯 Visión y Principios Rectores

La integración de IA en aplicaciones cliente de escritorio suele enfrentarse a tres dilemas que frustran al usuario o comprometen el proyecto:

1. **La barrera económica de las claves de API frente a las suscripciones**: Los usuarios que ya pagan una suscripción mensual (Claude Pro/Max, ChatGPT Plus, Gemini, GitHub Copilot) no desean contratar claves de API de pago por uso. Integrar **agentes instalados mediante ACP** (Agent Client Protocol) resuelve este dilema sin coste adicional para el usuario ni para el desarrollador.
2. **Privacidad y soberanía de los datos**: Garantizar que los documentos nunca abandonen el ordenador salvo consentimiento expreso, con soporte nativo para **modelos locales** (Ollama, LM Studio, llama.cpp / vLLM).
3. **Cero huella (Zero-Footprint Lazy Loading)**: Si el usuario no utiliza la IA, la aplicación debe arrancar exactamente igual que una app tradicional: sin consumir memoria RAM, sin procesos secundarios y sin penalizar los tiempos de carga inicial.

---

## 🏛️ Arquitectura de los Tres Caminos (3-Tier Engine)

```
                       ┌──────────────────────────────────────────────┐
                       │             Aplicación Desktop               │
                       │           (Tauri v2 + Frontend)              │
                       └──────────────────────┬───────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │                                               │
                      ▼                                               ▼
         ┌─────────────────────────┐                     ┌─────────────────────────┐
         │     Modelos Directos    │                     │  Agentes con Suscripción │
         │  (HTTP / Streaming SSE) │                     │   (CLI via ACP / stdio) │
         └────────────┬────────────┘                     └────────────┬────────────┘
                      │                                               │
         ┌────────────┴────────────┐                     ┌────────────┴────────────┐
         ▼                         ▼                     ▼                         ▼
┌──────────────────┐      ┌──────────────────┐  ┌──────────────────┐      ┌──────────────────┐
│     Local        │      │      Nube        │  │   Claude Code    │      │  GitHub Copilot  │
│ Ollama/LM Studio │      │ OpenAI/Anthropic │  │    Codex CLI     │      │    Gemini CLI    │
│  (:11434/:1234)  │      │ Gemini/OpenRouter│  │ (npx acp / --acp)│      │  (sesión activa) │
└──────────────────┘      └──────────────────┘  └──────────────────┘      └──────────────────┘
```

| Nivel | Proveedores típicos | Protocolo / Transporte | Gestión de credenciales | ¿Salen datos del equipo? |
| --- | --- | --- | --- | --- |
| **1. IA Local** | Ollama, LM Studio, llama.cpp, vLLM | HTTP (`/api/chat` nativo o `/v1/chat/completions`) | Ninguna (puerto local) | **No** (100% privado y offline) |
| **2. Nube (API Key)** | OpenAI, Anthropic Messages, Google Gemini, OpenRouter | HTTPS con streaming SSE | Llavero nativo del SO (`keyring`) | Sí (al proveedor elegido, con aviso previo) |
| **3. Agentes (Suscripción)** | Claude Code, Codex CLI, Gemini CLI, Copilot CLI | JSON-RPC 2.0 sobre stdin/stdout (ACP) | Las del propio CLI (la app no las ve) | Sí (al servicio del agente) |

---

## 🔒 Seguridad: Custodia de Secretos en el Sistema Operativo

Uno de los mayores antipatrones en aplicaciones de escritorio es almacenar claves de API en archivos JSON en texto plano o en el `localStorage` del WebView.

### Reglas de Seguridad DBV:
1. **Uso de `keyring` (Rust)**:
   - En **Windows**: Administrador de credenciales de Windows (*Windows Credential Manager*).
   - En **macOS**: Llavero del sistema (*macOS Keychain*).
   - En **Linux**: Servicio de secretos (*Secret Service API* / D-Bus).
2. **Respaldo en memoria de sesión (*Session Fallback*)**:
   - En entornos sin servicio de secretos (por ejemplo, contenedores CI de Linux mínimos), la clave se retiene exclusivamente en memoria (`Mutex<HashMap>`) mientras dura la ejecución del proceso y se destruye al cerrar la app.
3. **Flujo unidireccional de claves**:
   - El frontend **nunca** puede leer una clave ya guardada. La API IPC de Tauri solo expone un booleano `hasKey`.
   - Al editar una conexión existente, el campo de clave permanece en blanco; si no se altera, se preserva la clave almacenada de forma transparente.

---

## ⚡ Carga Perezosa y Rendimiento (Lazy Loading)

El subsistema de IA está dividido en dos capas estrictamente desacopladas:

1. **Backend Rust (`src-tauri/src/ai/`)**:
   - Registrado en `lib.rs` como módulo nativo con dependencias estándar y ligeras (`keyring`, `ureq`, `tokio`, `walkdir`).
   - La detección de servidores locales y programas en el `PATH` no se realiza al iniciar la aplicación, sino **únicamente** cuando el usuario abre la ventana de configuración («Conectar una IA»).
2. **Frontend Vanilla JS (`src/ai/`)**:
   - El archivo inicial cargado es solo `entry.js` (~2 KB).
   - `entry.js` consulta `aiConnections()` de forma asíncrona. Si el usuario no tiene ninguna IA conectada, el resto de módulos (`aiApp.js`, `chatPanel.js`, `connectWizard.js`, `diff.js`, etc.) y la hoja de estilos `ai.css` **no se importan ni se inyectan en el DOM**.

---

## 🛠️ Herramientas, Propuestas Atómicas y Comprobación en Memoria

Para que un modelo de IA actúe como copiloto fiable sin romper los archivos del usuario, se implementa el patrón **Propuesta y Revisión Visual**:

```
[Usuario pide cambio] ──► [IA invoca propose_changes] ──► [Backend valida/compila en memoria]
                                                                     │
 ┌───────────────────────────────────────────────────────────────────┘
 ▼
[¿Introduce errores?] ──Sí──► [IA intenta autocorregir (máx 2 reintentos)]
        │
        No
        ▼
[Tarjeta de Revisión Diff] ──► [Usuario revisa trozo a trozo] ──► [Aceptar / Rechazar / Deshacer]
```

1. **Ninguna herramienta escribe a ciegas en disco**:
   - La herramienta `propose_changes` genera una estructura en memoria con los diffs (añadidos, modificaciones, eliminaciones).
2. **Comprobación en memoria (`ai_check_proposal`)**:
   - Antes de mostrar la propuesta, el backend valida las rutas (seguridad frente a escape de directorio `..`) y comprueba la sintaxis o compila el proyecto en memoria (p. ej., con el compilador en proceso en Typst o linters de sintaxis).
3. **Autocorrección guiada**:
   - Si la propuesta introduce errores nuevos que antes no existían, el bucle de herramientas (`agentLoop.js`) reenvía los errores al modelo para que genere una corrección antes de molestar al usuario.
4. **Revisión por trozos (*Hunk Review*)**:
   - El usuario puede inspeccionar los diffs visualmente, desmarcar bloques concretos o retocar el texto antes de pulsar «Aplicar».

---

## 🤖 Protocolo de Agentes (Agent Client Protocol - ACP)

El protocolo **ACP** permite a la aplicación desktop comunicarse con agentes CLI instalados localmente que utilizan suscripciones existentes:

- **Claude Code**: Lanzado vía `npx -y @agentclientprotocol/claude-agent-acp`.
- **Codex CLI**: Lanzado vía `npx -y @zed-industries/codex-acp`.
- **Gemini CLI**: Lanzado con `gemini --experimental-acp`.
- **GitHub Copilot CLI**: Lanzado con `copilot --acp`.

### Punto de restauración y control de cambios:
Antes de ceder el turno al agente CLI, el backend toma una foto en memoria (`Snapshot`) de todos los archivos de texto del proyecto. Al finalizar el turno del agente, se calcula el diff exacto (`DiskChange`) de lo que el agente haya modificado en disco, permitiendo al usuario ver el resumen completo y deshacer cambios indeseados con un clic.

---

## 📚 Referencia en el Ecosistema DBV

- **Plantilla de referencia ejecutable**: [`dbv-tauri-starter`](https://github.com/davidbuenov/dbv-tauri-starter).
- **Implementación completa en producción**: [`dbv-typst-editor`](https://github.com/davidbuenov/dbv-typst-editor).
- **Guía de usuario bilingüe**: [`docs/templates/IA.template.md`](./templates/IA.template.md).
