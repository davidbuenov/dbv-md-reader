# 🤖 Using an AI with {{APP_NAME}}

> 🌐 [Español](./IA.md) · **English** · [← Back to the README](../README.md)

The AI assistant in **{{APP_NAME}}** is **completely optional**. Without configuring any AI, the application works exactly as it always has: 100% offline, local and private. This guide explains **what you need on your machine** depending on the AI model you choose.

## The essentials in one table

| I want to use… | What I need to install or have | Does anything leave my machine? | Does it cost money? |
| --- | --- | --- | --- |
| **A local AI** (Ollama, LM Studio, llama.cpp…) | The server application and at least one downloaded model | **No** | No (uses your own CPU/GPU and RAM) |
| **Claude, ChatGPT, Gemini or OpenRouter with an API key** | An API key from that provider | Yes, to the selected provider | Yes, pay-per-use at provider rates |
| **My monthly subscription** (Claude Pro/Max, ChatGPT Plus, Gemini, Copilot) | The official **installed agent** signed in: Claude Code, Codex, Gemini CLI, or Copilot CLI | Yes, to the agent's service | Covered by your monthly subscription |

> ⚠️ **A subscription is not an API key.** Subscribing to Claude Pro, ChatGPT Plus, or Gemini does not grant an API key (those are purchased separately on developer consoles). With an active subscription, the recommended route is the **installed agent** (third row).

To open the connection assistant in the app: click the **AI** button on the top toolbar or press `Ctrl+Shift+I` (`Cmd+Shift+I` on macOS).

---

## 1. A local AI (nothing leaves your computer)

This is the most private option: your data never leaves your computer and there is zero usage cost. Quality and speed depend on your hardware and chosen model size.

### Ollama
1. Download and install [Ollama](https://ollama.com/download).
2. Download a model from your terminal, for example:
   ```bash
   ollama pull qwen2.5:3b
   ```
3. In {{APP_NAME}}, open **Connect an AI**. If Ollama is running, it will appear with a green checkmark and a **Use** button.
4. Pick the model, click **Test connection**, and **Save**.

### LM Studio
1. Install [LM Studio](https://lmstudio.ai), download your model, and start the local server (*Local Server* on default port `1234`).
2. {{APP_NAME}} will automatically detect it.

---

## 2. In the cloud, with your API key

If you prefer the reasoning power of frontier models with an **API key**:

| Provider | Where to get the key |
| --- | --- |
| **Anthropic (Claude)** | Anthropic Console |
| **OpenAI (ChatGPT)** | OpenAI Platform |
| **Google (Gemini)** | Google AI Studio |
| **OpenRouter** | openrouter.ai |

1. Open **Connect an AI → Add a cloud AI (API key)...**
2. Choose your provider and paste your key.
3. Click **Test connection**, pick a model from the list, and click **Save**.

- **Secure Credential Store**: The API key is stored securely in your operating system's native credential manager (Windows Credential Manager, macOS Keychain, or Linux Secret Service). It is never stored in plain text files or browser local storage.

---

## 3. With your subscription: installed agents (ACP)

If you have an active **Claude Pro/Max, ChatGPT Plus, or GitHub Copilot** subscription, you can connect directly to the official command-line tool via the Agent Client Protocol (ACP):

| Agent | Requirements | Launch Command |
| --- | --- | --- |
| **Claude Code** | Claude Code and [Node.js](https://nodejs.org) | `npx -y @agentclientprotocol/claude-agent-acp` |
| **Codex (OpenAI)** | Codex and Node.js | `npx -y @zed-industries/codex-acp` |
| **Gemini CLI** | Gemini CLI | `gemini --experimental-acp` |
| **GitHub Copilot CLI** | GitHub Copilot CLI | `copilot --acp` |

**Steps:**
1. Install the agent and make sure it is in your system `PATH`.
2. Open it once in a terminal to authenticate with your account.
3. In {{APP_NAME}}, open **Connect an AI**; the agent will appear as detected and ready to **Connect**.

- **Granular Permissions**: Every time the agent requests to read, write, or execute, {{APP_NAME}} prompts you for explicit approval (Allow once, Always allow, or Deny).
- **Restoration Snapshot**: After each agent turn, the application detects disk changes and provides a full diff with an atomic **Undo** button.
