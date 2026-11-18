import argparse
import json
import os
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("client", choices=["litellm", "haystack"])
    args = parser.parse_args()
    key = os.environ["CLANKER_API_KEY"]
    model = os.environ["CLANKER_MODEL"]
    base = os.getenv("CLANKER_BASE_URL", "https://api.cheapclankers.com/v1").rstrip("/")
    request = Request(base + "/models", headers={"Authorization": f"Bearer {key}"})
    with urlopen(request, timeout=15) as response:
        models = json.load(response)["data"]
    if not any(item["id"] == model for item in models):
        parser.exit(1, "Selected model is unavailable to this key. No chat request sent.\n")

    prompt = "Reply with one short greeting."
    if args.client == "litellm":
        from litellm import completion

        reply = completion(
            model=f"openai/{model}", api_base=base, api_key=key,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=64, timeout=30, num_retries=0,
        ).choices[0].message.content
    else:
        from haystack.components.generators.chat import OpenAIChatGenerator
        from haystack.dataclasses import ChatMessage
        from haystack.utils import Secret

        generator = OpenAIChatGenerator(
            model=model, api_base_url=base, api_key=Secret.from_token(key),
            generation_kwargs={"max_tokens": 64}, timeout=30, max_retries=0,
        )
        reply = generator.run([ChatMessage.from_user(prompt)])["replies"][0].text
    print(reply or "(no text returned)")


if __name__ == "__main__":
    main()
