FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git curl build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /tmp/god_workspace /tmp/workspace

ENV PYTHONUNBUFFERED=1
ENV DB_PATH=/tmp/devin_agent.db
ENV WORKSPACE_DIR=/tmp/god_workspace

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
