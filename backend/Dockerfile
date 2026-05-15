FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /tmp/god_workspace

ENV PORT=8000
ENV WORKSPACE_DIR=/tmp/god_workspace
ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "main_v7:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
