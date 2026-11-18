# Use CheapClankers with LiteLLM or Haystack

This example lists the models available to your API key, then sends one text chat request with a 64-token output cap. Select a model that supports Chat Completions in the [CheapClankers model catalogue](https://cheapclankers.com/models). The chat request uses prepaid credit.

Install the dependencies in a Python 3.11 virtual environment:

```sh
python -m pip install -r requirements.txt
```

Set `CLANKER_API_KEY` in your local environment and set `CLANKER_MODEL` to an accessible Chat Completions model ID. See the [CheapClankers documentation](https://cheapclankers.com/docs) for setup.

```sh
python chat.py litellm
python chat.py haystack
```

LiteLLM uses its generic OpenAI route with the CheapClankers base URL. Haystack uses `OpenAIChatGenerator` with the same endpoint. Both disable automatic retries. The example stops before inference if the key cannot see the requested model.

Run `python verify.py` to exercise both clients against a loopback API fixture using a dummy key. The fixture checks request paths, bearer authentication, the output token cap and the absence of a chat request when the model is unavailable to the key. Production inference and other protocols are outside this check.
