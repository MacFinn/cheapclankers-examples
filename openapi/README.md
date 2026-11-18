# CheapClankers OpenAPI reference

Import [`openapi.json`](openapi.json) into an OpenAPI client to inspect requests for listing accessible models and sending a bounded text chat. List models first, then check your chosen model's Chat Completions support in the [model catalogue](https://cheapclankers.com/models).

Set the bearer token in your client's local secret store using a key from your own CheapClankers account. A successful chat request consumes prepaid credits. Set `max_tokens` to a small value for the first request and check usage before retrying an ambiguous failure.

See the [CheapClankers API docs](https://cheapclankers.com/docs) for account setup and additional protocol examples. This reference covers non-streaming text chat and model discovery.
