# OpenAI-compatible API setup builder

A static, browser-only configuration tool. Generate Node.js, Python and Bash/cURL Chat Completions examples for a custom API base URL, then consult a status-code troubleshooting guide. Maintained by CheapClankers; no provider endorsement is implied.

The page never accepts API keys or calls an inference endpoint. It has no analytics, backend, saved settings or third-party scripts. Generated scripts make real requests only when the user runs them with a key. A successful generation can consume credit.

## Run locally

Serve this directory, for example with `python -m http.server 8766 --bind 127.0.0.1`. Open `http://127.0.0.1:8766/`. No build or frontend dependencies are required.

## Verify generated code

Install the pinned SDK dependencies from the parent example package, then run with Node.js 22+ and Python available:

```sh
node --test docs/verify.mjs
```

Thirteen checks validate configuration and execute generated Node.js and Python programs against a loopback fixture. They cover quoted model IDs, model IDs from environment variables, a missing key, absent model access, a rate limit during discovery and an unavailable chat route. The checks assert exact custom-prefix request paths, output caps, request IDs and absence of automatic retries. They do not verify production inference, availability, rate accuracy, streaming or other protocols. The cURL example is a Bash/zsh template with manual model inspection; it is not part of the SDK execution matrix.

For real requests, consult the [CheapClankers docs](https://cheapclankers.com/docs) and [model catalogue](https://cheapclankers.com/models). Other providers may use different error semantics. This tool checks URL shape, not whether a remote provider is actually compatible.

The static tool files in this directory are available under [MIT](LICENSE.txt). This license does not apply to the hosted CheapClankers service or unrelated repository files.
