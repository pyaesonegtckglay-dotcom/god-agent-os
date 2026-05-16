FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev libssl-dev curl nodejs npm \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

RUN mkdir -p /data /tmp/god_sandbox

ENV PORT=7860
ENV PYTHONPATH=/app
EXPOSE 7860

CMD ["python", "-m", "uvicorn", "main_v9:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
