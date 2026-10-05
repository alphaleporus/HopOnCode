"""
Provider-agnostic LLM client (free / open-source first)

Talks to any OpenAI-compatible /chat/completions endpoint using only the
standard library. Defaults to a local Ollama server, so no paid API key is
needed. Point LLM_BASE_URL at another compatible server (llama.cpp server,
vLLM, LM Studio, LocalAI) to switch providers without code changes.

Environment variables:
    LLM_BASE_URL  default http://localhost:11434/v1  (Ollama)
    LLM_MODEL     default llama3.2:3b
    LLM_API_KEY   optional; only sent if set
    LLM_TIMEOUT   seconds, default 30
    LLM_ENABLED   set to "false" to force rule-based fallback
"""

import json
import os
import urllib.error
import urllib.request
from typing import Dict, List, Optional


class LLMClient:
    def __init__(
            self,
            base_url: Optional[str] = None,
            model: Optional[str] = None,
            api_key: Optional[str] = None,
            timeout: Optional[float] = None,
    ):
        self.base_url = (base_url or os.getenv('LLM_BASE_URL', 'http://localhost:11434/v1')).rstrip('/')
        self.model = model or os.getenv('LLM_MODEL', 'llama3.2:3b')
        self.api_key = api_key or os.getenv('LLM_API_KEY', '')
        self.timeout = timeout or float(os.getenv('LLM_TIMEOUT', '30'))
        self.enabled = os.getenv('LLM_ENABLED', 'true').lower() != 'false'

    def is_available(self) -> bool:
        """Check the server is reachable AND the configured model is installed (GET /models)."""
        if not self.enabled:
            return False
        try:
            req = urllib.request.Request(f"{self.base_url}/models", headers=self._headers())
            with urllib.request.urlopen(req, timeout=3) as resp:
                models = [m.get("id", "") for m in (json.loads(resp.read()).get("data") or [])]
        except (urllib.error.URLError, OSError, ValueError):
            return False
        if self.model in models or f"{self.model}:latest" in models:
            return True
        print(f"⚠️  LLM server is up but model '{self.model}' is not installed "
              f"(available: {', '.join(models) or 'none'}). Run: ollama pull {self.model}")
        return False

    def chat(
            self,
            messages: List[Dict[str, str]],
            temperature: float = 0.3,
            max_tokens: int = 300,
            json_mode: bool = False,
    ) -> str:
        """Send a chat completion request and return the message content."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        req = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(payload).encode('utf-8'),
            headers=self._headers(),
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            body = json.loads(resp.read().decode('utf-8'))
        return body["choices"][0]["message"]["content"]

    def chat_json(self, messages: List[Dict[str, str]], **kwargs) -> Dict:
        """Chat and parse the reply as JSON (tolerates surrounding text)."""
        content = self.chat(messages, json_mode=True, **kwargs)
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start, end = content.find('{'), content.rfind('}')
            if start != -1 and end > start:
                return json.loads(content[start:end + 1])
            raise

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers


if __name__ == "__main__":
    client = LLMClient()
    print(f"LLM endpoint: {client.base_url} | model: {client.model}")
    if client.is_available():
        print(client.chat([{"role": "user", "content": "Reply with the single word: ready"}], max_tokens=10))
    else:
        print("⚠️  LLM server not reachable - start Ollama with `ollama serve`")
