# GitHubEdge

A GitHub Desktop-style Git client for Windows with built-in support for **any LLM** —
local (Ollama) or paid (OpenAI / OpenAI-compatible, Anthropic, or a custom endpoint).
Built with Electron + React + TypeScript.

## Features

- Manage multiple repositories: create new, add local, clone by URL, or clone from your GitHub account
- Repository actions: open in file explorer / terminal, view on GitHub, copy path
- Changes view: stage/unstage, discard (single or all), syntax-highlighted diffs, commit, amend, and undo last commit
- Push / pull / fetch with ahead-behind tracking
- Branch list, switch, create, rename, delete, and **merge** with an inline 3-way conflict editor (use ours/theirs/both or edit directly)
- Commit history with syntax-highlighted per-commit file diffs
- Stash save / pop / drop
- **GitHub sign-in** (personal access token or OAuth device flow): authenticated push/pull/clone, browse & clone your repos, create a repo and publish it, and pull requests with CI checks, review conversation, create, and local checkout
- **AI commit messages** streamed from your chosen model
- Configure multiple AI providers
- Secrets (GitHub token, provider API keys) are encrypted at rest with the OS secure-storage backend (Windows DPAPI / macOS Keychain / Linux libsecret) and never sent to the UI — saved keys show as "leave blank to keep"
- Keyboard shortcuts: Ctrl/Cmd+Enter commit, F5 refresh, Ctrl/Cmd+, settings, Ctrl/Cmd+1/2/3 tabs, Esc closes dialogs

## GitHub sign-in

Click the account button in the top-right and either:

- **Paste a personal access token** (github.com → Settings → Developer settings → Tokens; needs `repo` scope), or
- **Use OAuth device flow** — register a GitHub OAuth App with device flow enabled, paste its Client ID, then enter the shown code on github.com.

The token is stored locally and used for HTTPS git operations and the GitHub API.

## Requirements

- [Node.js](https://nodejs.org/) 18+ and npm
- [Git](https://git-scm.com/) installed and on your `PATH`
- (Optional) [Ollama](https://ollama.com/) for local models, or an API key for a hosted provider

## Develop

```bash
npm install
npm run dev
```

## Type-check

```bash
npm run typecheck
```

## Build a Windows installer

```bash
npm run build:win
```

The installer is written to `dist/`. To produce an unpacked build for quick testing:

```bash
npm run build:unpack
```

## Configuring AI models

Open **Settings** (gear icon, top-right) and add a provider:

| Provider type | Base URL (default) | Notes |
| --- | --- | --- |
| Local (Ollama) | `http://localhost:11434` | No key. Set the model name, e.g. `llama3.1`. |
| OpenAI / compatible | `https://api.openai.com/v1` | Works with LM Studio, vLLM, OpenRouter, Together, etc. via a custom base URL. |
| Anthropic (Claude) | `https://api.anthropic.com/v1` | Set the model, e.g. `claude-3-5-sonnet-latest`. |
| Custom | — | OpenAI-compatible `/chat/completions`; add any extra headers. |

Pick the **active** provider with the radio button — it powers the "AI message" button
in the Changes view.

## Project layout

```
src/
  main/        Electron main process (git engine, LLM clients, IPC, settings store)
  preload/     Secure contextBridge API exposed to the renderer
  renderer/    React UI
  shared/      Types shared across processes
```
