"""
🚀 GOD MODE+ v3 - Reasoning Agent
Specialized agent for complex reasoning tasks using DeepSeek R1, Qwen QwQ, o1-mini
Version: 3.0.0
"""

import asyncio
import json
from typing import Dict, Any, Optional

import structlog

from core.agent import BaseAgent

log = structlog.get_logger()


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

    def __init__(self, ws_manager, ai_router):
        """Initialize Reasoning Agent."""
        super().__init__(
            name="ReasoningAgent",
            color="🟦",
            description="Complex reasoning and analysis",
            ws_manager=ws_manager,
            ai_router=ai_router,
        )
        self.reasoning_depth = 3  # Number of reasoning steps
        self.max_reasoning_tokens = 16000

    async def process(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process reasoning task with multi-step reasoning.
        """
        user_message = task.get("content", "")
        session_id = task.get("session_id", "")
        context = task.get("context", {})

        log.info("🧠 Reasoning Agent activated", message=user_message[:100])

        try:
            # Step 1: Analyze the problem
            analysis = await self._analyze_problem(user_message, context)
            await self._broadcast(session_id, {
                "type": "reasoning_step",
                "step": "analysis",
                "data": analysis,
            })

            # Step 2: Break down into sub-problems
            sub_problems = await self._decompose_problem(user_message, analysis)
            await self._broadcast(session_id, {
                "type": "reasoning_step",
                "step": "decomposition",
                "data": sub_problems,
            })

            # Step 3: Solve each sub-problem
            solutions = []
            for i, sub_problem in enumerate(sub_problems):
                solution = await self._solve_sub_problem(sub_problem, context)
                solutions.append(solution)
                await self._broadcast(session_id, {
                    "type": "reasoning_step",
                    "step": f"solution_{i+1}",
                    "data": solution,
                })

            # Step 4: Synthesize final answer
            final_answer = await self._synthesize_answer(
                user_message,
                analysis,
                sub_problems,
                solutions
            )

            await self._broadcast(session_id, {
                "type": "reasoning_complete",
                "answer": final_answer,
                "reasoning_depth": self.reasoning_depth,
            })

            return {
                "success": True,
                "agent": self.name,
                "answer": final_answer,
                "reasoning_steps": {
                    "analysis": analysis,
                    "sub_problems": sub_problems,
                    "solutions": solutions,
                },
            }

        except Exception as e:
            log.error("❌ Reasoning Agent failed", error=str(e))
            return {
                "success": False,
                "agent": self.name,
                "error": str(e),
            }

    async def _analyze_problem(self, problem: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze the problem using reasoning model.
        """
        prompt = f"""Analyze this problem and identify:
1. Core problem statement
2. Key constraints
3. Required information
4. Potential approaches

Problem: {problem}

Provide structured analysis."""

        response = await self.ai_router.route(
            prompt,
            context={"task_type": "reasoning"},
            optimize_for="quality"
        )

        return {
            "problem_type": self._classify_problem(problem),
            "complexity": self._estimate_complexity(problem),
            "analysis": response.get("response", ""),
        }

    async def _decompose_problem(
        self,
        problem: str,
        analysis: Dict[str, Any]
    ) -> list:
        """
        Break down complex problem into manageable sub-problems.
        """
        prompt = f"""Based on this analysis, break down the problem into 3-5 specific sub-problems:

Problem: {problem}
Analysis: {json.dumps(analysis, indent=2)}

List each sub-problem clearly and explain the dependencies."""

        response = await self.ai_router.route(
            prompt,
            context={"task_type": "reasoning"},
            optimize_for="quality"
        )

        # Parse sub-problems from response
        sub_problems = self._parse_sub_problems(response.get("response", ""))
        return sub_problems

    async def _solve_sub_problem(
        self,
        sub_problem: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Solve individual sub-problem.
        """
        prompt = f"""Solve this sub-problem step by step:

{sub_problem}

Provide:
1. Step-by-step solution
2. Key insights
3. Confidence level (0-100)"""

        response = await self.ai_router.route(
            prompt,
            context={"task_type": "reasoning"},
            optimize_for="quality"
        )

        return {
            "sub_problem": sub_problem,
            "solution": response.get("response", ""),
            "model_used": response.get("model", "unknown"),
        }

    async def _synthesize_answer(
        self,
        original_problem: str,
        analysis: Dict[str, Any],
        sub_problems: list,
        solutions: list
    ) -> str:
        """
        Synthesize final answer from all reasoning steps.
        """
        synthesis_prompt = f"""Based on the analysis and solutions, provide a comprehensive answer:

Original Problem: {original_problem}

Analysis: {json.dumps(analysis, indent=2)}

Solutions:
{json.dumps(solutions, indent=2)}

Provide a clear, well-reasoned final answer that:
1. Directly addresses the original problem
2. Integrates insights from all sub-problems
3. Explains the reasoning clearly
4. Suggests any follow-up actions if needed"""

        response = await self.ai_router.route(
            synthesis_prompt,
            context={"task_type": "reasoning"},
            optimize_for="quality"
        )

        return response.get("response", "Unable to synthesize answer")

    def _classify_problem(self, problem: str) -> str:
        """Classify problem type."""
        problem_lower = problem.lower()
        
        if any(word in problem_lower for word in ["math", "calculate", "equation"]):
            return "mathematical"
        elif any(word in problem_lower for word in ["logic", "reason", "why"]):
            return "logical"
        elif any(word in problem_lower for word in ["plan", "strategy", "approach"]):
            return "strategic"
        elif any(word in problem_lower for word in ["analyze", "compare", "evaluate"]):
            return "analytical"
        else:
            return "general"

    def _estimate_complexity(self, problem: str) -> str:
        """Estimate problem complexity."""
        word_count = len(problem.split())
        
        if word_count < 20:
            return "simple"
        elif word_count < 100:
            return "moderate"
        else:
            return "complex"

    def _parse_sub_problems(self, response: str) -> list:
        """Parse sub-problems from model response."""
        # Simple parsing - can be enhanced
        lines = response.split("\n")
        sub_problems = []
        
        for line in lines:
            line = line.strip()
            if line and any(line.startswith(f"{i}.") for i in range(1, 10)):
                sub_problems.append(line)
        
        return sub_problems if sub_problems else [response]

    async def _broadcast(self, session_id: str, data: Dict[str, Any]):
        """Broadcast reasoning progress to client."""
        if self.ws_manager:
            await self.ws_manager.broadcast(
                room=f"chat:{session_id}",
                message={
                    "type": "agent_message",
                    "agent": self.name,
                    "color": self.color,
                    **data,
                }
            )

    def get_status(self) -> Dict[str, Any]:
        """Get agent status."""
        return {
            "name": self.name,
            "color": self.color,
            "status": "ready",
            "capabilities": [
                "Multi-step reasoning",
                "Problem decomposition",
                "Mathematical reasoning",
                "Logical analysis",
                "Strategic planning",
            ],
            "reasoning_depth": self.reasoning_depth,
            "max_reasoning_tokens": self.max_reasoning_tokens,
        }


__all__ = ["ReasoningAgent"]
