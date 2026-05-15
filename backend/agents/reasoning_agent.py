"""
ReasoningAgent v7 — Complex reasoning, analysis, and multi-step problem solving
GOD AGENT OS — Using DeepSeek R1, Qwen QwQ, o1-mini style reasoning
"""

import asyncio
import json
from typing import Dict, Any, List, Optional

import structlog

from .base_agent import BaseAgent

log = structlog.get_logger()

REASONING_SYSTEM = """You are an elite autonomous reasoning and analysis agent.
You excel at:
- Multi-step reasoning with chain-of-thought
- Complex problem decomposition and analysis
- Mathematical and logical reasoning
- Strategic planning and decision making
- Root cause analysis

Always think step by step, show your reasoning, and provide confident conclusions.
"""


class ReasoningAgent(BaseAgent):
    """
    Specialized agent for complex reasoning, analysis, and problem-solving tasks.

    Capabilities:
    - Multi-step reasoning with chain-of-thought
    - Complex problem decomposition
    - Mathematical reasoning
    - Logical analysis
    - Strategic planning
    """

    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("ReasoningAgent", ws_manager, ai_router)
        self.reasoning_depth = 3
        self.max_reasoning_tokens = 16000

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        """Execute reasoning task."""
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        await self.emit(task_id, "agent_start", {
            "agent": "ReasoningAgent",
            "task": task[:80],
        }, session_id)

        try:
            # Step 1: Analyze the problem
            analysis = await self._analyze_problem(task, context, task_id, session_id)

            # Step 2: Decompose if complex
            if len(task.split()) > 30:
                sub_problems = await self._decompose_problem(task, analysis, task_id, session_id)
                solutions = []
                for sub in sub_problems[:3]:
                    sol = await self._solve_sub_problem(sub, context, task_id, session_id)
                    solutions.append(sol)
                result = await self._synthesize_answer(task, analysis, sub_problems, solutions, task_id, session_id)
            else:
                result = analysis

            await self.emit(task_id, "reasoning_complete", {
                "agent": "ReasoningAgent",
                "reasoning_depth": self.reasoning_depth,
            }, session_id)

            return result

        except Exception as e:
            log.error("ReasoningAgent failed", error=str(e))
            return "Reasoning agent encountered an error: " + str(e)

    async def _analyze_problem(self, problem: str, context: Dict, task_id: str, session_id: str) -> str:
        """Analyze the problem using reasoning model."""
        messages = [
            {"role": "system", "content": REASONING_SYSTEM},
            {"role": "user", "content": (
                "Analyze this problem step by step:\n\n"
                + problem + "\n\n"
                "Provide:\n"
                "1. Problem type and complexity\n"
                "2. Key constraints and requirements\n"
                "3. Step-by-step solution\n"
                "4. Final answer/recommendation"
            )},
        ]
        return await self.llm(
            messages,
            task_id=task_id,
            session_id=session_id,
            temperature=0.2,
            max_tokens=self.max_reasoning_tokens,
        )

    async def _decompose_problem(self, problem: str, analysis: str, task_id: str, session_id: str) -> List[str]:
        """Break down complex problem into sub-problems."""
        messages = [
            {"role": "system", "content": REASONING_SYSTEM},
            {"role": "user", "content": (
                "Break this complex problem into 3 specific sub-problems:\n\n"
                + problem + "\n\n"
                "Initial analysis: " + analysis[:500] + "\n\n"
                "List each sub-problem on a new line starting with '1.', '2.', '3.'"
            )},
        ]
        raw = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.3, max_tokens=2000)
        # Parse numbered sub-problems
        lines = raw.split("\n")
        sub_problems = []
        for line in lines:
            line = line.strip()
            if line and any(line.startswith(str(i) + ".") for i in range(1, 10)):
                sub_problems.append(line)
        return sub_problems if sub_problems else [problem]

    async def _solve_sub_problem(self, sub_problem: str, context: Dict, task_id: str, session_id: str) -> str:
        """Solve individual sub-problem."""
        messages = [
            {"role": "system", "content": REASONING_SYSTEM},
            {"role": "user", "content": "Solve this specific problem:\n\n" + sub_problem},
        ]
        return await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.2, max_tokens=4096)

    async def _synthesize_answer(
        self,
        original: str,
        analysis: str,
        sub_problems: List[str],
        solutions: List[str],
        task_id: str,
        session_id: str,
    ) -> str:
        """Synthesize final answer from all reasoning steps."""
        solutions_text = "\n".join(
            "Sub-problem " + str(i + 1) + ": " + sol[:300]
            for i, sol in enumerate(solutions)
        )
        messages = [
            {"role": "system", "content": REASONING_SYSTEM},
            {"role": "user", "content": (
                "Original problem: " + original + "\n\n"
                "Analysis: " + analysis[:800] + "\n\n"
                "Solutions to sub-problems:\n" + solutions_text + "\n\n"
                "Provide a comprehensive final answer that integrates all insights."
            )},
        ]
        return await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.3, max_tokens=8192)

    def get_status(self) -> Dict[str, Any]:
        """Get agent status."""
        return {
            "name": self.name,
            "status": "ready",
            "capabilities": [
                "Multi-step reasoning",
                "Problem decomposition",
                "Mathematical reasoning",
                "Logical analysis",
                "Strategic planning",
            ],
            "reasoning_depth": self.reasoning_depth,
        }


__all__ = ["ReasoningAgent"]
