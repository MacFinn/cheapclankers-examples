export function settings(baseInput, modelInput = "", capInput = 128) {
  let url;
  try { url = new URL(baseInput.trim()); } catch { throw new Error("Enter an absolute API base URL, such as https://api.example.com/v1."); }
  if (url.username || url.password || url.search || url.hash) throw new Error("Use a base URL without credentials, query parameters or a fragment.");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Use HTTPS, or HTTP on localhost for a local test.");
  if (/\/(chat\/completions|models|responses|messages)\/?$/.test(url.pathname)) throw new Error("Enter the API base, not a complete request URL. Remove the final /models, /chat/completions, /responses or /messages path.");
  const model = modelInput.trim();
  if (model.length > 200 || /[\x00-\x1f\x7f]/.test(model)) throw new Error("Use a model ID of up to 200 characters without control characters.");
  const cap = Number(capInput);
  if (!Number.isInteger(cap) || cap < 1 || cap > 4096) throw new Error("Choose a whole output limit between 1 and 4096 tokens.");
  return { base: url.href.replace(/\/+$/, ""), model, cap };
}

export function generate(language, config) {
  const { base, model, cap } = config;
  const quotedBase = JSON.stringify(base);
  const quotedModel = model ? JSON.stringify(model) : null;
  if (language === "node") return `import OpenAI from "openai";

async function main() {
  const apiKey = process.env.CLANKER_API_KEY;
  const model = ${quotedModel || "process.env.CLANKER_MODEL"};
  if (!apiKey || !model) throw new Error("Set CLANKER_API_KEY${model ? "" : " and CLANKER_MODEL"} in your server-side environment.");
  const client = new OpenAI({
    apiKey,
    baseURL: ${quotedBase},
    maxRetries: 0,
    timeout: 30_000,
  });
  const models = await client.models.list();
  if (!models.data.some((item) => item.id === model)) {
    throw new Error("Selected model was not returned for this key. Check model access.");
  }
  // Confirm Chat Completions support separately in your provider's catalogue.
  const result = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: "Say hello in one sentence." }],
    max_tokens: ${cap},
  });
  console.log(result.choices[0]?.message.content ?? "(no text returned)");
}

main().catch((error) => {
  if (error instanceof OpenAI.APIError) {
    console.error(
      "API request failed (status " + (error.status ?? "unknown") +
      ", request " + (error.requestID ?? "unknown") + "). Check access, protocol, credit and usage before retrying.",
    );
  } else {
    console.error(error instanceof Error ? error.message : "Setup failed.");
  }
  process.exitCode = 1;
});
`;
  if (language === "python") return `import os
import sys
from openai import APIError, OpenAI

def main():
    api_key = os.environ.get("CLANKER_API_KEY")
    model = ${quotedModel || 'os.environ.get("CLANKER_MODEL")'}
    if not api_key or not model:
        raise ValueError("Set CLANKER_API_KEY${model ? "" : " and CLANKER_MODEL"} in your server-side environment.")
    with OpenAI(
        api_key=api_key,
        base_url=${quotedBase},
        max_retries=0,
        timeout=30.0,
    ) as client:
        models = client.models.list()
        if not any(item.id == model for item in models.data):
            raise ValueError("Selected model was not returned for this key. Check model access.")
        # Confirm Chat Completions support separately in your provider's catalogue.
        result = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello in one sentence."}],
            max_tokens=${cap},
        )
        print(result.choices[0].message.content or "(no text returned)")

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
`;
  if (language !== "curl") throw new Error("Choose Node.js, Python or cURL.");
  const shell = (text) => "'" + text.replaceAll("'", "'\"'\"'") + "'";
  const payload = JSON.stringify({ model: model || "YOUR_ENABLED_MODEL", messages: [{ role: "user", content: "Say hello in one sentence." }], max_tokens: cap });
  return `# Bash / zsh. Set CLANKER_API_KEY locally; do not paste it into this tool.
: "\${CLANKER_API_KEY:?Set CLANKER_API_KEY in your environment}"

# 1. Run this first. Inspect the IDs returned for your key.
curl --fail-with-body --max-time 30 ${shell(base + "/models")} \\
  -H "Authorization: Bearer $CLANKER_API_KEY"

# 2. Confirm the selected ID supports Chat Completions in the catalogue.
${model ? "# This next request consumes credit if it succeeds." : "# Replace YOUR_ENABLED_MODEL below before running this paid request."}
curl --fail-with-body --max-time 30 ${shell(base + "/chat/completions")} \\
  -H "Authorization: Bearer $CLANKER_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data-raw ${shell(payload)}
`;
}
