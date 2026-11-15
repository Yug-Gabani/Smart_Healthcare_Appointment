"""
Provider-agnostic LLM factory for PulseCare ai-service.

Selection order (first match wins):
  1. GOOGLE_API_KEY set  -> Google AI Studio / Gemini (free tier)
  2. OPENROUTER_API_KEY set -> OpenRouter (any model that proxy supports)
  3. Neither             -> None, caller falls back to deterministic rules

Why both? Google AI Studio has a generous free tier (no credit top-up
needed for a student demo); OpenRouter is kept as a drop-in alternative
when users already have that account or want Claude. The Spring Boot
backend doesn't care which runs — it only sees the ai-service HTTP API.
"""

from __future__ import annotations

import os
from typing import Optional


# Default models. Override via GOOGLE_MODEL / OPENROUTER_MODEL in .env.
# gemini-2.5-flash-lite is the current cheap/fast Google model; haiku-4.5
# is the current cheap/fast Anthropic model on OpenRouter.
_DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash-lite"
_DEFAULT_OPENROUTER_MODEL = "anthropic/claude-haiku-4.5"


def extract_text(resp) -> str:
    """
    Normalize an LLM response's `content` to a plain string.

    langchain-openai returns `content` as a str.
    langchain-google-genai 4.x returns it as a list of content blocks like
      [{"type": "text", "text": "..."}]
    so a naive `.strip()` on it blows up. This helper handles both.
    """
    content = getattr(resp, "content", "") if resp is not None else ""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text") or block.get("content") or ""
                if isinstance(text, str) and text:
                    parts.append(text)
            else:
                # Pydantic / dataclass-style blocks with a .text attribute.
                text = getattr(block, "text", None)
                if isinstance(text, str) and text:
                    parts.append(text)
        return "".join(parts)
    return str(content)


def active_provider() -> str:
    """Return 'google', 'openrouter', or 'none' — useful for /health."""
    if os.getenv("GOOGLE_API_KEY", "").strip():
        return "google"
    if os.getenv("OPENROUTER_API_KEY", "").strip():
        return "openrouter"
    return "none"


def active_model() -> str:
    """Return the model id currently in use (for /health reporting)."""
    provider = active_provider()
    if provider == "google":
        return os.getenv("GOOGLE_MODEL", _DEFAULT_GOOGLE_MODEL)
    if provider == "openrouter":
        return os.getenv("OPENROUTER_MODEL", _DEFAULT_OPENROUTER_MODEL)
    return ""


def get_llm(*, temperature: float = 0.1, max_tokens: int = 512, title: str = "PulseCare"):
    """
    Build a configured LLM client for whichever provider is set. Returns None
    when no provider is configured so callers can fall back to deterministic
    logic without special-casing a missing key.

    Args:
        temperature: sampling temperature; clinical tasks use ~0.1
        max_tokens: caps output length — keeps per-call cost predictable and
                    avoids OpenRouter's "you must pre-fund the full context"
                    behaviour.
        title: shown in OpenRouter's dashboard for traffic attribution;
               ignored by Google.
    """
    provider = active_provider()

    if provider == "google":
        # Imported lazily so the dependency is only required when actually used.
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=os.getenv("GOOGLE_MODEL", _DEFAULT_GOOGLE_MODEL),
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

    if provider == "openrouter":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.getenv("OPENROUTER_MODEL", _DEFAULT_OPENROUTER_MODEL),
            openai_api_key=os.getenv("OPENROUTER_API_KEY"),
            openai_api_base="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "https://pulsecare.local",
                "X-Title": title,
            },
            temperature=temperature,
            max_tokens=max_tokens,
        )

    return None
