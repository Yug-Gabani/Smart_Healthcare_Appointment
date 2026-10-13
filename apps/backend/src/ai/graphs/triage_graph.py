# Implements: FR-03, FR-04, FR-16
# Safety:    S1, S2, S3, S4, S10
# Owner:     ai (Group 6)

import json
from typing import Any, Dict, List, Optional, TypedDict
from langchain_core.prompts import PromptTemplate
from langgraph.graph import END, StateGraph

from src.ai.llm import llm
from src.ai.prompt_registry import prompts
from src.ai.schemas import TriageOutput
from src.models.appointment import TriageUrgency

GRAPH_VERSION = "v1.0"
PROMPT_VERSION = "v1"

EMERGENCY_KEYWORDS = [
    "chest pain",
    "heart attack",
    "anaphylaxis",
    "unconscious",
    "loss of consciousness",
    "can't breathe",
    "cannot breathe",
    "severe bleeding",
    "stroke",
    "paralysis",
    "overdose",
    "coughing blood",
]


class TriageState(TypedDict):
    symptoms: str
    questionnaire: Dict[str, Any]
    is_emergency: bool
    triage_result: Optional[TriageOutput]
    error: Optional[str]
    graph_version: str
    prompt_version: str


def emergency_precheck(state: TriageState) -> Dict[str, Any]:
    """Safety S4: Keyword precheck executed before any LLM invocation."""
    combined_text = (
        state["symptoms"] + " " + json.dumps(state["questionnaire"])
    ).lower()

    for kw in EMERGENCY_KEYWORDS:
        if kw in combined_text:
            return {
                "is_emergency": True,
                "triage_result": TriageOutput(
                    urgency=TriageUrgency.EMERGENCY,
                    summary=f"Emergency red flag triggered via pre-screening: detected acute indicator '{kw}'. Immediate medical evaluation required.",
                    recommended_specialty="Emergency Medicine",
                    red_flags_detected=[kw],
                ),
            }

    return {"is_emergency": False}


def route_after_precheck(state: TriageState) -> str:
    if state.get("is_emergency"):
        return "emergency_branch"
    return "llm_triage"


async def llm_triage(state: TriageState) -> Dict[str, Any]:
    """Invoke Claude 3.5 Sonnet to obtain structured triage classification."""
    try:
        raw_prompt = prompts.get("triage", PROMPT_VERSION)
        prompt_tmpl = PromptTemplate.from_template(raw_prompt)
        chain = prompt_tmpl | llm.with_structured_output(TriageOutput)

        result: TriageOutput = await chain.ainvoke(
            {
                "symptoms": state["symptoms"],
                "questionnaire": json.dumps(state["questionnaire"]),
            }
        )
        return {
            "triage_result": result,
            "is_emergency": (result.urgency == TriageUrgency.EMERGENCY),
        }
    except Exception as exc:
        # Safety S3: Graceful AI failure
        return {
            "error": str(exc),
            "is_emergency": False,
        }


def route_after_llm(state: TriageState) -> str:
    if state.get("error"):
        return "manual_triage_fallback"
    if state.get("is_emergency") or (
        state.get("triage_result")
        and state["triage_result"].urgency == TriageUrgency.EMERGENCY
    ):
        return "emergency_branch"
    return "standard_summary"


def emergency_branch(state: TriageState) -> Dict[str, Any]:
    """Safety S2: Emergency never queues silently; flagged immediately for urgent routing."""
    return {}


def manual_triage_fallback(state: TriageState) -> Dict[str, Any]:
    """Safety S3: Fallback node marks record for manual doctor review on LLM error."""
    return {}


def standard_summary(state: TriageState) -> Dict[str, Any]:
    return {}


# Build the LangGraph workflow
builder = StateGraph(TriageState)
builder.add_node("emergency_precheck", emergency_precheck)
builder.add_node("llm_triage", llm_triage)
builder.add_node("emergency_branch", emergency_branch)
builder.add_node("manual_triage_fallback", manual_triage_fallback)
builder.add_node("standard_summary", standard_summary)

builder.set_entry_point("emergency_precheck")
builder.add_conditional_edges(
    "emergency_precheck",
    route_after_precheck,
    {
        "emergency_branch": "emergency_branch",
        "llm_triage": "llm_triage",
    },
)
builder.add_conditional_edges(
    "llm_triage",
    route_after_llm,
    {
        "emergency_branch": "emergency_branch",
        "manual_triage_fallback": "manual_triage_fallback",
        "standard_summary": "standard_summary",
    },
)

builder.add_edge("emergency_branch", END)
builder.add_edge("manual_triage_fallback", END)
builder.add_edge("standard_summary", END)

triage_graph = builder.compile()
