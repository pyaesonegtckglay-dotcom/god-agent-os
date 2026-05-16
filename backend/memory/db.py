"""
Production SQLite Database — Async via aiosqlite
Handles tasks, memory, sessions, events
"""

import aiosqlite
import os
import json
import time
from typing import Optional, List, Dict, Any
import structlog

log = structlog.get_logger()


def _resolve_db_path() -> str:
    explicit = os.environ.get("DB_PATH")
    if explicit:
        return explicit

    preferred_dir = "/data" if os.path.isdir("/data") else "/tmp"
    return os.path.join(preferred_dir, "god_agent_os.db")


DB_PATH = _resolve_db_path()


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    """Initialize all tables."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    log.info("Initializing database", path=DB_PATH)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")

        await db.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                project_id TEXT,
                goal TEXT NOT NULL,
                status TEXT DEFAULT 'queued',
                plan TEXT,
                result TEXT,
                error TEXT,
                metadata TEXT DEFAULT '{}',
                created_at REAL,
                started_at REAL,
                completed_at REAL,
                retry_count INTEGER DEFAULT 0
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS task_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                data TEXT DEFAULT '{}',
                timestamp REAL,
                FOREIGN KEY (task_id) REFERENCES tasks(id)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                project_id TEXT,
                memory_type TEXT NOT NULL,
                key TEXT,
                content TEXT NOT NULL,
                metadata TEXT DEFAULT '{}',
                embedding TEXT,
                created_at REAL,
                updated_at REAL
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                user_id TEXT,
                title TEXT DEFAULT '',
                metadata TEXT DEFAULT '{}',
                created_at REAL,
                last_active REAL
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS github_ops (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT,
                operation TEXT NOT NULL,
                repo TEXT,
                branch TEXT,
                status TEXT DEFAULT 'pending',
                result TEXT,
                created_at REAL
            )
        """)

        await db.execute("CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_events_task ON task_events(task_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_memory_session ON memory(session_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_memory_project ON memory(project_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(memory_type)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active)")

        await db.commit()
    log.info("✅ Database initialized")


# ─── Session CRUD ──────────────────────────────────────────────────────────────

async def upsert_session(
    session_id: str,
    title: str = "",
    project_id: str = "",
    user_id: str = "",
    metadata: Optional[dict] = None,
):
    now = time.time()
    metadata = metadata or {}
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id, title, metadata, created_at FROM sessions WHERE id = ?", (session_id,)) as cursor:
            row = await cursor.fetchone()

        if row:
            existing_title = row[1] or ""
            merged_title = existing_title or title
            existing_metadata = json.loads(row[2] or "{}")
            existing_metadata.update(metadata)
            await db.execute(
                """
                UPDATE sessions
                SET project_id = ?, user_id = ?, title = ?, metadata = ?, last_active = ?
                WHERE id = ?
                """,
                (project_id, user_id, merged_title, json.dumps(existing_metadata), now, session_id),
            )
        else:
            await db.execute(
                """
                INSERT INTO sessions (id, project_id, user_id, title, metadata, created_at, last_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (session_id, project_id, user_id, title, json.dumps(metadata), now, now),
            )
        await db.commit()


async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            data = dict(row)
            data["metadata"] = json.loads(data.get("metadata") or "{}")
            return data


async def list_sessions(limit: int = 100) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM sessions ORDER BY last_active DESC LIMIT ?",
            (limit,),
        ) as cursor:
            rows = await cursor.fetchall()
            result = []
            for row in rows:
                data = dict(row)
                data["metadata"] = json.loads(data.get("metadata") or "{}")
                result.append(data)
            return result


# ─── Task CRUD ─────────────────────────────────────────────────────────────────

async def create_task(task_id: str, goal: str, session_id: str = "", project_id: str = "", metadata: dict = {}):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO tasks (id, session_id, project_id, goal, status, metadata, created_at)
            VALUES (?, ?, ?, ?, 'queued', ?, ?)
        """, (task_id, session_id, project_id, goal, json.dumps(metadata), time.time()))
        await db.commit()


async def update_task_status(task_id: str, status: str, **kwargs):
    fields = ["status = ?"]
    values = [status]
    if status == "executing":
        fields.append("started_at = ?")
        values.append(time.time())
    if status in ("completed", "failed", "cancelled"):
        fields.append("completed_at = ?")
        values.append(time.time())
    for k, v in kwargs.items():
        if k in ("plan", "result", "error"):
            fields.append(f"{k} = ?")
            values.append(v if isinstance(v, str) else json.dumps(v))
        elif k == "retry_count":
            fields.append("retry_count = ?")
            values.append(v)
    values.append(task_id)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", values)
        await db.commit()


async def get_task(task_id: str) -> Optional[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                d = dict(row)
                d["metadata"] = json.loads(d.get("metadata") or "{}")
                d["plan"] = json.loads(d["plan"]) if d.get("plan") else None
                return d
    return None


async def list_tasks(session_id: str = "", limit: int = 50) -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if session_id:
            async with db.execute(
                "SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
                (session_id, limit)
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with db.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,)
            ) as cursor:
                rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def save_task_event(task_id: str, event_type: str, data: dict = {}):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO task_events (task_id, event_type, data, timestamp)
            VALUES (?, ?, ?, ?)
        """, (task_id, event_type, json.dumps(data), time.time()))
        await db.commit()


async def get_task_events(task_id: str) -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM task_events WHERE task_id = ? ORDER BY timestamp ASC", (task_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


# ─── Memory CRUD ───────────────────────────────────────────────────────────────

async def save_memory(
    content: str,
    memory_type: str,
    session_id: str = "",
    project_id: str = "",
    key: str = "",
    metadata: dict = {}
):
    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO memory (session_id, project_id, memory_type, key, content, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (session_id, project_id, memory_type, key, content, json.dumps(metadata), now, now))
        await db.commit()


async def search_memory(query: str, session_id: str = "", project_id: str = "", limit: int = 20) -> List[Dict]:
    """Simple keyword search (upgrade to vector search in production)."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        q = f"%{query}%"
        if session_id:
            async with db.execute(
                "SELECT * FROM memory WHERE session_id = ? AND content LIKE ? ORDER BY updated_at DESC LIMIT ?",
                (session_id, q, limit)
            ) as cursor:
                rows = await cursor.fetchall()
        elif project_id:
            async with db.execute(
                "SELECT * FROM memory WHERE project_id = ? AND content LIKE ? ORDER BY updated_at DESC LIMIT ?",
                (project_id, q, limit)
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with db.execute(
                "SELECT * FROM memory WHERE content LIKE ? ORDER BY updated_at DESC LIMIT ?",
                (q, limit)
            ) as cursor:
                rows = await cursor.fetchall()
        return [_decode_memory_row(dict(r)) for r in rows]


async def get_project_memory(project_id: str, memory_type: str = "", limit: int = 100) -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if memory_type:
            async with db.execute(
                "SELECT * FROM memory WHERE project_id = ? AND memory_type = ? ORDER BY updated_at DESC LIMIT ?",
                (project_id, memory_type, limit)
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with db.execute(
                "SELECT * FROM memory WHERE project_id = ? ORDER BY updated_at DESC LIMIT ?",
                (project_id, limit)
            ) as cursor:
                rows = await cursor.fetchall()
        return [_decode_memory_row(dict(r)) for r in rows]


async def get_history(session_id: str, limit: int = 50) -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM memory WHERE session_id = ? AND memory_type = 'conversation' ORDER BY created_at ASC LIMIT ?",
            (session_id, limit)
        ) as cursor:
            rows = await cursor.fetchall()
            return [_decode_memory_row(dict(r)) for r in rows]


def _decode_memory_row(row: Dict[str, Any]) -> Dict[str, Any]:
    row["metadata"] = json.loads(row.get("metadata") or "{}")
    return row
