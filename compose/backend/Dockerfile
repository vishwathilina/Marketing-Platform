FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860 \
    PYTHONPATH=/app/backend:/app

WORKDIR /app

# Runtime/system libs required by common scientific and image dependencies.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Keep image focused on API serving for HF Spaces.
COPY backend ./backend
COPY simulation ./simulation
COPY start_hf_services.sh ./start_hf_services.sh

RUN mkdir -p /app/backend/uploads /app/backend/reports
RUN chmod +x /app/start_hf_services.sh

EXPOSE 7860

CMD ["/app/start_hf_services.sh"]
