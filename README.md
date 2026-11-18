# CheapClankers API integration examples

Minimal Node.js and Python chat-completions examples using the official OpenAI SDKs with a custom base URL. These are maintained by CheapClankers for its developer API service; this is not an official OpenAI repository or a consumer AI subscription.

Start with the [API setup documentation](https://cheapclankers.com/docs). Review the [model catalogue](https://cheapclankers.com/models) and [published pricing](https://cheapclankers.com/pricing) before a real request. Both working examples are included below, so you can follow the setup without an additional tutorial.

For visual automation, use the [importable n8n workflow](n8n/README.md). It checks model access before one capped chat request and includes an actual n8n import/execution test against a local fixture.

## Prerequisites

Use Node.js 22 or later and Python 3.9 or later, with npm and pip. The package pins the JavaScript SDK to 7.60.0 and Python SDK to 2.24.0. Local verification also needs both runtimes. Create an account, verify it and create a server-side API key before a real request. Choose an enabled model whose catalogue entry supports **chat**; exact model IDs, availability and rates can change. The model returned for your key establishes access, not current availability or support for every protocol.

## Install

```sh
npm install
python -m venv .venv
```

Activate the Python environment, then install its SDK:

```sh
# Bash / zsh
source .venv/bin/activate
python -m pip install -r requirements.txt
```

```powershell
# PowerShell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

If your environment does not permit activation, invoke `.venv/bin/python` or `.venv\Scripts\python.exe` directly and set `PYTHON_BIN` to that executable when running the tests.

## Configure a real request

Replace the placeholders with your own key and an exact chat-capable model ID from the catalogue that your key can access. Variables must be present in the shell that launches the script.

```sh
export CLANKER_API_KEY="your_key_here"
export CLANKER_MODEL="your_enabled_chat_model_id"
```

```powershell
$env:CLANKER_API_KEY = "your_key_here"
$env:CLANKER_MODEL = "your_enabled_chat_model_id"
```

Do not commit credentials or put private keys in browser code. The default API root is `https://api.cheapclankers.com/v1`. The optional `CLANKER_BASE_URL` override exists for local fixtures; unset it for normal use. Credentials are sent to the configured endpoint.

Run either client:

```sh
node node-chat.mjs
python python_chat.py
```

Both clients first call `GET /v1/models`, stop if the selected ID is missing, then call `POST /v1/chat/completions`. With sufficient credit and an available chat model, expect:

```text
Model access confirmed: <your selected model>
Reply: <a short greeting>
```

The exact reply varies. Real requests consume prepaid USD credit; the 128-token output cap is not a cost estimate. Automatic SDK retries are disabled and the timeout is 30 seconds. Check dashboard usage before manually retrying a timeout or error: an interrupted request can still incur usage.

## Troubleshooting

| Result                          | Check                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Missing environment message     | Set both variables in the current shell.                                                           |
| Selected model was not returned | Check the exact ID and the key's permitted models. No completion is sent by the example.           |
| 401                             | Missing, invalid, revoked or expired credentials.                                                  |
| 403                             | Restricted key or model access.                                                                    |
| 404 / unavailable response      | Current model status and chat protocol support. A model may support Messages or Responses instead. |
| 402                             | Available wallet credit and published rates.                                                       |
| 429                             | Rate limits; inspect Retry-After and usage before deliberately retrying.                           |
| Timeout / server error          | Keep the request ID and review usage before retrying.                                              |

Use the [reproducible SDK error matrix](sdk-error-matrix.md) to distinguish a failed model-list request from a failed completion, and reproduce the examples' behavior without buying inference.

These examples cover chat completions, not the Responses API, Claude Code, streaming or every upstream feature. SDKs and endpoint behavior can change; review the [Node SDK](https://github.com/openai/openai-node#readme) and [Python SDK](https://github.com/openai/openai-python#readme) documentation when updating dependencies.

## Local verification without paid inference

After installing both SDKs, run:

```sh
npm test
```

The harness replaces all `CLANKER_*` credentials/model/endpoint settings in its child processes with fixtures and uses a loopback-only HTTP server. It does not load a `.env` file or contact a production model. If Python is not named `python` on your machine, set `PYTHON_BIN` to its executable (for example, `export PYTHON_BIN=python3`).

Twenty-two checks cover the two SDKs: successful chat, missing environment, absent model, 401/403/404/429 during model listing, and 402/404/429/503 during completion. Request counts confirm that failures do not trigger automatic retries, including 429 responses carrying Retry-After. The harness also checks the bearer header, request IDs, versioned API paths and payload. Passing checks do not establish live model availability or production inference success.
