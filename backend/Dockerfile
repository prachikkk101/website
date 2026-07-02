FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm install

COPY . .

# DATABASE_URL must be present for prisma generate (called by npm run build).
# This placeholder is only used at build time; Fly.io injects the real secret at runtime.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/db"

RUN npx prisma generate
RUN npm run build

EXPOSE 5001

CMD ["node", "dist/index.js"]
