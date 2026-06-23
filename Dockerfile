FROM node:20-alpine

# Configurar permisos para Hugging Face (requiere que la app corra con permisos seguros, no root)
RUN mkdir -p /app && chown -R node:node /app
WORKDIR /app

# Ejecutar todo usando el usuario 'node' (uid 1000)
USER node

# Copiar configuraciones e instalar
COPY --chown=node:node package*.json ./
RUN npm install

# Copiar el resto del código
COPY --chown=node:node . .

# Compilar proyecto
RUN npm run build

# Configurar variables de entorno y puerto de Hugging Face
ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

# Iniciar aplicación
CMD ["npm", "start"]
