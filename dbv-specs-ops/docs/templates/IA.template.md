# 🤖 Usar una IA con {{APP_NAME}}

> 🌐 **Español** · [English](./IA.en.md) · [← Volver al README](../README.md)

El asistente de IA en **{{APP_NAME}}** es **completamente opcional**. Sin configurar ninguna IA, la aplicación funciona exactamente igual que siempre: de forma 100% local, privada y sin conexión. Esta guía explica **qué necesitas en tu ordenador** según la modalidad de IA que prefieras utilizar.

## Lo esencial en una tabla

| Quiero usar… | Qué necesito tener o instalar | ¿Sale algo de mi equipo? | ¿Tiene coste? |
| --- | --- | --- | --- |
| **Una IA local** (Ollama, LM Studio, llama.cpp…) | El programa servidor y al menos un modelo descargado | **No** | No (utiliza tu CPU/GPU y memoria) |
| **Claude, ChatGPT, Gemini u OpenRouter con clave de API** | Una clave de API del proveedor | Sí, al proveedor elegido | Sí, por uso según las tarifas del proveedor |
| **Mi suscripción mensual** (Claude Pro/Max, ChatGPT Plus, Gemini, Copilot) | El **agente oficial** instalado y con sesión iniciada: Claude Code, Codex, Gemini CLI o GitHub Copilot CLI | Sí, al servicio del agente | Cubierto por tu suscripción mensual |

> ⚠️ **Una suscripción no es una clave de API.** Pagar Claude Pro, ChatGPT Plus o Gemini no te proporciona una clave de API (estas se contratan y facturan por separado en las consolas de desarrollador). Si tienes una suscripción activa, la vía recomendada es el **agente instalado** (tercera fila).

Para abrir el asistente de conexión en la aplicación: pulsa el botón **IA** en la barra superior o presiona `Ctrl+Mayús+I` (`Cmd+Shift+I` en macOS).

---

## 1. Una IA local (nada sale de tu equipo)

Es la opción con máxima privacidad: los datos nunca abandonan tu máquina y no existe ningún coste por uso. La velocidad y calidad dependerán del hardware de tu equipo y del tamaño del modelo elegido.

### Ollama
1. Descarga e instala [Ollama](https://ollama.com/download).
2. Descarga un modelo desde tu terminal, por ejemplo:
   ```bash
   ollama pull qwen2.5:3b
   ```
3. En {{APP_NAME}}, abre **Conectar una IA**. Si Ollama está en ejecución, aparecerá con una marca de verificación verde y el botón **Usar**.
4. Selecciona el modelo, pulsa **Probar conexión** y **Guardar**.

### LM Studio
1. Instala [LM Studio](https://lmstudio.ai), descarga el modelo deseado e inicia su servidor local (*Local Server* en el puerto por defecto `1234`).
2. {{APP_NAME}} detectará automáticamente el servidor.

---

## 2. En la nube, con tu clave de API

Si prefieres la máxima potencia de los modelos de frontera utilizando una **clave de API**:

| Proveedor | Dónde se consigue la clave |
| --- | --- |
| **Anthropic (Claude)** | Consola de Anthropic |
| **OpenAI (ChatGPT)** | Plataforma de OpenAI |
| **Google (Gemini)** | Google AI Studio |
| **OpenRouter** | openrouter.ai |

1. Abre **Conectar una IA → Añadir una IA en la nube (clave de API)...**
2. Selecciona el proveedor y pega tu clave.
3. Pulsa **Probar conexión**, elige el modelo de la lista y presiona **Guardar**.

- **Custodia segura**: La clave de API se guarda directamente en el almacén de credenciales nativo de tu sistema operativo (Administrador de credenciales de Windows, Llavero de macOS o Secret Service en Linux). Nunca se almacena en archivos de texto ni en el navegador.

---

## 3. Con tu suscripción existente: agentes instalados (ACP)

Si dispones de una cuenta de pago **Claude Pro/Max, ChatGPT Plus o GitHub Copilot**, puedes conectar directamente con su herramienta oficial de línea de comandos mediante el protocolo ACP:

| Agente | Qué debe estar instalado | Cómo se ejecuta |
| --- | --- | --- |
| **Claude Code** | Claude Code y [Node.js](https://nodejs.org) | `npx -y @agentclientprotocol/claude-agent-acp` |
| **Codex (OpenAI)** | Codex y Node.js | `npx -y @zed-industries/codex-acp` |
| **Gemini CLI** | Gemini CLI | `gemini --experimental-acp` |
| **GitHub Copilot CLI** | GitHub Copilot CLI | `copilot --acp` |

**Pasos:**
1. Instala el agente y asegúrate de que esté accesible en el `PATH` de tu terminal.
2. Ábrelo una vez en la terminal para iniciar sesión con tu cuenta.
3. En {{APP_NAME}}, abre **Conectar una IA**; el agente aparecerá como disponible para **Conectar**.

- **Control total de permisos**: Cada vez que el agente intente leer, crear o modificar archivos, {{APP_NAME}} te solicitará confirmación explícita (Permitir una vez, Permitir siempre o Denegar).
- **Punto de restauración**: Al terminar cada turno, la aplicación muestra exactamente qué archivos cambiaron en disco, con opción de **Deshacer** en bloque o por archivo.
