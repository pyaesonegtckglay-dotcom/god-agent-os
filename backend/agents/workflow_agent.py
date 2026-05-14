"""
WorkflowAgent — n8n workflow generation, validation, deployment (Phase 7)
Workflow Factor OS merged into God Agent ecosystem
"""
import json
from typing import Dict, List
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

WORKFLOW_SYSTEM = """You are an expert n8n workflow architect and automation engineer.
You design production-grade automation workflows for:
- Telegram/Discord bots with AI responses
- Data pipelines and ETL processes
- API integrations and webhooks
- Scheduled tasks and cron jobs
- Email/Slack/notification systems
- GitHub CI/CD triggers
- AI-powered automation chains

Generate valid n8n workflow JSON that can be directly imported.
Think about error handling, retry logic, and edge cases.
"""


class WorkflowAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("WorkflowAgent", ws_manager, ai_router)

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        await self.emit(task_id, "agent_start", {
            "agent": "WorkflowAgent",
            "task": task[:80],
        }, session_id)

        task_lower = task.lower()

        if "telegram" in task_lower:
            return await self._telegram_workflow(task, task_id, session_id)
        elif "discord" in task_lower:
            return await self._discord_workflow(task, task_id, session_id)
        elif "schedule" in task_lower or "cron" in task_lower:
            return await self._scheduled_workflow(task, task_id, session_id)
        elif "github" in task_lower and ("webhook" in task_lower or "trigger" in task_lower):
            return await self._github_workflow(task, task_id, session_id)
        else:
            return await self._generic_workflow(task, task_id, session_id)

    async def _telegram_workflow(self, task: str, task_id: str, session_id: str) -> str:
        messages = [
            {"role": "system", "content": WORKFLOW_SYSTEM},
            {"role": "user", "content": (
                f"Create a complete n8n workflow for: {task}\n\n"
                f"Include:\n"
                f"1. Telegram Trigger node (webhook)\n"
                f"2. AI processing node (HTTP Request to API)\n"
                f"3. Telegram Send Message node\n"
                f"4. Error handling branch\n\n"
                f"Also provide:\n"
                f"- Setup instructions\n"
                f"- Required environment variables\n"
                f"- Testing steps\n"
                f"- The n8n workflow JSON"
            )},
        ]
        result = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.2, max_tokens=6000)
        await self.emit(task_id, "workflow_generated", {
            "type": "telegram_bot",
            "agent": "WorkflowAgent",
        }, session_id)
        return result

    async def _discord_workflow(self, task: str, task_id: str, session_id: str) -> str:
        messages = [
            {"role": "system", "content": WORKFLOW_SYSTEM},
            {"role": "user", "content": (
                f"Create a complete n8n workflow for Discord automation: {task}\n\n"
                f"Include Discord webhook integration, message processing, and response handling."
            )},
        ]
        result = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.2, max_tokens=5000)
        await self.emit(task_id, "workflow_generated", {"type": "discord", "agent": "WorkflowAgent"}, session_id)
        return result

    async def _scheduled_workflow(self, task: str, task_id: str, session_id: str) -> str:
        messages = [
            {"role": "system", "content": WORKFLOW_SYSTEM},
            {"role": "user", "content": (
                f"Create a scheduled n8n workflow for: {task}\n\n"
                f"Include cron trigger configuration, processing steps, and notification on completion/failure."
            )},
        ]
        result = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.2)
        await self.emit(task_id, "workflow_generated", {"type": "scheduled", "agent": "WorkflowAgent"}, session_id)
        return result

    async def _github_workflow(self, task: str, task_id: str, session_id: str) -> str:
        messages = [
            {"role": "system", "content": WORKFLOW_SYSTEM},
            {"role": "user", "content": (
                f"Create a GitHub webhook n8n workflow for: {task}\n\n"
                f"Include GitHub webhook trigger, event processing, and automated responses/actions."
            )},
        ]
        result = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.2)
        await self.emit(task_id, "workflow_generated", {"type": "github_webhook", "agent": "WorkflowAgent"}, session_id)
        return result

    async def _generic_workflow(self, task: str, task_id: str, session_id: str) -> str:
        messages = [
            {"role": "system", "content": WORKFLOW_SYSTEM},
            {"role": "user", "content": (
                f"Design a complete automation workflow for: {task}\n\n"
                f"Provide:\n"
                f"1. Workflow architecture diagram (text)\n"
                f"2. n8n node configuration\n"
                f"3. Step-by-step setup guide\n"
                f"4. Import-ready n8n JSON\n"
                f"5. Testing checklist"
            )},
        ]
        result = await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.3, max_tokens=6000)
        await self.emit(task_id, "workflow_generated", {"type": "custom", "agent": "WorkflowAgent"}, session_id)
        return result

    async def validate_workflow(self, workflow_json: str) -> Dict:
        """Validate n8n workflow JSON structure."""
        try:
            workflow = json.loads(workflow_json)
            nodes = workflow.get("nodes", [])
            connections = workflow.get("connections", {})
            has_trigger = any(
                n.get("type", "").startswith("n8n-nodes-base.") and
                ("Trigger" in n.get("type", "") or n.get("type", "").endswith("trigger"))
                for n in nodes
            )
            return {
                "valid": True,
                "node_count": len(nodes),
                "has_trigger": has_trigger,
                "connection_count": len(connections),
            }
        except json.JSONDecodeError as e:
            return {"valid": False, "error": f"Invalid JSON: {e}"}
        except Exception as e:
            return {"valid": False, "error": str(e)}

    async def simulate_workflow(self, workflow_json: str, test_data: Dict = {}) -> str:
        """Simulate workflow execution with test data."""
        messages = [
            {"role": "system", "content": WORKFLOW_SYSTEM},
            {"role": "user", "content": (
                f"Simulate this n8n workflow execution with test data:\n\n"
                f"Workflow: {workflow_json[:1000]}\n\n"
                f"Test data: {json.dumps(test_data)}\n\n"
                f"Walk through each node's execution and expected output."
            )},
        ]
        return await self.llm(messages, temperature=0.3)
