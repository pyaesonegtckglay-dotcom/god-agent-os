FROM python:3.11-slim

# Install system deps
RUN apt-get update && apt-get install -y \
    git curl build-essential libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Create workspace
RUN mkdir -p /tmp/workspace /tmp/repos

# HuggingFace Spaces runs as user 1000
RUN useradd -m -u 1000 user && chown -R user:user /app /tmp/workspace /tmp/repos
USER 1000

EXPOSE 7860

ENV PORT=7860
ENV HOST=0.0.0.0
ENV DB_PATH=/tmp/devin_agent.db

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1", "--loop", "asyncio"]
