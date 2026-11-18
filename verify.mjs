import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const cwd = fileURLToPath(new URL(".", import.meta.url));
const model = "fixture-chat-model";

for (const [language, command, file] of [
  ["Node.js", process.execPath, "node-chat.mjs"],
  ["Python", process.env.PYTHON_BIN || "python", "python_chat.py"],
]) {
  for (const scenario of [
    "success",
    "missing environment",
    "missing model",
    "restricted key",
    "insufficient credit",
    "upstream unavailable",
  ]) {
    test(`${language}: ${scenario}`, { timeout: 15_000 }, async () => {
      const requests = [];
      const server = createServer(async (req, res) => {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const body = raw ? JSON.parse(raw) : undefined;
        requests.push({
          path: req.url,
          method: req.method,
          auth: req.headers.authorization,
          body,
        });
        res.setHeader("Content-Type", "application/json");
        res.setHeader("x-request-id", "fixture-request");
        if (scenario === "restricted key") {
          res.writeHead(403).end(
            JSON.stringify({
              error: { message: "Key restricted", type: "permission_error" },
            }),
          );
        } else if (req.url === "/v1/models" && req.method === "GET") {
          res.end(
            JSON.stringify({
              object: "list",
              data:
                scenario === "missing model"
                  ? []
                  : [
                      {
                        id: model,
                        object: "model",
                        created: 0,
                        owned_by: "fixture",
                      },
                    ],
            }),
          );
        } else if (
          req.url === "/v1/chat/completions" &&
          req.method === "POST"
        ) {
          if (
            ["insufficient credit", "upstream unavailable"].includes(scenario)
          ) {
            res.writeHead(scenario === "insufficient credit" ? 402 : 503).end(
              JSON.stringify({
                error: {
                  message:
                    scenario === "insufficient credit"
                      ? "Insufficient credit"
                      : "Upstream unavailable",
                  type:
                    scenario === "insufficient credit"
                      ? "billing_error"
                      : "server_error",
                },
              }),
            );
          } else {
            res.end(
              JSON.stringify({
                id: "fixture-completion",
                object: "chat.completion",
                created: 0,
                model,
                choices: [
                  {
                    index: 0,
                    message: {
                      role: "assistant",
                      content: "Hello from the local fixture.",
                    },
                    finish_reason: "stop",
                  },
                ],
                usage: {
                  prompt_tokens: 8,
                  completion_tokens: 6,
                  total_tokens: 14,
                },
              }),
            );
          }
        } else {
          res
            .writeHead(404)
            .end(JSON.stringify({ error: { message: "Unexpected path" } }));
        }
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      try {
        const child = spawn(command, [file], {
          cwd,
          env: {
            ...process.env,
            CLANKER_API_KEY:
              scenario === "missing environment" ? "" : "fixture-only-key",
            CLANKER_MODEL: model,
            CLANKER_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`,
            NO_PROXY: "127.0.0.1",
            no_proxy: "127.0.0.1",
          },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (data) => {
          stdout += data;
        });
        child.stderr.on("data", (data) => {
          stderr += data;
        });
        const timer = setTimeout(() => child.kill(), 10_000);
        let code;
        try {
          [code] = await once(child, "close");
        } finally {
          clearTimeout(timer);
        }
        assert.equal(code, scenario === "success" ? 0 : 1, stderr);
        assert.ok(
          !`${stdout}${stderr}`.includes("fixture-only-key"),
          "Credentials must not be printed",
        );
        assert.equal(
          requests.length,
          scenario === "missing environment"
            ? 0
            : [
                  "success",
                  "insufficient credit",
                  "upstream unavailable",
                ].includes(scenario)
              ? 2
              : 1,
        );
        for (const request of requests)
          assert.equal(request.auth, "Bearer fixture-only-key");
        if (scenario === "success")
          assert.match(stdout, /Reply: Hello from the local fixture\./);
        if (scenario === "missing environment")
          assert.match(stderr, /Set CLANKER_API_KEY and CLANKER_MODEL/);
        if (scenario === "missing model")
          assert.match(stderr, /Selected model was not returned/);
        if (
          [
            "restricted key",
            "insufficient credit",
            "upstream unavailable",
          ].includes(scenario)
        )
          assert.match(
            stderr,
            new RegExp(
              `status ${scenario === "restricted key" ? 403 : scenario === "insufficient credit" ? 402 : 503}.*fixture-request`,
            ),
          );
        const completion = requests.find(
          (request) => request.method === "POST",
        );
        if (completion) {
          assert.equal(completion.path, "/v1/chat/completions");
          assert.equal(completion.body.model, model);
          assert.equal(completion.body.max_tokens, 128);
          assert.deepEqual(completion.body.messages, [
            { role: "user", content: "Say hello in one sentence." },
          ]);
        }
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    });
  }
}
