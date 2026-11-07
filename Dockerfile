FROM node:22-alpine AS builder
WORKDIR /app

# Install ffmpeg for Ogg Opus -> AAC voice conversion & MP4 video compression
RUN apk add --no-cache ffmpeg postgresql-client

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

VOLUME ["/app/data"]

CMD ["npm", "run", "start"]
