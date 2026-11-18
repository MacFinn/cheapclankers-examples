# CheapClankers with the Vercel AI SDK

This example lists the models available to your key, then runs one text chat with an output cap. Choose a model that supports Chat Completions in the [model catalogue](https://cheapclankers.com/models). The request uses prepaid credit.

Use Node.js 22 or later and install the dependencies with `npm install`. Set `CLANKER_API_KEY` and `CLANKER_MODEL` in your shell, then run `node run.mjs`. See the [CheapClankers docs](https://cheapclankers.com/docs) for API access and setup.

The provider exposes `listModels()` and `chatModel(id)`. Use the latter with `generateText` from the AI SDK. `listModels()` returns models your key can access. Check the model catalogue for Chat Completions support before calling a model.

Run `node verify.mjs` to check model discovery, bearer authentication, and the capped chat request against a loopback fixture. The fixture uses a dummy key and does not exercise production inference.
