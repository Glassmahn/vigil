FROM node:20-alpine

RUN apk add --no-cache python3 make g++ git

WORKDIR /app

COPY agent/package.json agent/package-lock.json* ./
RUN npm install && npm cache clean --force

COPY agent/src ./src
COPY agent/tsconfig.json ./

RUN mkdir -p /data

EXPOSE 3001

CMD ["npm", "run", "start"]
