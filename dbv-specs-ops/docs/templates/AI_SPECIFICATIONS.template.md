# Plantilla de Especificaciones: Subsistema de IA Integrada

> *Catálogo estándar de Requisitos Funcionales (RF) y No Funcionales (RNF) para proyectos del ecosistema **dbv-specs-ops** que incorporan un asistente de IA.*

---

## 📋 Requisitos No Funcionales (RNF-IA)

### `RNF-IA.1` — Cero Huella y Activación Opcional
- El subsistema de IA es 100% opcional. Sin ninguna IA configurada, la aplicación debe arrancar y funcionar exactamente igual que una aplicación sin IA.
- El paquete inicial de frontend no debe incluir los módulos de IA ni sus hojas de estilo; se deben cargar de forma perezosa (*lazy loading*) solo cuando el usuario active la IA o abra la ventana de conexión.

### `RNF-IA.2` — Privacidad por Diseño
- Ningún dato del usuario o del proyecto debe salir del equipo sin consentimiento explícito.
- Con modelos locales (Ollama, LM Studio, llama.cpp), la comunicación debe ser estrictamente local (`127.0.0.1` / `localhost`).
- La primera vez que un proyecto interactúe con un proveedor en la nube, se debe solicitar confirmación clara al usuario informando de qué datos se enviarán.

### `RNF-IA.3` — Confinamiento en el Espacio de Trabajo
- Las herramientas de lectura, búsqueda y propuestas de cambios deben estar confinadas exclusivamente al espacio de trabajo o proyecto abierto.
- Queda prohibido el acceso a rutas que escapen de la raíz mediante secuencias `..` o enlaces simbólicos no controlados.

### `RNF-IA.4` — Custodia de Credenciales Segura
- Las claves de API no deben almacenarse en texto plano en archivos JSON, configuración de usuario ni `localStorage`.
- Se debe utilizar el almacén nativo de credenciales del sistema operativo (*keyring* en Windows Credential Manager, macOS Keychain y Linux Secret Service).
- En entornos sin almacén disponible, las credenciales solo pueden conservarse en memoria volátil de la sesión.

---

## 🧩 Requisitos Funcionales (RF-IA)

### `RF-IA-01` — Conectar una IA (Asistente de Conexión)
- **RF-IA-01.1**: Detección automática al abrir la pantalla de servidores locales en ejecución (Ollama en `:11434`, LM Studio en `:1234`) y de agentes de línea de comandos en `PATH` (`claude`, `gemini`, `codex`, `copilot`, `node`).
- **RF-IA-01.2**: Soporte para proveedores en la nube mediante clave de API (OpenAI, Anthropic, Google Gemini, OpenRouter, servidores compatibles con OpenAI).
- **RF-IA-01.3**: Botón «Probar conexión» que valida la conectividad y recupera en tiempo real la lista oficial de modelos del proveedor.
- **RF-IA-01.4**: Explicación clara al usuario de que una suscripción mensual no equivale a una clave de API.

### `RF-IA-02` — Agentes con Suscripción mediante ACP (Agent Client Protocol)
- **RF-IA-02.1**: Conexión con los agentes CLI oficiales instalados en el sistema utilizando la sesión ya autenticada del usuario.
- **RF-IA-02.2**: Gestión de permisos interactiva: cada solicitud de ejecución, lectura o escritura del agente debe mostrarse al usuario para permitir (una vez / siempre en esta conversación) o denegar.
- **RF-IA-02.3**: Punto de restauración automático (`Snapshot`) antes de cada turno del agente, con detección de diferencias en disco (`DiskChange`) e informe con botón «Deshacer».

### `RF-IA-03` — Panel Lateral de Conversación
- **RF-IA-03.1**: Panel colapsable accesible desde la barra superior y atajo de teclado (`Ctrl+Mayús+I` / `Cmd+Shift+I`).
- **RF-IA-03.2**: Indicador de destino de la petición (etiqueta verde para local, ámbar para nube).
- **RF-IA-03.3**: Selector de contexto interactivo con fichas (*chips*) removibles para excluir elementos del presupuesto de tokens.
- **RF-IA-03.4**: Respuestas en streaming (SSE) con formato Markdown seguro (sin `innerHTML`) y botón de cancelación inmediata.

### `RF-IA-04` — Revisión Visual y Comprobación en Memoria de Cambios
- **RF-IA-04.1**: La IA propone cambios a través de diffs atómicos (`propose_changes`), nunca modificando archivos en disco a ciegas.
- **RF-IA-04.2**: Validación previa en memoria: el backend verifica la coherencia y sintaxis de los archivos antes de mostrarlos al usuario.
- **RF-IA-04.3**: Autocorrección automática si la propuesta introduce errores sintácticos nuevos (máximo 2 reintentos).
- **RF-IA-04.4**: Tarjeta de revisión visual que permite al usuario inspeccionar trozo a trozo (*hunks*), desmarcar cambios específicos o retocar el texto antes de aplicar o descartar.
