# Implements: FR-03, FR-04, FR-16
# Safety:    S1, S2, S3, S4, S10
# Owner:     ai (Group 6)

from typing import List, Optional
from pydantic import BaseModel, Field

from src.models.appointment import TriageUrgency


class TriageOutput(BaseModel):
    urgency: TriageUrgency = Field(
        description="Assessed urgency level: EMERGENCY, URGENT, ROUTINE, or SELF_CARE"
    )
    summary: str = Field(
        description="Concise clinical summary of symptoms and reasoning for urgency"
    )
    recommended_specialty: Optional[str] = Field(
        default="General Medicine",
        description="Suggested medical specialty for booking"
    )
    red_flags_detected: List[str] = Field(
        default_factory=list,
        description="List of identified red flags or acute symptoms"
    )
