FROM node:24-slim
# One container for each call that is recorded (wrangler.jsonc, max_instances).
# Chromium joins the call and records it; ffmpeg makes the mp4 that Grain takes.
LABEL org.deco.service="chat-recorder" org.deco.rev="1"
RUN apt-get update && apt-get install -y --no-install-recommends chromium ffmpeg fonts-liberation fonts-noto-color-emoji ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY main.ts attribute.ts ./
ENV NODE_ENV=production CHROMIUM=/usr/bin/chromium
EXPOSE 8080
# Node 24 runs .ts directly (type stripping).
CMD ["node", "main.ts"]
