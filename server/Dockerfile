FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

RUN mkdir -p uploads

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
