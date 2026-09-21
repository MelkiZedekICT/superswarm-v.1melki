# Install Superswarm

Superswarm is a local application. Its operator console opens on `localhost`,
and model inference stays in Ollama on `127.0.0.1`. It does not require a paid
model API or hosted Superswarm service.

## Requirements

- Windows 10/11 or a current Ubuntu release
- Git, Bun 1.4 or newer, and Ollama
- At least 8 GB RAM; 16 GB is preferable
- A downloaded Ollama model that passes `superswarm local test`

The installer builds the original Overstory-style console and links the
`superswarm` and `ov` commands on the current machine. It does not download a
model or alter existing Ollama models.

## Windows

Open PowerShell in the cloned repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

## Ubuntu

```sh
./scripts/install.sh
```

## Initialize a project

In an existing Git repository:

```sh
superswarm init --yes
superswarm local status
superswarm local configure --model MODEL_TAG
superswarm local test --model MODEL_TAG
superswarm local qualify --model MODEL_TAG
superswarm serve
```

Open <http://127.0.0.1:7321>. Superswarm initializes local-only routing by
default. The imported cloud runtimes remain available in source for upstream
compatibility, but a local-mode project rejects role/helper overrides to them.

Do not assign a model to builder work until it passes a scoped edit fixture.
The model shown by `local test` has only passed text connectivity; see
[RESEARCH_GAPS.md](RESEARCH_GAPS.md) for the qualification standard.

## Uninstall the command

From this repository, run `bun unlink`. Project repositories and Ollama models
are not removed.
