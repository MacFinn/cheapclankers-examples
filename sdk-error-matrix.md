# Diagnose custom OpenAI base URL errors with a local SDK matrix

An error code alone does not tell you which operation failed. These Node.js and Python examples first list accessible models, then send one capped chat completion. A failure in the first step must prevent the second step. A 404 while listing models and a 404 after listing succeeds need different investigations.

This resource is maintained by CheapClankers. It tests client behavior against synthetic responses, not the reliability or error contract of any live provider. It uses the official OpenAI SDK packages with a custom base URL; it is not an OpenAI endorsement. The fixture model and credentials are deliberately fictitious.

## Reproduce the results

Follow the [installation instructions](README.md#install), then run `npm test` with Node.js 22+ and Python 3.9+. The pinned SDK versions are JavaScript 7.60.0 and Python 2.24.0. Set `PYTHON_BIN` if your Python executable has a different name.

The harness binds an ephemeral port on `127.0.0.1` and overrides the endpoint, model and key for each child process. No production inference request is made. Each row below runs through both real SDKs, for 22 checks in total.

| Fixture                                 | Model-list requests | Chat requests | Expected client result               |
| --------------------------------------- | ------------------: | ------------: | ------------------------------------ |
| Successful response                     |                   1 |             1 | Print the fixture reply; exit 0      |
| Missing environment                     |                   0 |             0 | Explain required variables; exit 1   |
| Selected model absent                   |                   1 |             0 | Explain missing model access; exit 1 |
| Model list returns 401                  |                   1 |             0 | Print status and request ID; exit 1  |
| Model list returns 403                  |                   1 |             0 | Print status and request ID; exit 1  |
| Model list returns 404                  |                   1 |             0 | Print status and request ID; exit 1  |
| Model list returns 429 with Retry-After |                   1 |             0 | Print status and request ID; exit 1  |
| Completion returns 402                  |                   1 |             1 | Print status and request ID; exit 1  |
| Completion returns 404                  |                   1 |             1 | Print status and request ID; exit 1  |
| Completion returns 429 with Retry-After |                   1 |             1 | Print status and request ID; exit 1  |
| Completion returns 503                  |                   1 |             1 | Print status and request ID; exit 1  |

Assertions also check the bearer header, exact `/v1/models` and `/v1/chat/completions` paths, selected model, prompt and 128-token output cap. They reject fixture credentials appearing in stdout or stderr. Error cases must retain `x-request-id` as the SDK exposes it: `requestID` in JavaScript and `request_id` in Python.

## Investigate the failing step

If model listing returns 404, check the configured API root and version segment against your provider's documentation. In these fixtures, the client sends `/v1/models`; adding an endpoint such as `/chat/completions` to the base URL changes the constructed path. A provider may also choose not to implement model listing, so confirm its supported endpoints before adapting this example.

If listing succeeds but completion returns 404, confirm the exact model ID, current availability and supported protocol. Being listed for a key does not establish that the model accepts chat completions. Changing a prompt cannot repair a wrong endpoint or unsupported protocol.

For 401 or 403, inspect credential validity and access restrictions without logging the key. For 402, inspect account credit and rates. For 429, consult the provider's limits and response headers. Keep the request ID for support. These are investigation starting points; the provider's actual response and documentation determine the cause.

## Why the fixtures count requests

Both examples explicitly set automatic retries to zero. The tests include Retry-After on 429 responses to confirm that this setting still results in one attempt. A completion failure has two total requests because the earlier model-list call succeeded; it has only one completion attempt.

This harness is not a retry strategy. A production integration may need bounded backoff, idempotency and timeout handling based on its provider's contract. Review usage before manually resending an interrupted billable request. The fixture does not test streaming, timeouts, concurrency, tool calls or live provider compatibility.

For CheapClankers-specific configuration, consult the [setup documentation](https://cheapclankers.com/docs) and check [model protocols and availability](https://cheapclankers.com/models) before a real request. Other providers require their own endpoint and access checks.
