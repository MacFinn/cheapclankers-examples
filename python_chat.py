import os
import sys

from openai import APIError, OpenAI


def main():
    api_key = os.environ.get("CLANKER_API_KEY")
    model = os.environ.get("CLANKER_MODEL")
    if not api_key or not model:
        raise ValueError("Set CLANKER_API_KEY and CLANKER_MODEL in this shell.")

    with OpenAI(
        api_key=api_key,
        base_url=os.environ.get("CLANKER_BASE_URL") or "https://api.cheapclankers.com/v1",
        max_retries=0,
        timeout=30.0,
    ) as client:
        models = client.models.list()
        if not any(item.id == model for item in models.data):
            raise ValueError("Selected model was not returned for this key. Check its model access.")
        print(f"Model access confirmed: {model}")
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello in one sentence."}],
            max_tokens=128,
        )
        print(f"Reply: {response.choices[0].message.content or '(no text returned)'}")


if __name__ == "__main__":
    try:
        main()
    except APIError as error:
        print(
            f"API request failed (status {getattr(error, 'status_code', 'unknown')}, "
            f"request {getattr(error, 'request_id', 'unknown')}). "
            "Check access, protocol, credit and usage before retrying.",
            file=sys.stderr,
        )
        sys.exit(1)
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
