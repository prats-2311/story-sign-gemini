try:
    from .prompts.asl import ASL_SYSTEM_INSTRUCTION
    from .prompts.harmony import HARMONY_SYSTEM_INSTRUCTION
    from .prompts.reconnect import RECONNECT_SYSTEM_INSTRUCTION
except ImportError:
    from prompts.asl import ASL_SYSTEM_INSTRUCTION
    from prompts.harmony import HARMONY_SYSTEM_INSTRUCTION
    from prompts.reconnect import RECONNECT_SYSTEM_INSTRUCTION

class SessionManager:
    def __init__(self):
        self.prompts = {
            "ASL": ASL_SYSTEM_INSTRUCTION,
            "HARMONY": HARMONY_SYSTEM_INSTRUCTION,
            "RECONNECT": RECONNECT_SYSTEM_INSTRUCTION
        }

    def get_system_instruction(self, mode: str) -> str:
        return self.prompts.get(mode.upper(), ASL_SYSTEM_INSTRUCTION)

    def get_model_config(self, mode: str):
        # Can be customized per mode if needed (e.g., temperature)
        return {
            "generation_config": {
                "response_modalities": ["TEXT", "AUDIO"],
                "temperature": 0.7
            }
        }
