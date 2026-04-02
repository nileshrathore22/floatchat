FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source code
COPY . .

# Preserve HuggingFace models in the app directory so they aren't lost by user limits/permissions
ENV HF_HOME=/app/.cache
RUN mkdir -p $HF_HOME

# PRE-DOWNLOAD THE ML MODELS DURING BUILD!
# This resolves Railway's looping crash by ensuring the heavy downloads
# don't happen while Railway is waiting for the server to boot up on the port.
RUN python -c "from transformers import pipeline; from sentence_transformers import SentenceTransformer; pipeline('sentiment-analysis', model='distilbert-base-uncased-finetuned-sst-2-english'); SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Start the uvicorn API server
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
