FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc g++ libffi-dev libssl-dev curl nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Create sandbox workspace
RUN mkdir -p /tmp/god_sandbox

# Expose port for HuggingFace Spaces
EXPOSE 7860

# Environment
ENV PORT=7860
ENV PYTHONPATH=/app
ENV DB_PATH=/tmp/god_agent_os.db

# Start with distributed runtime
CMD ["python", "-m", "uvicorn", "main_v9:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
