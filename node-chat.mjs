import OpenAI from "openai";

async function main() {
  const apiKey = process.env.CLANKER_API_KEY;
  const model = process.env.CLANKER_MODEL;
  if (!apiKey || !model) {
    throw new Error("Set CLANKER_API_KEY and CLANKER_MODEL in this shell.");
  }
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.CLANKER_BASE_URL || "https://api.cheapclankers.com/v1",
    maxRetries: 0,
    timeout: 30_000,
  });
  const models = await client.models.list();
  if (!models.data.some((item) => item.id === model)) {
    throw new Error(
      "Selected model was not returned for this key. Check its model access.",
    );
  }
  console.log(`Model access confirmed: ${model}`);
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: "Say hello in one sentence." }],
    max_tokens: 128,
  });
  console.log(
    `Reply: ${response.choices[0]?.message.content ?? "(no text returned)"}`,
  );
}

main().catch((error) => {
  if (error instanceof OpenAI.APIError) {
    console.error(
      `API request failed (status ${error.status ?? "unknown"}, request ${error.requestID ?? "unknown"}). Check access, protocol, credit and usage before retrying.`,
    );
  } else {
    console.error(error instanceof Error ? error.message : "Setup failed.");
  }
  process.exitCode = 1;
});
