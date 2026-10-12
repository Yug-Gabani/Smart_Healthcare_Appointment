# Implements: FR-03, FR-04
# Safety:    S10
# Owner:     ai (Group 6)

from langchain_openai import ChatOpenAI
from src.config import settings

# Point ChatOpenAI at OpenRouter endpoint for anthropic/claude-3.5-sonnet
llm = ChatOpenAI(
    model=settings.AI_MODEL,
    openai_api_key=settings.OPENROUTER_API_KEY,
    openai_api_base=settings.OPENROUTER_BASE_URL,
    temperature=0.0,
    max_tokens=1000,
)
