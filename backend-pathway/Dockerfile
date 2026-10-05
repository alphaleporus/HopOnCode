FROM python:3.11-slim

LABEL maintainer="FleetFusion Team"
LABEL description="Pathway-based real-time streaming backend"

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements-pathway.txt /app/

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-pathway.txt

# Copy application code
COPY core/ /app/core/
COPY connectors/ /app/connectors/
COPY pipeline/ /app/pipeline/
COPY realtime/ /app/realtime/
COPY llm/ /app/llm/
COPY data/ /app/data/
COPY main.py /app/

RUN mkdir -p /app/output

# Bind all interfaces inside the container
ENV WEBSOCKET_HOST=0.0.0.0 \
    WEBSOCKET_PORT=8765 \
    INGEST_HOST=0.0.0.0 \
    INGEST_PORT=8090

# 8765: realtime WebSocket hub (+ GET /health), 8090: HTTP telemetry ingest
EXPOSE 8765 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8765/health', timeout=3)"

# Single process: Pathway pipeline + realtime hub
CMD ["python", "main.py"]
