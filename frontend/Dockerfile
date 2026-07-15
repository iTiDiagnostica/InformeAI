FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Expone el puerto del frontend Next.js
EXPOSE 3000

# Comando para correr en desarrollo con soporte para recarga en caliente
# -H 0.0.0.0 necesario para que el servidor sea accesible fuera del contenedor Docker
CMD ["npx", "next", "dev", "-H", "0.0.0.0"]
