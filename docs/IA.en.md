# 🤖 Using an AI with DBV Markdown Reader

> 🌐 [Español](./IA.md) · **English** · [← Back to the README](../README.en.md)

The AI assistant in **DBV Markdown Reader** is **optional**. With nothing configured, the application works exactly the same, locally. This guide explains **what you need on your computer** depending on the AI you want to use.

## The essentials in one table

| I want to use… | What I need to install or have | Does anything leave my computer? | Does it cost money? |
| --- | --- | --- | --- |
| **A local AI** (Ollama, LM Studio, llama.cpp…) | The server program and at least one downloaded model | No | No (it uses your CPU/GPU and disk) |
| **Claude, ChatGPT, Gemini or OpenRouter with an API key** | An API key from that provider | Yes, to the provider | Yes, pay-per-use at the provider's rates |
| **My subscription** (Claude Pro/Max, ChatGPT Plus, Gemini / Google One, Copilot) | That service's **agent** installed and signed in: Claude Code, Codex, Gemini CLI, Google Antigravity or GitHub Copilot CLI | Yes, to the agent's service | Covered by your subscription |

> ⚠️ **A subscription is not an API key.** Paying for Claude Pro, ChatGPT Plus or Gemini does not give you an API key (those are bought separately). With a subscription, the route is the **installed agent** (third row).

Everything is set up on the **Connect an AI** screen, which opens from the application's AI button. When it opens, DBV Markdown Reader **detects what you already have** (Ollama, LM Studio and the agents) and marks it with ✓; anything it does not find appears with a **How to install** button. This detection only happens when you open that screen, never when the application starts.

The screen has three blocks, one per row of the table: **Local AIs (100% Offline)**, **Subscription AIs (CLI Agents)** and **Cloud AIs with API Key**.

---

## 1. A local AI (nothing leaves your computer)

This is the most private option: your documents never leave your machine and there is no per-use cost. In exchange, quality depends on the size of the model and on your hardware.

### Ollama

1. Install [Ollama](https://ollama.com/download).
2. Download a model, for example: `ollama pull qwen2.5:3b` (or `llama3`).
3. Check what you have installed with `ollama list`.
4. Open **Connect an AI**. If Ollama is running, it appears with ✓ and a **Use** button. Pick the model from the list, press **Test connection** and **Save**.

Ollama listens on `http://localhost:11434`. The application talks to it through its **native API** (`/api/chat`) and sets the context size itself, because Ollama defaults to a small one (2,048–4,096 tokens) and silently truncates whatever does not fit.

### LM Studio

1. Install [LM Studio](https://lmstudio.ai), download a model and **start its local server** (*Developer / Local Server* tab).
2. It listens on `http://localhost:1234`; the application detects it just like Ollama.

### Your own OpenAI-compatible server (llama.cpp, vLLM, Jan…)

Any server that offers the OpenAI API will do. The typical case is `llama-server` from [llama.cpp](https://github.com/ggml-org/llama.cpp) with a `.gguf` model you downloaded yourself. **This kind of server is not detected automatically: you have to add it by hand.**

1. **Connect an AI → Add a cloud AI (API key)…** *(that is the button's name, but it opens a form with every provider)*.
2. Under **Provider**, choose **OpenAI-compatible server (local or your own)**.
   - ⚠️ **Do not choose "Ollama"** for a server that is not Ollama: that mode uses a different protocol and the application will not understand the reply. Also, the provider of an existing connection **cannot be changed when editing**: create a new one instead.
3. Fill in the form:

   | Field | Value |
   | --- | --- |
   | Name | whatever you like |
   | Address | `http://127.0.0.1:8080/v1` (your server's port, **ending in `/v1`**) |
   | API key | empty, unless you started the server with `--api-key` |
   | Model | the `id` returned by `curl http://127.0.0.1:8080/v1/models` |
   | Context (tokens) | the server's `n_ctx` divided by its slots (see below) |
   | Tools | *Detect* |

4. **Test connection** and **Save**. Make the connection active and pick it in the panel's selector.

The form values (model, context, tools) can be looked up with a few commands: see [Finding out the form values](#finding-out-the-form-values).

**Three common llama.cpp pitfalls:**

- **The context is not `n_ctx_train`.** `/v1/models` shows `n_ctx_train`, the maximum the model was trained with, not what your server has. The real value is the `-c` flag you started it with.
- **Slots split the context.** With several slots (`-np`), the context is divided among them; with `-np 4` and `-c 32768`, each request gets 8,192. To give a single conversation all of it: `-np 1`.
- **"Thinking" models can look mute.** Some models first write their reasoning into a separate field (`reasoning_content`) and leave the answer (`content`) empty until they finish. The application shows `content`, so you see an empty reply while the model burns hundreds or thousands of tokens. Start the server with `--reasoning-budget 0` to turn reasoning off.

A reasonable launch example:

```bash
llama-server -m model.gguf -c 32768 -np 1 --reasoning-budget 0 --port 8080
```

### What to expect from a local model

- **Tools.** With a model that supports them, the AI looks through the documents in the folder on its own and proposes changes that you review before they are applied. Without tools, the assistant is still useful for conversation and for working on the context it is sent, but it does less by itself. The form's *Tools* field detects them; if detection fails, you can force it to *Yes* or *No*.
- **Size.** Models of 2–3 billion parameters (around 2–3 GB) answer quickly on a laptop but fall short on long or complex proposals. If answers come out weak, try a larger model before touching the configuration.
- **Context.** A 4,096-token context is the bare minimum and falls short with long documents or images. 8,192 is comfortable for working; 32,768, generous.
- **Memory.** A bigger model or a larger context needs more RAM or VRAM. Start small and scale up.

---

## Finding out the form values

To connect a local AI, the form asks for three things: **model**, **context** and whether it supports **tools**. You look them up on your own computer with the commands below, and the result is what goes into each field.

> In **PowerShell**, use `curl.exe` (with the extension): plain `curl` is an alias for a different command and does not return the same thing. In CMD, macOS and Linux, `curl` works.

### Ollama (port 11434)

| I want to know… | Command | Form field |
| --- | --- | --- |
| Which models I have downloaded | `ollama list` | **Model**: the full `NAME` column (for example `qwen2.5:3b`; `llama3:latest` also works as `llama3`) |
| The same, through the API | `curl http://localhost:11434/api/tags` | — |
| Which models are loaded in memory right now | `ollama ps` | — |
| Details of a model (architecture, parameters, maximum context, quantization) | `ollama show qwen2.5:3b` | **Context**: the maximum shown is the model's; choose a value equal to or lower than what fits in your memory |
| Download a new model | `ollama pull qwen2.5:3b` | — |

The application **sets the context itself** with Ollama, so the *Context* field is what you decide, not whatever Ollama has configured. If you leave it empty, it uses a safe default (4,096).

### LM Studio (port 1234)

With its local server running:

```bash
curl http://localhost:1234/v1/models      # each model's "id" → Model field
lms ls                                    # downloaded models (if you have its `lms` tool installed)
```

The context is set in LM Studio when the model is loaded (*Context Length* setting); copy that number into the form.

### Your own server with llama.cpp (`llama-server`)

With the server running (the default port is `8080`):

```bash
curl http://127.0.0.1:8080/v1/models      # "data" → "id": model name → Model field
curl http://127.0.0.1:8080/props          # context, slots and capabilities
```

And in PowerShell, ready to use:

```powershell
# Model name → Model field
(curl.exe -s http://127.0.0.1:8080/v1/models | ConvertFrom-Json).data.id

# Context, slots, tools and images
$p = curl.exe -s http://127.0.0.1:8080/props | ConvertFrom-Json
"n_ctx=$($p.default_generation_settings.n_ctx)  slots=$($p.total_slots)  tools=$($p.chat_template_caps.supports_tools)  vision=$($p.modalities.vision)"
```

| Value returned | What it means | Form field |
| --- | --- | --- |
| `id` in `/v1/models` | Model name (usually the `.gguf` file) | **Model** |
| `n_ctx` in `/props` | The server's **total** context (the `-c` flag) | **Context (tokens)**, divided by `total_slots` |
| `total_slots` in `/props` | Parallel slots: each request gets `n_ctx / total_slots` (with 4 slots and 32,768, that is 8,192). With `-np 1`, all of it | Divide `n_ctx` by this number (see "Three common llama.cpp pitfalls", above) |
| `supports_tools` in `/props` | Whether the model supports tools | **Tools**: leave it on *Detect*; force it to *No* if you see it fail |
| `vision` in `/props` | Whether the server has vision (`--mmproj`) | — |
| `n_ctx_train` in `/v1/models` | The context the model was **trained** with: **not the server's** | Do not use it |

### The "Test connection" button

It is the definitive check: if the server answers and the address is right, it returns the real list of models. For Ollama and LM Studio, that list appears in the **Model** field's drop-down; for your own server, check that the name you type is one of those returned by `/v1/models`.

---

## 2. In the cloud, with your API key

To use a provider's model with an **API key**:

| Provider | Where to get the key | Address (already preset) |
| --- | --- | --- |
| Anthropic (Claude) | Anthropic console | `https://api.anthropic.com/v1` |
| OpenAI (ChatGPT) | OpenAI platform | `https://api.openai.com/v1` |
| Google (Gemini) | Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai` |
| OpenRouter | openrouter.ai | `https://openrouter.ai/api/v1` |

**Connect an AI → Add a cloud AI (API key)…** → choose the provider → paste the key → **Test connection** → choose the model from the list the provider itself returns → **Save**.

- **The key** is stored in the **system credential store** (Windows Credential Manager, macOS Keychain, Secret Service on Linux), never in a file or in `localStorage`. When you edit a connection, the key field is empty: leaving it that way keeps the stored one. Deleting the connection also deletes the key.
- **Privacy:** to answer, the context (open document, selection and whatever you attach) is sent to the provider. **The first time per project and provider, the application asks you** before sending anything. You can remove any item from the context in the panel itself.
- **Cost:** billed by the provider, per use.

---

## 3. With your subscription: installed agents

If you pay for **Claude Pro/Max, ChatGPT Plus, Gemini / Google One or GitHub Copilot**, you do not need an API key: DBV Markdown Reader can talk to that service's **command-line agent**, which uses your account. The application **never sees or stores your credentials**: the agent itself does the sign-in. The connection uses the open [ACP (Agent Client Protocol)](https://agentclientprotocol.com).

| Agent | What must be installed | How the application launches it |
| --- | --- | --- |
| **Claude Code** | Claude Code and **Node.js** (includes `npx`) | `npx -y @agentclientprotocol/claude-agent-acp` |
| **Codex** (OpenAI) | Codex and **Node.js** (includes `npx`) | `npx -y @agentclientprotocol/codex-acp` |
| **Gemini CLI** | Gemini CLI | `gemini --acp` |
| **Google Antigravity** | Antigravity CLI (`agy`) **and its ACP server** (`agy_acp_server`, installed separately: [see below](#google-antigravity-installing-its-acp-server)) | `agy_acp_server` |
| **GitHub Copilot CLI** | Copilot CLI (the `copilot` command that comes with VS Code is **not enough**: [see below](#github-copilot-vs-codes-copilot-command-is-not-the-cli)) | `copilot --acp` |

Install links: [Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup) · [Codex](https://github.com/openai/codex) · [Gemini CLI](https://github.com/google-gemini/gemini-cli) · [Antigravity CLI](https://antigravity.google/product/antigravity-cli) · [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli) · [Node.js](https://nodejs.org).

**Steps:**

1. Install the agent (and Node.js if it needs it) so that it is on your system's `PATH`.
2. **Open it once in a terminal** and sign in with your account. The application cannot sign in for you.
3. Open **Connect an AI**. The agent appears under **Subscription AIs** with ✓ *installed* and a **Connect** button.
4. The first time may take a while: for Claude Code and Codex, their adapter is downloaded with `npx`.
5. If the agent asks you to **sign in** when it connects (Antigravity and Codex may ask the first time), the application requests it with the agent's usual method (for example *Log in with Google* or *Login with ChatGPT*): if a browser opens, finish there. The agent itself keeps the session.
6. Optional: once the agent is connected, the **⚙️** button lets you pick the **model** and **reasoning level**. The list is asked from the agent itself the first time you open the screen; **🔄** asks again. Next to the agent's name you will see a summary of the chosen model and level.

### GitHub Copilot: VS Code's `copilot` command is not the CLI

VS Code with Copilot puts a `copilot` command on the `PATH` that is **only a launcher**: it runs the Copilot CLI if it is installed and, if not, says *"GitHub Copilot CLI was not found"*. The application knows this and, when there is no CLI behind it, shows Copilot as *not installed*. Install the real CLI in any of these ways ([official guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli)):

| System | Command |
| --- | --- |
| Windows | `winget install GitHub.Copilot` |
| macOS and Linux | `brew install --cask copilot-cli` |
| Any (Node.js 22 or later) | `npm install -g @github/copilot` |

Then open it once with `copilot` in a terminal, sign in with your GitHub account and reopen **Connect an AI**.

### Google Antigravity: installing its ACP server

The Antigravity CLI (`agy`) **does not speak ACP on its own**: a separate program, **`agy_acp_server`**, does, and Google publishes it in the [ACP registry](https://github.com/agentclientprotocol/registry/blob/main/antigravity-acp/agent.json). If you only have `agy`, the application shows Antigravity as *installed, but without its ACP server* and it cannot be connected.

1. **Install [Antigravity CLI](https://antigravity.google/product/antigravity-cli)**, open it once with `agy` in a terminal and sign in with your Google account.
2. **Download the ACP server** for your system (version 1.4.4; the latest is always in the [registry](https://github.com/agentclientprotocol/registry/blob/main/antigravity-acp/agent.json)):

   | System | Download |
   | --- | --- |
   | Windows x64 | [agy-acp-server-1.4.4-windows-x86_64.zip](https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.4.4-windows-x86_64.zip) |
   | Windows ARM | [agy-acp-server-1.4.4-windows-arm64.zip](https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.4.4-windows-arm64.zip) |
   | macOS Apple Silicon | [agy-acp-server-1.4.4-darwin-arm64.zip](https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-1.4.4-darwin-arm64.zip) |
   | macOS Intel | [agy-acp-server-1.4.4-darwin-x86_64.zip](https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-1.4.4-darwin-x86_64.zip) |
   | Linux x64 | [agy-acp-server-1.4.4-linux-x86_64.zip](https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-1.4.4-linux-x86_64.zip) |
   | Linux ARM | [agy-acp-server-1.4.4-linux-arm64.zip](https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-1.4.4-linux-arm64.zip) |

3. **Unzip the whole archive** (it contains more than one file and they must stay together) into this folder, where the application looks for it:

   | System | Folder |
   | --- | --- |
   | Windows | `%LOCALAPPDATA%\agy\acp-server` |
   | macOS and Linux | `~/.local/share/agy-acp-server` |

   On **Windows**, from PowerShell (Windows x64; for ARM replace `x86_64` with `arm64`):

   ```powershell
   $zip = "$env:TEMP\agy-acp-server.zip"
   Invoke-WebRequest https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.4.4-windows-x86_64.zip -OutFile $zip
   Expand-Archive $zip -DestinationPath "$env:LOCALAPPDATA\agy\acp-server" -Force
   ```

   On **macOS or Linux** (replace the zip name with your system's):

   ```bash
   mkdir -p ~/.local/share/agy-acp-server && cd ~/.local/share/agy-acp-server
   curl -LO https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-1.4.4-darwin-arm64.zip
   unzip -o agy-acp-server-*.zip && chmod +x agy_acp_server.par
   ```

4. Reopen **Connect an AI**: Antigravity appears with ✓ *installed* and the **Connect** button.
5. The first time you write to it, the server asks to **sign in** and the application requests it with your Google account (*Log in with Google*): if a browser opens, finish there.

> Any other folder on your `PATH` works too. Third-party adapters that "wrap" `agy` are not supported: they rely on an undocumented `agy` mode and Google has not said whether its terms allow it.

**How it works:**

- The application launches the agent **with the document's folder as its working directory**; it is closed when you close the document or the application.
- **Permissions:** whenever the agent asks permission for something (run a command, edit, read), the application shows it to you with what it is asking for. You can **Allow once**, **Always allow in this conversation** or **Deny**. Nothing is approved on its own, and anything outside the folder is denied.
- **Safety for your files:** before each turn, the application saves a **restore point** of the folder's text files. Whatever the agent changes directly on disk shows up afterwards under the heading **"The agent changed N documents on disk"**, with its differences and **Undo** per file or all at once.

---

## Privacy at a glance

| Route | What leaves your computer |
| --- | --- |
| Local AI | Nothing. The conversation never leaves your machine. |
| Cloud API | The context that is sent, to the provider. You are asked the first time per project. |
| Agent with subscription | Whatever the agent sends to its service. The application does not control its network traffic; permissions do pass through it. |

The direct models' tools (local and API) **cannot reach the network or run programs**: they only read the folder and propose changes that you review hunk by hunk before applying them, with **Undo**.

## Common problems

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| I type and **nothing answers** (own server) | Provider set to *Ollama* instead of *OpenAI-compatible* | Create a new connection with the right provider |
| Empty reply and many tokens "received" | The model reasons and never gets to write `content` | Start the server with `--reasoning-budget 0` |
| "Local server not running" | Ollama, LM Studio or your server is not running | Start it and **Test connection** again |
| Address error or 404 with your own server | Missing `/v1` at the end of the address | `http://127.0.0.1:PORT/v1` |
| Invalid key | Key pasted wrongly or from another provider | Paste it again; a subscription does not work as a key |
| An agent does not appear or will not connect | It is not on the `PATH`, Node.js is missing or you have not signed in | Install it, open it once in a terminal and reopen **Connect an AI** |
| The agent says it needs Node.js | Claude Code and Codex use `npx` | Install [Node.js](https://nodejs.org) |
| Copilot shows *not installed* although `copilot` exists, or "GitHub Copilot CLI was not found" | Only VS Code's `copilot` launcher is there, without the CLI | Install the CLI: [instructions](#github-copilot-vs-codes-copilot-command-is-not-the-cli) |
| Antigravity shows *without its ACP server*, or "Antigravity needs its ACP server" | Only the `agy` CLI is installed | Install `agy_acp_server`: [instructions](#google-antigravity-installing-its-acp-server) |
| Codex answers "Internal error" | An old version of the application, with the `@zed-industries/codex-acp` adapter, which does not understand current models | Update the application: the current version uses `@agentclientprotocol/codex-acp` |
| The model forgets the start of the document | Context too small | Raise the server's context and the **Context (tokens)** field |

<!-- dbv-ia:fin-guia-comun · Everything above comes from dbv-specs-ops/docs/templates/IA.en.template.md (do not edit it here: change the template and sync with scripts/sync-ai.mjs). Whatever you put below is specific to this application and is kept. -->

## What the assistant can do

The AI works with **the document you have open and its folder** (the same one the “Files” tab shows). It sees nothing outside it. If you open a remote document (by URL) there is no local folder, and the assistant waits until you open a local one.

- **Chat about your document.** The panel shows, as chips you can remove, what is about to be sent: the document, the selection, the outline, the documents in the folder. Type `@` to mention another `.md` in the folder, or press **“Attach the visible section”**. In the “Files” tree, right-click → **“Add to the AI conversation”**.
- **Propose changes, which you review.** When the AI wants to modify or create documents, it shows a card with the differences **hunk by hunk**: you can accept or reject each hunk, tweak the text, and see whether the proposal introduces problems (an unclosed code block, an unpaired `$$`, a link to a file that does not exist). When applied, the change to the open document **is made in the editor** like any other edit: you can undo it with **Ctrl+Z**, and the document stays “Modified” until you save it yourself with **Ctrl+S**. Nothing is written to disk behind the editor's back.
- **Inline AI on text.** In **Edit Mode**, select some text (or leave the cursor in a paragraph), right-click → **“AI: actions on the text…”** or **Ctrl/Cmd + Alt + I**: improve the writing, fix spelling and grammar, translate to Spanish or English, shorten, expand, convert to a table or a list, explain, or ask for something in your own words. You see the result as a difference (what goes out and what comes in) and choose **Accept**, **Reject** or **Retry**. If the result loses a link, a formula or a code block, the app warns you before you accept.

What it does **not** do: it does not rename or delete files, and direct models do not run programs or access the internet on their own.

---

## How much the AI can do without asking you

In the Assistant header, **Autonomy** has three levels:

- **Ask before changes** (default): the AI reads the document and its folder and proposes changes, which you review before anything is written.
- **Read only**: the AI answers, explains and suggests, but cannot propose changes. If an agent tries to edit or run something, it is refused without asking you.
- **Ask for everything**: it also asks your permission before reading any document of the folder other than the open one. You can allow it once or for the whole conversation.

There is no "automatic" level: in DBV Markdown Reader **nothing is written without your review**, because someone else's `.md` could try to give the AI orders. With agents (Claude Code, Codex, Copilot…), the level controls what the agent **asks the app for**; the agent governs its own tools with its own settings.

If the window is not in front when the AI is waiting for your decision, its icon **flashes in the taskbar** (on macOS, it bounces in the Dock).
