import { generate, settings } from "./generate.js";
const byId = (id) => document.getElementById(id);
let language = "node";
let rendered = "";
const errors = {
  "401": ["Check the key.", "Use the key for the intended service, confirm it has not been revoked and keep it in a server-side environment variable."],
  "403": ["Check model access.", "Confirm the key is allowed to use the selected model and route. Listing models with the same key helps distinguish restricted access from a typo."],
  "402": ["Check available credit.", "Check prepaid balance and any pending reservations. An output-token limit does not make a generation free. Review billing before repeating the request."],
  "404": ["Check the path and exact model ID.", "Start with the provider's documented API root. Avoid appending /v1 twice or using a full /chat/completions URL as the SDK base. Confirm model access and Chat Completions support separately."],
  "429": ["Reduce request pressure.", "Check the returned error for rate or concurrency limits and any Retry-After header. Wait as directed; a tight retry loop can prolong the failure."],
  "503": ["Check current route availability.", "The model, route or supplier may be unavailable. Check status and the request ID. Confirm usage before retrying an ambiguous generation."],
  "timeout": ["Treat the result as uncertain.", "The server may have processed a request even when the client did not receive a reply. Check usage and request status before sending the same generation again."],
};
function render() {
  try {
    const config = settings(byId("base").value, byId("model").value, byId("cap").value);
    rendered = generate(language, config);
    byId("code").textContent = rendered;
    byId("models-path").textContent = new URL(config.base).pathname.replace(/\/$/, "") + "/models";
    byId("install").textContent = { node: "npm install openai@7.60.0 · save as chat.mjs · node chat.mjs", python: "python -m pip install openai==2.24.0 · save as chat.py · python chat.py", curl: "Bash / zsh · inspect model discovery before running the chat command" }[language];
    byId("validation").textContent = "";
    byId("notice").textContent = "Example ready. Confirm model protocol and pricing before running it.";
    byId("copy").disabled = false;
    byId("base").removeAttribute("aria-invalid");
  } catch (error) {
    rendered = "";
    byId("code").textContent = "Update the configuration to build an example.";
    byId("validation").textContent = error.message;
    byId("notice").textContent = "";
    byId("copy").disabled = true;
  }
}
byId("builder").addEventListener("submit", (event) => { event.preventDefault(); render(); });
document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => {
  language = button.dataset.language;
  document.querySelectorAll("[data-language]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  render();
}));
byId("builder").addEventListener("input", () => {
  rendered = "";
  byId("copy").disabled = true;
  byId("notice").textContent = "Settings changed. Build the example to update the code.";
});
byId("copy").addEventListener("click", async () => {
  if (!rendered) return;
  try { await navigator.clipboard.writeText(rendered); byId("notice").textContent = "Example copied. Set your key locally in your server-side environment."; }
  catch { byId("notice").textContent = "Clipboard access is unavailable. Select the code and copy it manually."; }
});
byId("error").addEventListener("change", () => {
  const [title, advice] = errors[byId("error").value];
  byId("error-title").textContent = title;
  byId("error-advice").textContent = advice;
});
render();
