# 🤖 Using an AI with DBV Markdown Reader

> 🌐 [Español](./IA.md) · **English** · [← Back to the README](../README.en.md)

The AI assistant in DBV Markdown Reader is **optional**. If you connect nothing, the app works exactly as it always has: no process is started, no connection is opened, and the AI code is not even loaded. It exists on **desktop** only (Windows, Linux and macOS); it does not exist on Android.

This guide explains **what you need on your computer** depending on the AI you want to use, and what the assistant can do.

## The essentials in one table

| I want to use… | What I need to install or have | Does anything leave my computer? | Does it cost money? |
| --- | --- | --- | --- |
| **A local AI** (Ollama, LM Studio, llama.cpp…) | The server program and at least one downloaded model | No | No (it uses your CPU/GPU and disk) |
| **Claude, ChatGPT, Gemini or OpenRouter with an API key** | An API key from that provider | Yes, to the provider | Yes, per use, at the provider's rate |
| **My subscription** (Claude Pro/Max, ChatGPT Plus, Gemini, Copilot) | The service's **agent** installed and signed in: Claude Code, Codex, Gemini CLI or GitHub Copilot CLI | Yes, to the agent's service | Covered by your subscription |

> ⚠️ **A subscription is not an API key.** Paying for Claude Pro, ChatGPT Plus or Gemini does not give you an API key (those are bought separately). With a subscription, the way in is the **installed agent** (third row).

To get started, press the ✨ button in the top bar (or **Ctrl/Cmd + Shift + I**). If no AI is connected yet, **“Connect an AI”** opens: it detects what you already have (Ollama, LM Studio and the agents) and marks it with ✓; what it does not find appears with an install link. That detection only happens when you open that screen, never when the app starts.

Once connected, the assistant lives in the **“Assistant” tab** of the side panel, next to “Outline” and “Files”.

---

## What the assistant can do

The AI works with **the document you have open and its folder** (the same one the “Files” tab shows). It sees nothing outside it. If you open a remote document (by URL) there is no local folder, and the assistant waits until you open a local one.

- **Chat about your document.** The panel shows, as chips you can remove, what is about to be sent: the document, the selection, the outline, the documents in the folder. Type `@` to mention another `.md` in the folder, or press **“Attach the visible section”**. In the “Files” tree, right-click → **“Add to the AI conversation”**.
- **Propose changes, which you review.** When the AI wants to modify or create documents, it shows a card with the differences **hunk by hunk**: you can accept or reject each hunk, tweak the text, and see whether the proposal introduces problems (an unclosed code block, an unpaired `$$`, a link to a file that does not exist). When applied, the change to the open document **is made in the editor** like any other edit: you can undo it with **Ctrl+Z**, and the document stays “Modified” until you save it yourself with **Ctrl+S**. Nothing is written to disk behind the editor's back.
- **Inline AI on text.** In **Edit Mode**, select some text (or leave the cursor in a paragraph), right-click → **“AI: actions on the text…”** or **Ctrl/Cmd + Alt + I**: improve the writing, fix spelling and grammar, translate to Spanish or English, shorten, expand, convert to a table or a list, explain, or ask for something in your own words. You see the result as a difference (what goes out and what comes in) and choose **Accept**, **Reject** or **Retry**. If the result loses a link, a formula or a code block, the app warns you before you accept.

What it does **not** do: it does not rename or delete files, and direct models do not run programs or access the internet on their own.

---

## 1. A local AI (nothing leaves your computer)

This is the most private option: your documents never leave your computer and there is no cost per use. In exchange, quality depends on the model size and your hardware.

### Ollama

1. Install [Ollama](https://ollama.com/download).
2. Download a model, for example: `ollama pull qwen2.5:7b` (or `llama3`). Check what you have with `ollama list`.
3. In the app: **✨ → Connect an AI**. If Ollama is running, it appears with ✓ and a **Use** button. Pick the model from the list, press **Test connection** and **Save**.

Ollama listens on `http://localhost:11434`. The app sets the context size itself, because Ollama defaults to a small one (2,048–4,096 tokens) and silently trims what does not fit.

### LM Studio

1. Install [LM Studio](https://lmstudio.ai), download a model and **start its local server** (*Developer / Local Server* tab).
2. It listens on `http://localhost:1234`; the app detects it just like Ollama.

### Your own OpenAI-compatible server (llama.cpp, vLLM, Jan…)

Any server offering the OpenAI API works. The typical case is `llama-server` from [llama.cpp](https://github.com/ggml-org/llama.cpp). **The assistant does not detect this server: you have to add it by hand.**

1. **Connect an AI → Add a cloud AI (API key)…** *(the button has that name, but it opens a form with all providers)*.
2. Under **Provider**, choose **OpenAI-compatible server (local or your own)**. ⚠️ **Do not choose “Ollama”** for a server that is not Ollama: it uses a different protocol.
3. Fill in the form:

   | Field | Value |
   | --- | --- |
   | Name | whatever you like |
   | Address | `http://127.0.0.1:8080/v1` (your server's port, **ending in `/v1`**) |
   | Key | empty, unless you started the server with `--api-key` |
   | Model | the `id` returned by `curl http://127.0.0.1:8080/v1/models` |
   | Context (tokens) | the server's `n_ctx` divided by its *slots* |
   | Tools | *Detect* |

4. **Test connection** and **Save**.

**Three common llama.cpp traps:** (1) `/v1/models` shows `n_ctx_train`, the maximum the model was trained with, **not** your server's (that is the `-c` flag); (2) with several *slots* (`-np`), the context is split between them: with `-np 4` and `-c 32768`, each request gets 8,192; (3) models that “think” can look mute while they reason: start the server with `--reasoning-budget 0`.

### What to expect from a local model

- **Tools.** With a model that supports them, the AI reads the documents in the folder by itself and proposes changes that the app **checks in memory** before showing them to you. Without tools, the assistant is good for chatting and working with the context it is sent; changes are requested in text blocks that the app turns into a proposal.
- **Size.** Models of 2–3 billion parameters answer fast on a laptop, but fall short on long documents or complex proposals. If answers come out weak, try a bigger model before touching the settings.
- **Context.** 4,096 tokens is the minimum and falls short with long documents. 8,192 is comfortable; 32,768, roomy. A bigger model or a larger context needs more RAM or VRAM.

---

## 2. In the cloud, with your API key

| Provider | Where to get the key | Address (pre-configured) |
| --- | --- | --- |
| Anthropic (Claude) | Anthropic console | `https://api.anthropic.com/v1` |
| OpenAI (ChatGPT) | OpenAI platform | `https://api.openai.com/v1` |
| Google (Gemini) | Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai` |
| OpenRouter | openrouter.ai | `https://openrouter.ai/api/v1` |

**Connect an AI → Add a cloud AI (API key)…** → pick the provider → paste the key → **Test connection** → pick the model from the list the provider itself returns → **Save**.

- **The key** is stored in the **system credential store** (Windows Credential Manager, macOS Keychain, Secret Service on Linux), never in a file or in `localStorage`. When you edit a connection the key field is left empty: leaving it that way keeps the saved one. Deleting the connection also deletes the key.
- **Privacy:** to answer, the context you see in the panel (the open document, the selection and whatever you attach) is sent to the provider. **The first time per folder and provider, the app asks you** before sending anything.
- **Cost:** billed by the provider, per use.

---

## 3. With your subscription: installed agents

If you pay for **Claude Pro/Max, ChatGPT Plus, Gemini or GitHub Copilot**, you do not need an API key: the app can talk to that service's **command-line agent**, which uses your account. The app **never sees or stores your credentials**: signing in is done by the agent itself.

| Agent | What must be installed | How the app launches it |
| --- | --- | --- |
| **Claude Code** | Claude Code and **Node.js** (includes `npx`) | `npx -y @agentclientprotocol/claude-agent-acp` |
| **Codex** (OpenAI) | Codex and **Node.js** (includes `npx`) | `npx -y @zed-industries/codex-acp` |
| **Gemini CLI** | Gemini CLI | `gemini --experimental-acp` |
| **GitHub Copilot CLI** | Copilot CLI | `copilot --acp` |

Install links: [Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup) · [Codex](https://github.com/openai/codex) · [Gemini CLI](https://github.com/google-gemini/gemini-cli) · [Copilot CLI](https://docs.github.com/copilot/how-tos/set-up/install-copilot-cli) · [Node.js](https://nodejs.org).

**Steps:** (1) install the agent (and Node.js if it needs it) so it is on your `PATH`; (2) **open it once in a terminal** and sign in with your account; (3) in the app, **Connect an AI**: the agent shows up with ✓ *installed* and a **Connect** button. The first time can take a while as its adapter is downloaded with `npx`.

**How it works:**

- The app launches the agent **with the document's folder as its working directory**; it is closed when you close the window or stop it from the panel.
- **Permissions:** every time the agent asks for permission to do something (run a command, edit, read), the app shows you what it asks for. You can **Allow once**, **Allow always in this conversation** or **Deny**. Nothing is approved on its own, and anything outside the folder is denied.
- **Safety of your files:** before each turn, a **restore point** of the folder's `.md` files is saved. What the agent changes directly on disk shows up at the end under **“The agent changed N documents on disk”**, with their differences and **Undo** per file. If it changes the document you have open with unsaved changes, the usual conflict rules apply (you are warned).

---

## Privacy at a glance

| Route | What leaves your computer |
| --- | --- |
| Local AI | Nothing. The conversation never leaves your machine. |
| Cloud API | The context that is sent, to the provider. You are asked the first time per folder and provider. |
| Agent with a subscription | Whatever the agent sends to its service. The app does not control its network; the permissions do go through the app. |

The tools of direct models **do not access the network or run programs**: they only read the document's folder and propose changes that you review. **Document contents are treated as data, not as orders**: if you open a third party's `.md` that says “ignore your instructions”, the assistant must not obey it (and even so, nothing is applied without your review). Conversations are saved in the app's data folder, **never next to your documents**; you can delete them from the panel. More detail in the [privacy policy](./privacidad.html).

## Common problems

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| I type and **nothing answers** (own server) | Provider set to *Ollama* instead of *OpenAI-compatible* | Create a new connection with the right provider |
| Empty answer and many “received” tokens | The model reasons and never writes the answer | Start the server with `--reasoning-budget 0` |
| “Local server is off” | Ollama, LM Studio or your server is not running | Start it and **Test connection** again |
| Address error or 404 with an own server | Missing `/v1` at the end of the address | `http://127.0.0.1:PORT/v1` |
| Invalid key | Key pasted wrongly or from another provider | Paste it again; a subscription does not work as a key |
| An agent does not show up or will not connect | Not on the `PATH`, Node.js missing, or not signed in | Install it, open it once in a terminal and open **Connect an AI** again |
| The assistant says “Open a local document” | The open document is remote (URL) or there is none | Open a `.md` from your disk |
| Inline AI does nothing | You are not in **Edit Mode** (Ctrl+E) | Enter Edit Mode and select some text |
| The model forgets the start of the document | Context too small | Raise the server's context and the **Context (tokens)** field |

---

> This guide describes version **0.18.0**. The full specification is in [`RF-31`–`RF-36` of SPECIFICATIONS.md](../dbv-specs-ops/docs/SPECIFICATIONS.md).
