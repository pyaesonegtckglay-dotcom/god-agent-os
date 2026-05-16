FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    gcc g++ libffi-dev libssl-dev curl git \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Create workspace and data directories
RUN mkdir -p /tmp/god_workspace /tmp/god_sandbox /data

# Expose port for HuggingFace Spaces
EXPOSE 7860

# Environment
ENV PORT=7860
ENV PYTHONPATH=/app
ENV DB_PATH=/data/god_agent_v11.db
ENV WORKSPACE_DIR=/tmp/god_workspace

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:7860/health || exit 1

# Start GOD AGENT OS v11
CMD ["python", "-m", "uvicorn", "main_v11:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1", "--log-level", "info"]
