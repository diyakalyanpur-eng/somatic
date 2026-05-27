# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the React / Vite frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /build

# Install deps first (layer-cached unless package.json changes)
COPY frontend/package*.json ./
RUN npm ci --prefer-offline --legacy-peer-deps

# Copy source and build
COPY frontend/ ./
RUN npm run build
# Output: /build/dist/

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Python backend + built frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install Python deps (layer-cached unless requirements.txt changes)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy the built frontend into ./static/ — server.py mounts this path
COPY --from=frontend-build /build/dist ./static

# Cloud Run injects PORT at runtime (default 8080).
# Never hard-code 8080 — always read from the env var.
ENV PORT=8080
EXPOSE 8080

# Single worker is correct for Cloud Run (horizontal scale via instances, not threads).
CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 1
