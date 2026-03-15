FROM node:20-alpine

RUN apk add --no-cache openssl su-exec

WORKDIR /app

COPY package.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

RUN mkdir -p uploads

RUN adduser -D appuser && chown -R appuser:appuser /app

EXPOSE 3001

# Start as root so the entrypoint can fix volume ownership, then drop to appuser
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
