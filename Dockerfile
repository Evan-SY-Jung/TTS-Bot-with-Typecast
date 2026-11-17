FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY config ./config
COPY src ./src

# SQLite 파일이 들어가는 폴더. 볼륨이 이 소유권을 물려받는다.
RUN mkdir -p /app/data && chown node:node /app/data
USER node

CMD ["node", "src/index.ts"]
