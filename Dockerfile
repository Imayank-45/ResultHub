# Stage 1: Build the frontend React app
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the FastAPI backend
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies required by Chromium/Playwright and the app stack.
# python:3.10-slim is Debian-based, so we install the missing browser runtime libs here.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgl1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium browser and confirm the runtime libraries are present.
RUN python -m playwright install --with-deps chromium

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy the rest of the application code
COPY backend/ ./backend
COPY automation/ ./automation
COPY report_generator/ ./report_generator
COPY scripts/ ./scripts

# Install report_generator requirements
COPY report_generator/requirements.txt ./report_generator/requirements.txt
RUN pip install --no-cache-dir -r report_generator/requirements.txt

# Create folders for data storage
RUN mkdir -p data/reports data/uploads

# Expose port and run server
ENV PORT=8000
CMD uvicorn backend.server:app --host 0.0.0.0 --port $PORT
