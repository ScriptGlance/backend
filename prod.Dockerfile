FROM node:18-alpine AS builder

RUN apk add --no-cache \
    python3 \
    make \
    g++

WORKDIR /usr/src/app

COPY package*.json tsconfig*.json ./

RUN npm ci --build-from-source

COPY . .

RUN npm run build

FROM node:18-alpine

ENV NODE_ENV=production

RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++

WORKDIR /usr/src/app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /usr/src/app/package*.json ./

RUN npm ci --omit=dev --build-from-source

RUN apk del python3 make g++

COPY --from=builder --chown=appuser:appgroup /usr/src/app/dist ./dist

RUN mkdir -p /usr/src/app/uploads && \
    chown -R appuser:appgroup /usr/src/app/uploads

EXPOSE 3000
USER appuser

CMD ["npm", "run", "start:prod"]