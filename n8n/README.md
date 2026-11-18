# n8n: check model access before sending a chat request

An importable workflow maintained by CheapClankers. It lists the models accessible to your key, checks your selected ID, and sends one chat-completions request capped at 128 output tokens. An absent model stops the workflow before inference. HTTP failures stop execution; automatic node retries are off.

[Download the workflow JSON](model-access-chat.json). See the [API documentation](https://cheapclankers.com/docs), [model catalogue](https://cheapclankers.com/models) and [published pricing](https://cheapclankers.com/pricing).

## Import and configure

1. Import `model-access-chat.json` into n8n using its workflow import-from-file option. This creates an inactive, manually triggered workflow with a setup note.
2. Create a **Header Auth** credential with header name `Authorization` and value `Bearer YOUR_API_KEY`. Select that credential on **both** HTTP Request nodes. The public export contains no credential IDs or keys. Store your key in n8n's credential manager, not in the JSON or a Set node.
3. In **Configure request**, replace `REPLACE_WITH_ENABLED_CHAT_MODEL_ID` with an exact model ID accessible to your key that supports chat completions. The API root defaults to `https://api.cheapclankers.com/v1`. Credentials are sent to this root: change it only to an endpoint you trust.
4. Run manually. **List accessible models** calls `/models`. If the ID appears, **Send one capped chat** calls `/chat/completions` and its output contains `choices[0].message.content` on success.

A listed model establishes access, not availability or support for every protocol. A model supporting only Messages or Responses cannot be used for this chat example. Real inference consumes prepaid USD usage credit; 128 output tokens is a cap, not a cost estimate. The timeout is 30 seconds. Review usage before retrying a failed or interrupted request because it can still incur usage.

| Failure | Next check |
| --- | --- |
| Missing credential | Select the Header Auth credential on both HTTP nodes. |
| Selected model absent | Exact ID and the key's model permissions. No chat request is sent. |
| 401 / 403 | Key validity, revocation and permissions. |
| 402 | Wallet credit and published rates. |
| 404 / 503 / timeout | Current availability, chat support and API root. Review usage before retrying. |

The workflow disables saved successful/error/manual executions in its settings. Review your instance's logging, retention and access controls before processing private prompts. It is a manual setup example, not an unattended production retry or billing system.

## Reproduce the local checks

Requires Docker and Python 3.9+. From this directory:

```sh
python verify.py
```

The test uses the official n8n 2.48.5 Docker image pinned by digest. Docker may download it on first use. It creates a uniquely named temporary container with **no network access or published ports**, starts a loopback mock API inside it, imports a dummy Header Auth credential and the workflow, and executes four cases through the actual n8n CLI. It removes the container and temporary files afterward. No live key, production endpoint or paid inference is used.

Verified on 2026-11-18 with Docker 28.0.1 and n8n 2.48.5:

- Successful access check and one capped chat request.
- Absent model: explicit stop, zero chat requests.
- Restricted key (403): execution stops, zero chat requests.
- Unavailable upstream (503): exactly one chat request, no automatic retry.

The harness checks bearer authentication, endpoint paths and the complete chat payload. These checks establish import and execution against fixtures, not production inference, streaming, agent tools or compatibility with other n8n versions. No official n8n template-directory listing or endorsement is claimed.

Official references: [workflow sharing and import](https://docs.n8n.io/workflows/sharing/), [HTTP Request node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/), [CLI commands](https://docs.n8n.io/hosting/cli-commands/).
