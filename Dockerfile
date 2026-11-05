FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
# Local cache path; when DATABASE_URL is linked (e.g. Railway Postgres), all data hydrates from & syncs to PostgreSQL
ENV DB_PATH=/data/christmas.db

RUN mkdir -p /data
EXPOSE 3001

CMD ["npm", "start"]
