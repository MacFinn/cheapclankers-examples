"""Import and execute the workflow in an isolated n8n container; no live keys."""
import copy
import json
from pathlib import Path
import subprocess
import tempfile
import uuid

IMAGE = "docker.n8n.io/n8nio/n8n:2.48.5@sha256:c0ea1246a81a34ce8e2b3cfb1f718b97de64b0a1b3747ad24d6d431826bb71ad"
ROOT = Path(__file__).resolve().parent
KEY = "local-fixture-not-a-live-key"


def docker(*args, check=True):
    return subprocess.run(["docker", *args], text=True, capture_output=True, check=check)


MOCK = r"""
import http from 'node:http';
import fs from 'node:fs';
http.createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  const parts = req.url.split('/'); const scenario = parts[1];
  const payload = body ? JSON.parse(body) : null;
  const valid = req.headers.authorization === 'Bearer local-fixture-not-a-live-key';
  fs.appendFileSync('/fixtures/requests.jsonl', JSON.stringify({scenario, method:req.method, path:parts.slice(2).join('/'), valid, payload})+'\n');
  res.setHeader('Content-Type','application/json');
  if (!valid) { res.writeHead(401); return res.end(JSON.stringify({error:{message:'Invalid fixture key'}})); }
  if (req.method === 'GET' && req.url.endsWith('/v1/models')) {
    if (scenario === 'restricted') { res.writeHead(403); return res.end(JSON.stringify({error:{message:'Restricted fixture key'}})); }
    return res.end(JSON.stringify({object:'list',data:scenario==='absent'?[]:[{id:'fixture-chat',object:'model'}]}));
  }
  if (req.method === 'POST' && req.url.endsWith('/v1/chat/completions')) {
    if (scenario === 'unavailable') { res.writeHead(503); return res.end(JSON.stringify({error:{message:'Fixture upstream unavailable'}})); }
    return res.end(JSON.stringify({id:'chat-fixture',object:'chat.completion',choices:[{index:0,message:{role:'assistant',content:'Hello from the local fixture.'},finish_reason:'stop'}]}));
  }
  res.writeHead(404);res.end('{}');
}).listen(3000,'127.0.0.1');
"""


def main():
    workflow = json.loads((ROOT / "model-access-chat.json").read_text())
    assert not any("credentials" in n for n in workflow["nodes"]), "Public export must not embed credential references"
    name = "clankers-n8n-fixture-" + uuid.uuid4().hex[:10]
    with tempfile.TemporaryDirectory(prefix="clankers-n8n-") as tmp:
        folder = Path(tmp)
        (folder / "mock.mjs").write_text(MOCK)
        (folder / "credentials.json").write_text(json.dumps([{
            "id": "fixture-header", "name": "Local fixture only", "type": "httpHeaderAuth",
            "data": {"name": "Authorization", "value": "Bearer " + KEY},
        }]))
        cases = ("success", "absent", "restricted", "unavailable")
        for case in cases:
            w = copy.deepcopy(workflow)
            w["id"] = "fixture-" + case
            for n in w["nodes"]:
                if n["name"] == "Configure request":
                    for a in n["parameters"]["assignments"]["assignments"]:
                        a["value"] = "http://127.0.0.1:3000/" + case + "/v1" if a["name"] == "baseUrl" else "fixture-chat"
                if n["type"] == "n8n-nodes-base.httpRequest":
                    n["credentials"] = {"httpHeaderAuth": {"id": "fixture-header", "name": "Local fixture only"}}
            (folder / (case + ".json")).write_text(json.dumps(w))
        try:
            docker("run", "-d", "--rm", "--name", name, "--network", "none",
                   "-e", "N8N_DIAGNOSTICS_ENABLED=false", "-e", "N8N_VERSION_NOTIFICATIONS_ENABLED=false",
                   "-e", "N8N_ENCRYPTION_KEY=local-fixture-only-not-a-live-secret",
                   "-v", str(folder) + ":/fixtures", "--entrypoint", "node", IMAGE, "/fixtures/mock.mjs")
            docker("exec", name, "n8n", "import:credentials", "--input=/fixtures/credentials.json")
            for case in cases:
                docker("exec", name, "n8n", "import:workflow", "--input=/fixtures/" + case + ".json")
                result = docker("exec", name, "n8n", "execute", "--id=fixture-" + case, "--rawOutput", check=False)
                output = result.stdout + result.stderr
                (folder / (case + "-output.txt")).write_text(output)
                if case == "success":
                    assert result.returncode == 0 and "Hello from the local fixture." in output, output[-4000:]
                elif case == "absent":
                    assert "The selected model was not returned" in output, output[-4000:]
                else:
                    assert ("Restricted fixture key" if case == "restricted" else "Fixture upstream unavailable") in output, output[-4000:]
                print("PASS n8n import + execution:", case)
            requests = [json.loads(line) for line in (folder / "requests.jsonl").read_text().splitlines()]
            for case in cases:
                calls = [r for r in requests if r["scenario"] == case]
                assert len(calls) == (2 if case in ("success", "unavailable") else 1), calls
                assert all(c["valid"] for c in calls), calls
                assert calls[0]["path"] == "v1/models", calls
                if len(calls) == 2:
                    assert calls[1]["path"] == "v1/chat/completions", calls
                    assert calls[1]["payload"] == {"model": "fixture-chat", "messages": [{"role": "user", "content": "Say hello in one short sentence."}], "max_tokens": 128, "stream": False}, calls
            print("PASS authentication, paths, payload, absent-model guard and no automatic retry")
        finally:
            docker("rm", "-f", name, check=False)


if __name__ == "__main__":
    main()
