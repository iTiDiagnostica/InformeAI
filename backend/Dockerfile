FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Expone el puerto del backend
EXPOSE 5000

# Script por defecto para desarrollo con ts-node-dev (definido en compose)
CMD ["npm", "run", "dev"]
