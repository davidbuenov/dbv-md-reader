# 🤖 Usar una IA con DBV Markdown Reader

> 🌐 **Español** · [English](./IA.en.md) · [← Volver al README](../README.md)

El asistente de IA de DBV Markdown Reader es **opcional**. Sin conectar nada, la aplicación funciona exactamente igual que siempre: no arranca ningún proceso, no abre ninguna conexión y ni siquiera se carga el código de la IA. Solo está en **escritorio** (Windows, Linux y macOS); en Android no existe.

Esta guía explica **qué necesitas tener en tu ordenador** según la IA que quieras usar, y qué puede hacer el asistente.

## Lo esencial en una tabla

| Quiero usar… | Qué necesito instalar o tener | ¿Sale algo de mi equipo? | ¿Cuesta dinero? |
| --- | --- | --- | --- |
| **Una IA local** (Ollama, LM Studio, llama.cpp…) | El programa servidor y al menos un modelo descargado | No | No (gasta tu CPU/GPU y disco) |
| **Claude, ChatGPT, Gemini u OpenRouter con clave de API** | Una clave de API de ese proveedor | Sí, al proveedor | Sí, por uso, según la tarifa del proveedor |
| **Mi suscripción** (Claude Pro/Max, ChatGPT Plus, Gemini, Copilot) | El **agente** de ese servicio instalado y con la sesión iniciada: Claude Code, Codex, Gemini CLI o GitHub Copilot CLI | Sí, al servicio del agente | Lo cubre tu suscripción |

> ⚠️ **Una suscripción no es una clave de API.** Pagar Claude Pro, ChatGPT Plus o Gemini no te da una clave de API (se contratan por separado). Con una suscripción, la vía es el **agente instalado** (tercera fila).

Para empezar, pulsa el botón ✨ de la barra superior (o **Ctrl/Cmd + Mayús + I**). Si todavía no hay ninguna IA conectada se abre **«Conectar una IA»**: detecta lo que ya tienes (Ollama, LM Studio y los agentes) y lo marca con ✓; lo que no encuentra aparece con un enlace de instalación. Esa detección solo ocurre al abrir esa pantalla, nunca al arrancar la aplicación.

Una vez conectada, el asistente vive en la **pestaña «Asistente»** del panel lateral, junto a «Índice» y «Archivos».

---

## Qué puede hacer el asistente

La IA trabaja con **el documento que tienes abierto y su carpeta** (la misma que muestra la pestaña «Archivos»). No ve nada fuera de ella. Si abres un documento remoto (por URL) no hay carpeta local, y el asistente espera a que abras uno local.

- **Conversar sobre tu documento.** El panel muestra, en fichas que puedes quitar, qué se va a enviar: el documento, la selección, el esquema, los documentos de la carpeta. Escribe `@` para mencionar otro `.md` de la carpeta, o pulsa **«Adjuntar la sección visible»**. En el árbol de «Archivos», clic derecho → **«Añadir a la conversación de la IA»**.
- **Proponer cambios, que tú revisas.** Cuando la IA quiere modificar o crear documentos, te enseña una tarjeta con las diferencias **trozo a trozo**: puedes aceptar o rechazar cada trozo, retocar el texto y ver si la propuesta introduce problemas (un bloque de código sin cerrar, un `$$` sin pareja, un enlace a un fichero que no existe). Al aplicar, el cambio en el documento abierto **se hace en el editor** como una edición más: puedes deshacerlo con **Ctrl+Z**, y el documento queda «Modificado» hasta que lo guardes tú con **Ctrl+S**. Nada se escribe en disco por detrás del editor.
- **IA en línea sobre el texto.** En **Modo Edición**, selecciona un texto (o deja el cursor en un párrafo), clic derecho → **«IA: acciones sobre el texto…»** o **Ctrl/Cmd + Alt + I**: mejorar la redacción, corregir ortografía y gramática, traducir al español o al inglés, acortar, ampliar, convertir a tabla o a lista, explicar, o pedir algo con tus palabras. Ves el resultado como diferencia (lo que sale y lo que entra) y eliges **Aceptar**, **Rechazar** o **Reintentar**. Si el resultado pierde un enlace, una fórmula o un bloque de código, la aplicación te avisa antes de aceptar.

Lo que **no** hace: no renombra ni borra ficheros, y los modelos directos no ejecutan programas ni acceden a internet por su cuenta.

---

## 1. Una IA local (nada sale de tu equipo)

Es la opción más privada: los documentos no abandonan tu ordenador y no hay coste por uso. A cambio, la calidad depende del tamaño del modelo y de tu hardware.

### Ollama

1. Instala [Ollama](https://ollama.com/download).
2. Descarga un modelo, por ejemplo: `ollama pull qwen2.5:7b` (o `llama3`). Comprueba qué tienes con `ollama list`.
3. En la aplicación: **✨ → Conectar una IA**. Si Ollama está en marcha, aparece con ✓ y un botón **Usar**. Elige el modelo de la lista, pulsa **Probar conexión** y **Guardar**.

Ollama escucha en `http://localhost:11434`. La aplicación le indica ella misma el tamaño de contexto, porque Ollama usa por defecto uno pequeño (2 048–4 096 tokens) y recorta en silencio lo que no cabe.

### LM Studio

1. Instala [LM Studio](https://lmstudio.ai), descarga un modelo y **arranca su servidor local** (pestaña *Developer / Local Server*).
2. Escucha en `http://localhost:1234`; la aplicación lo detecta igual que a Ollama.

### Tu propio servidor compatible con OpenAI (llama.cpp, vLLM, Jan…)

Cualquier servidor que ofrezca la API de OpenAI sirve. El caso típico es `llama-server` de [llama.cpp](https://github.com/ggml-org/llama.cpp). **Este servidor no lo detecta el asistente: hay que añadirlo a mano.**

1. **Conectar una IA → Añadir una IA en la nube (clave de API)…** *(el botón se llama así, pero abre un formulario con todos los proveedores)*.
2. En **Proveedor**, elige **Servidor compatible con OpenAI (local o propio)**. ⚠️ **No elijas «Ollama»** para un servidor que no es Ollama: usa un protocolo distinto.
3. Rellena el formulario:

   | Campo | Valor |
   | --- | --- |
   | Nombre | el que quieras |
   | Dirección | `http://127.0.0.1:8080/v1` (puerto de tu servidor, **terminada en `/v1`**) |
   | Clave | vacía, salvo que arrancaras el servidor con `--api-key` |
   | Modelo | el `id` que devuelve `curl http://127.0.0.1:8080/v1/models` |
   | Contexto (tokens) | el `n_ctx` del servidor dividido entre sus *slots* |
   | Herramientas | *Detectar* |

4. **Probar conexión** y **Guardar**.

**Tres trampas habituales con llama.cpp:** (1) `/v1/models` muestra `n_ctx_train`, el máximo con el que se entrenó el modelo, **no** el de tu servidor (que es el flag `-c`); (2) con varios *slots* (`-np`), el contexto se reparte entre ellos: con `-np 4` y `-c 32768`, cada petición dispone de 8 192; (3) los modelos que «piensan» pueden parecer mudos mientras razonan: arranca el servidor con `--reasoning-budget 0`.

### Qué esperar de un modelo local

- **Herramientas.** Con un modelo que las admite, la IA lee los documentos de la carpeta por su cuenta y propone cambios que la aplicación **comprueba en memoria** antes de enseñártelos. Sin herramientas, el asistente sirve para conversar y trabajar con el contexto que se le envía; los cambios los pide en bloques de texto que la aplicación convierte en una propuesta.
- **Tamaño.** Los modelos de 2–3 mil millones de parámetros responden rápido en un portátil, pero se quedan cortos con documentos largos o propuestas complejas. Si las respuestas salen flojas, prueba antes con un modelo mayor que tocar la configuración.
- **Contexto.** 4 096 tokens es el mínimo y se queda corto con documentos largos. 8 192 es cómodo; 32 768, holgado. Un modelo más grande o un contexto mayor necesitan más RAM o VRAM.

---

## 2. En la nube, con tu clave de API

| Proveedor | Dónde se consigue la clave | Dirección (ya preconfigurada) |
| --- | --- | --- |
| Anthropic (Claude) | consola de Anthropic | `https://api.anthropic.com/v1` |
| OpenAI (ChatGPT) | plataforma de OpenAI | `https://api.openai.com/v1` |
| Google (Gemini) | Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai` |
| OpenRouter | openrouter.ai | `https://openrouter.ai/api/v1` |

**Conectar una IA → Añadir una IA en la nube (clave de API)…** → elige el proveedor → pega la clave → **Probar conexión** → elige el modelo de la lista que devuelve el propio proveedor → **Guardar**.

- **La clave** se guarda en el **almacén de credenciales del sistema** (Administrador de credenciales de Windows, Llavero de macOS, Secret Service en Linux), nunca en un fichero ni en `localStorage`. Al editar una conexión el campo de la clave queda vacío: dejarlo así conserva la guardada. Eliminar la conexión borra también la clave.
- **Privacidad:** para responder, se envía al proveedor el contexto que ves en el panel (documento abierto, selección y lo que adjuntes). **La primera vez por carpeta y proveedor, la aplicación te pregunta** antes de enviar nada.
- **Coste:** lo factura el proveedor por uso.

---

## 3. Con tu suscripción: agentes instalados

Si pagas **Claude Pro/Max, ChatGPT Plus, Gemini o GitHub Copilot**, no necesitas clave de API: la aplicación puede hablar con el **agente de línea de comandos** de ese servicio, que usa tu cuenta. La aplicación **no ve ni guarda tus credenciales**: el inicio de sesión lo hace el propio agente.

| Agente | Qué debe estar instalado | Cómo lo lanza la aplicación |
| --- | --- | --- |
| **Claude Code** | Claude Code y **Node.js** (incluye `npx`) | `npx -y @agentclientprotocol/claude-agent-acp` |
| **Codex** (OpenAI) | Codex y **Node.js** (incluye `npx`) | `npx -y @zed-industries/codex-acp` |
| **Gemini CLI** | Gemini CLI | `gemini --experimental-acp` |
| **GitHub Copilot CLI** | Copilot CLI | `copilot --acp` |

Enlaces de instalación: [Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup) · [Codex](https://github.com/openai/codex) · [Gemini CLI](https://github.com/google-gemini/gemini-cli) · [Copilot CLI](https://docs.github.com/copilot/how-tos/set-up/install-copilot-cli) · [Node.js](https://nodejs.org).

**Pasos:** (1) instala el agente (y Node.js si lo necesita) para que quede en el `PATH`; (2) **ábrelo una vez en una terminal** e inicia sesión con tu cuenta; (3) en la aplicación, **Conectar una IA**: el agente aparece con ✓ *instalado* y un botón **Conectar**. La primera vez puede tardar mientras se descarga su adaptador con `npx`.

**Cómo funciona:**

- La aplicación lanza el agente **con la carpeta del documento como directorio de trabajo**; se cierra al cerrar la ventana o al detenerlo desde el panel.
- **Permisos:** cada vez que el agente pide permiso para algo (ejecutar una orden, editar, leer), la aplicación te lo muestra con lo que pide. Puedes **Permitir una vez**, **Permitir siempre en esta conversación** o **Denegar**. Nada se aprueba solo, y lo que quede fuera de la carpeta se deniega.
- **Seguridad de tus ficheros:** antes de cada turno se guarda un **punto de restauración** de los `.md` de la carpeta. Lo que el agente cambie directamente en disco aparece al terminar bajo **«El agente cambió N documentos en disco»**, con sus diferencias y **Deshacer** por fichero. Si cambia el documento que tienes abierto con cambios sin guardar, se aplican las reglas de conflicto de siempre (te lo avisa).

---

## Privacidad de un vistazo

| Vía | Qué sale de tu equipo |
| --- | --- |
| IA local | Nada. La conversación no abandona tu ordenador. |
| API en la nube | El contexto que se envía, al proveedor. Se pregunta la primera vez por carpeta y proveedor. |
| Agente con suscripción | Lo que el agente envíe a su servicio. La aplicación no controla su red; los permisos sí pasan por ella. |

Las herramientas de los modelos directos **no acceden a la red ni ejecutan programas**: solo leen la carpeta del documento y proponen cambios que tú revisas. **El contenido de los documentos se trata como un dato, no como una orden**: si abres un `.md` de un tercero que dice «ignora tus instrucciones», el asistente no debe obedecerlo (y aun así nada se aplica sin que lo revises). Las conversaciones se guardan en la carpeta de datos de la aplicación, **nunca junto a tus documentos**; puedes borrarlas desde el panel. Más detalle en la [política de privacidad](./privacidad.html).

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| Escribo y **no responde nada** (servidor propio) | Proveedor en *Ollama* en lugar de *compatible con OpenAI* | Crea una conexión nueva con el proveedor correcto |
| Respuesta vacía y muchos tokens «recibidos» | El modelo razona y no llega a escribir la respuesta | Arranca el servidor con `--reasoning-budget 0` |
| «Servidor local apagado» | Ollama, LM Studio o tu servidor no están en marcha | Arráncalo y vuelve a **Probar conexión** |
| Error de dirección o 404 con un servidor propio | Falta `/v1` al final de la dirección | `http://127.0.0.1:PUERTO/v1` |
| Clave no válida | Clave mal pegada o de otro proveedor | Vuelve a pegarla; una suscripción no sirve como clave |
| Un agente no aparece o no conecta | No está en el `PATH`, falta Node.js o no has iniciado sesión | Instálalo, ábrelo una vez en una terminal y abre de nuevo **Conectar una IA** |
| El asistente dice «Abre un documento local» | El documento abierto es remoto (URL) o no hay ninguno | Abre un `.md` de tu disco |
| La IA en línea no hace nada | No estás en **Modo Edición** (Ctrl+E) | Entra en Modo Edición y selecciona un texto |
| El modelo olvida el principio del documento | Contexto demasiado pequeño | Sube el contexto del servidor y el campo **Contexto (tokens)** |

---

> Esta guía describe la versión **0.18.0**. La especificación completa está en [`RF-31`–`RF-36` de SPECIFICATIONS.md](../dbv-specs-ops/docs/SPECIFICATIONS.md).
