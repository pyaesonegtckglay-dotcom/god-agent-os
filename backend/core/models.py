"""
Pydantic Models — Task, Chat, Memory, GitHub
"""

import time
import uuid
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


def gen_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


# ─── Enums ─────────────────────────────────────────────────────────────────────

class TaskStatus(str, Enum):
    queued = "queued"
    initializing = "initializing"
    planning = "planning"
    executing = "executing"
    streaming = "streaming"
    waiting_input = "waiting_input"
    retrying = "retrying"
    finalizing = "finalizing"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class EventType(str, Enum):
    task_created = "task_created"
    task_queued = "task_queued"
    task_started = "task_started"
    plan_generated = "plan_generated"
    step_started = "step_started"
    step_progress = "step_progress"
    tool_called = "tool_called"
    tool_result = "tool_result"
    llm_chunk = "llm_chunk"
    memory_updated = "memory_updated"
    retry_attempt = "retry_attempt"
    step_completed = "step_completed"
    warning = "warning"
    error = "error"
    task_completed = "task_completed"
    task_failed = "task_failed"
    heartbeat = "heartbeat"


class MemoryType(str, Enum):
    conversation = "conversation"
    task = "task"
    project = "project"
    execution = "execution"
    tool = "tool"
    error = "error"
    repo = "repo"
    planning = "planning"


# ─── Task Models ───────────────────────────────────────────────────────────────

class TaskCreateRequest(BaseModel):
    goal: str = Field(..., min_length=1, max_length=10000, description="What should the agent do?")
    session_id: str = Field(default_factory=lambda: gen_id("sess_"))
    project_id: str = Field(default="")
    stream: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)
    github_repo: Optional[str] = None
    auto_commit: bool = False


class TaskStep(BaseModel):
    id: str = Field(default_factory=lambda: gen_id("step_"))
    name: str
    description: str = ""
    tool: Optional[str] = None
    status: str = "pending"
    output: Optional[str] = None
    error: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    duration_ms: Optional[float] = None


class TaskPlan(BaseModel):
    goal: str
    steps: List[TaskStep]
    estimated_duration: int = 0
    tools_needed: List[str] = []
    created_at: float = Field(default_factory=time.time)


class TaskResponse(BaseModel):
    id: str
    goal: str
    status: TaskStatus
    session_id: str
    project_id: str
    plan: Optional[TaskPlan] = None
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    retry_count: int = 0
    stream_url: Optional[str] = None
    ws_url: Optional[str] = None


class TaskCancelRequest(BaseModel):
    reason: str = "User cancelled"


class TaskRetryRequest(BaseModel):
    reset_state: bool = True


# ─── Chat Models ───────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str
    timestamp: float = Field(default_factory=time.time)


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: str = Field(default_factory=lambda: gen_id("sess_"))
    project_id: str = ""
    stream: bool = True
    model: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: int = 4096
    system_prompt: Optional[str] = None


class GoalRequest(BaseModel):
    goal: str = Field(..., min_length=1, max_length=10000)
    session_id: str = Field(default_factory=lambda: gen_id("sess_"))
    project_id: str = ""
    stream: bool = True
    auto_execute: bool = True
    github_repo: Optional[str] = None


# ─── Memory Models ─────────────────────────────────────────────────────────────

class MemorySaveRequest(BaseModel):
    content: str
    memory_type: MemoryType
    session_id: str = ""
    project_id: str = ""
    key: str = ""
    metadata: Dict[str, Any] = {}


class MemorySearchRequest(BaseModel):
    query: str
    session_id: str = ""
    project_id: str = ""
    limit: int = 20


# ─── GitHub Models ─────────────────────────────────────────────────────────────

class GitHubCloneRequest(BaseModel):
    repo_url: str
    branch: str = "main"
    local_path: Optional[str] = None


class GitHubCreateRepoRequest(BaseModel):
    name: str
    description: str = ""
    private: bool = False
    auto_init: bool = True


class GitHubCommitRequest(BaseModel):
    repo: str
    branch: str = "main"
    files: Dict[str, str]  # path → content
    message: str
    create_branch: bool = False


class GitHubPRRequest(BaseModel):
    repo: str
    title: str
    body: str = ""
    head: str
    base: str = "main"
    draft: bool = False


class GitHubIssueRequest(BaseModel):
    repo: str
    title: str
    body: str = ""
    labels: List[str] = []


# ─── Event Schema (unified) ────────────────────────────────────────────────────

class StreamEvent(BaseModel):
    type: str
    task_id: str = ""
    session_id: str = ""
    timestamp: float = Field(default_factory=time.time)
    data: Dict[str, Any] = {}
