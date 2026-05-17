# God Agent OS — Phase 1 backend (FastAPI + E2B + SSE)
FROM python:3.11-slim

WORKDIR /app

# System deps (curl for healthcheck, git for any sandbox-side workflows)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git \
 && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r /app/requirements.txt

# App code
COPY . /app

ENV PORT=7860 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:7860/health || exit 1

CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1", "--log-level", "info", "--no-access-log"]
