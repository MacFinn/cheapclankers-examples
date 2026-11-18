import json
import importlib.util
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread


class Fixture(BaseHTTPRequestHandler):
    requests = []

    def respond(self, status, payload):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode())

    def do_GET(self):
        self.requests.append(("GET", self.path, self.headers["Authorization"], None))
        self.respond(200, {"object": "list", "data": [{"id": "fixture-model"}]})

    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        self.requests.append(("POST", self.path, self.headers["Authorization"], payload))
        self.respond(200, {
            "id": "fixture", "object": "chat.completion", "created": 1,
            "model": "fixture-model",
            "choices": [{"index": 0, "finish_reason": "stop",
                         "message": {"role": "assistant", "content": "Hello from fixture"}}],
            "usage": {"prompt_tokens": 5, "completion_tokens": 4, "total_tokens": 9},
        })

    def log_message(self, *_):
        pass


with ThreadingHTTPServer(("127.0.0.1", 0), Fixture) as server:
    Thread(target=server.serve_forever, daemon=True).start()
    env = {
        **os.environ,
        "CLANKER_API_KEY": "fixture-key",
        "CLANKER_BASE_URL": f"http://127.0.0.1:{server.server_port}/v1",
        "LITELLM_LOCAL_MODEL_COST_MAP": "True",
        "HAYSTACK_TELEMETRY_ENABLED": "false",
    }
    try:
        for client in ("litellm", "haystack"):
            for model in ("fixture-model", "absent-model"):
                Fixture.requests.clear()
                result = subprocess.run(
                    [sys.executable, str(Path(__file__).with_name("chat.py")), client],
                    env={**env, "CLANKER_MODEL": model},
                    capture_output=True, text=True, timeout=40,
                )
                assert Fixture.requests[0] == ("GET", "/v1/models", "Bearer fixture-key", None), result.stderr
                if model == "absent-model":
                    assert result.returncode == 1 and len(Fixture.requests) == 1, result.stderr
                else:
                    assert result.returncode == 0 and "Hello from fixture" in result.stdout, result.stderr
                    assert len(Fixture.requests) == 2, Fixture.requests
                    method, path, auth, payload = Fixture.requests[1]
                    assert (method, path, auth) == ("POST", "/v1/chat/completions", "Bearer fixture-key")
                    assert payload["model"] == model and payload["max_tokens"] == 64
                assert "fixture-key" not in result.stdout + result.stderr
                print(f"{client} / {model}: passed")
        if "--provider" in sys.argv:
            Fixture.requests.clear()
            provider_file = Path(importlib.util.find_spec("litellm").origin).parent / "llms/openai_like/providers.json"
            original = provider_file.read_bytes()
            registry = json.loads(original)
            registry.update(json.loads(Path(__file__).with_name("litellm-provider.json").read_bytes()))
            try:
                provider_file.write_text(json.dumps(registry), encoding="utf-8")
                result = subprocess.run(
                    [sys.executable, "-c",
                     "from litellm import completion; "
                     "r = completion(model='cheapclankers/fixture-model', "
                     "messages=[{'role':'user','content':'Hello'}], max_tokens=64, num_retries=0); "
                     "print(r.choices[0].message.content)"],
                    env=env, capture_output=True, text=True, timeout=40,
                )
                assert result.returncode == 0 and "Hello from fixture" in result.stdout, result.stderr
                assert len(Fixture.requests) == 1, Fixture.requests
                method, path, auth, payload = Fixture.requests[0]
                assert (method, path, auth) == ("POST", "/v1/chat/completions", "Bearer fixture-key")
                assert payload["model"] == "fixture-model" and payload["max_tokens"] == 64
                print("litellm / named provider: passed")
            finally:
                provider_file.write_bytes(original)
    finally:
        server.shutdown()
