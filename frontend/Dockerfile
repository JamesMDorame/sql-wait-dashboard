# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package.json .
RUN npm install

COPY . .

EXPOSE 5173
# --host flag required so Vite is reachable from outside the container
CMD ["npm", "run", "dev"]
