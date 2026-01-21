# Base Image: Lightweight Python
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (PortAudio for audio, FFmpeg for media)
# Note: Google Cloud Run has limited audio hardware access, but these libs prevent import errors.
RUN apt-get update && apt-get install -y \
    gcc \
    portaudio19-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements separately for better caching
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY backend /app/backend
COPY .env .

# Expose the port Uvicorn will run on
EXPOSE 8080

# Run the application
# Using host 0.0.0.0 is crucial for Cloud Run
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
