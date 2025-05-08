FROM node:18-alpine

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg

WORKDIR /usr/src/app

COPY package*.json tsconfig*.json ./
RUN npm ci --build-from-source

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:dev"]