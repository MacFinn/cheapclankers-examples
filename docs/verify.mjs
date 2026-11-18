import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { generate, settings } from "./generate.js";

const cwd = fileURLToPath(new URL(".", import.meta.url));
test("reject credential-bearing, non-HTTP, remote plaintext and complete request URLs", () => {
  for (const base of ["javascript:alert(1)", "http://example.com/v1", "https://user:secret@example.com/v1", "https://example.com/v1?key=secret", "https://example.com/v1#key", "https://example.com/v1/models", "https://example.com/v1/chat/completions/", "https://example.com/v1/responses", "https://example.com/v1/messages"]) {
    assert.throws(() => settings(base));
  }
  for (const cap of [0, -1, 4097, 1.5, "invalid"]) assert.throws(() => settings("https://example.com/v1", "model", cap));
  assert.throws(() => settings("https://example.com/v1", "model\ncommand"));
  assert.equal(settings("https://example.com/tenant/v1///").base, "https://example.com/tenant/v1");
  assert.equal(settings("http://[::1]:1234/v1").base, "http://[::1]:1234/v1");
});

for (const language of ["node", "python"]) {
  for (const scenario of ["success with quoted model", "environment model", "missing key", "absent model", "429 at discovery", "503 at chat"]) {
    test(`generated ${language}: ${scenario}`, { timeout: 15_000 }, async () => {
      const model = scenario === "success with quoted model" ? `fixture-'quoted"-model` : "fixture-model";
      const requests = [];
      const server = createServer(async (req, res) => {
        let raw = "";
        for await (const part of req) raw += part;
        requests.push({ path: req.url, method: req.method, auth: req.headers.authorization, body: raw ? JSON.parse(raw) : null });
        res.setHeader("Content-Type", "application/json");
        res.setHeader("x-request-id", "builder-fixture-request");
        if ((scenario === "429 at discovery" && req.method === "GET") || (scenario === "503 at chat" && req.method === "POST")) {
          res.setHeader("Retry-After", "1");
          res.writeHead(req.method === "GET" ? 429 : 503).end(JSON.stringify({ error: { message: "Fixture failure", type: "fixture_error" } }));
        } else if (req.url === "/tenant/v1/models" && req.method === "GET") {
          res.end(JSON.stringify({ object: "list", data: scenario === "absent model" ? [] : [{ id: model, object: "model", created: 0, owned_by: "fixture" }] }));
        } else if (req.url === "/tenant/v1/chat/completions" && req.method === "POST") {
          res.end(JSON.stringify({ id: "fixture", object: "chat.completion", created: 0, model, choices: [{ index: 0, message: { role: "assistant", content: "Builder fixture passed." }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 4, total_tokens: 5 } }));
        } else res.writeHead(404).end(JSON.stringify({ error: { message: "Wrong request path" } }));
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const dir = await mkdtemp(cwd + ".fixture-");
      try {
        const config = settings(`http://127.0.0.1:${server.address().port}/tenant/v1/`, scenario === "environment model" ? "" : model, 37);
        const file = dir + (language === "node" ? "/chat.mjs" : "/chat.py");
        await writeFile(file, generate(language, config));
        const env = { ...process.env, CLANKER_API_KEY: "builder-dummy-key", CLANKER_MODEL: model };
        if (scenario === "missing key") delete env.CLANKER_API_KEY;
        const child = spawn(language === "node" ? process.execPath : process.env.PYTHON_BIN || "python", [file], { cwd, env, windowsHide: true });
        let output = "";
        child.stdout.on("data", (part) => { output += part; });
        child.stderr.on("data", (part) => { output += part; });
        const timer = setTimeout(() => child.kill(), 12_000);
        let code;
        try { [code] = await once(child, "close"); } finally { clearTimeout(timer); }
        assert.ok(!output.includes("builder-dummy-key"), "key must not appear in output");
        const success = scenario === "success with quoted model" || scenario === "environment model";
        assert.equal(code, success ? 0 : 1, output);
        assert.equal(requests.length, scenario === "missing key" ? 0 : success || scenario === "503 at chat" ? 2 : 1, "no automatic retries or calls after denied access");
        for (const req of requests) assert.equal(req.auth, "Bearer builder-dummy-key");
        if (success || scenario === "503 at chat") {
          assert.deepEqual(requests.map((req) => req.path), ["/tenant/v1/models", "/tenant/v1/chat/completions"]);
          assert.equal(requests[1].body.model, model);
          assert.equal(requests[1].body.max_tokens, 37);
        }
        if (success) assert.match(output, /Builder fixture passed/);
        if (scenario.startsWith("429") || scenario.startsWith("503")) assert.match(output, /builder-fixture-request/);
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        await rm(dir, { recursive: true, force: true });
      }
    });
  }
}
