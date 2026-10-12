# Implements: FR-03, FR-04
# Safety:    S10
# Owner:     ai (Group 6)

import os
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent / "prompts"


class PromptRegistry:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir

    def get(self, prompt_name: str, version: str) -> str:
        filename = f"{prompt_name}_{version}.txt"
        file_path = self.base_dir / filename
        if not file_path.exists():
            raise FileNotFoundError(
                f"Prompt {filename} not found in {self.base_dir}"
            )
        return file_path.read_text(encoding="utf-8")


prompts = PromptRegistry(PROMPTS_DIR)
