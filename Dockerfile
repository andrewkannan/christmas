FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/data/christmas.db

RUN mkdir -p /data
EXPOSE 3001

CMD ["npm", "start"]
