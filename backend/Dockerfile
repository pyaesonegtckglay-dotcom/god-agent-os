FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y \
    git curl build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Create workspace dir
RUN mkdir -p /tmp/god_workspace

ENV PYTHONUNBUFFERED=1
ENV DB_PATH=/tmp/devin_agent.db
ENV WORKSPACE_DIR=/tmp/god_workspace

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
