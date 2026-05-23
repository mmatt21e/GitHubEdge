# GitHubEdge

A GitHub Desktop-style Git client for Windows with built-in support for **any LLM** —
local (Ollama) or paid (OpenAI / OpenAI-compatible, Anthropic, or a custom endpoint).
Built with Electron + React + TypeScript.

## Features (foundation)

- Manage multiple repositories: add local repos or clone by URL
- Changes view: stage/unstage files, discard, view diffs, commit
- Push / pull / fetch with ahead-behind tracking
- Branch list, switch, and create
- Commit history
- **AI commit messages** generated from your staged diff using your chosen model
- Configure multiple AI providers; keys are stored locally only

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
