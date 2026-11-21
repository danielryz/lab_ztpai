# Obraz API - Node.js 22 na Alpine (konkretna wersja obrazu bazowego)
FROM node:22-alpine

WORKDIR /app

# 1) Najpierw tylko pliki zależności -> warstwa z npm ci jest brana z cache, dopóki nie zmieni się package*.json
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Dopiero potem kod aplikacji (zmiana w src/ przebudowuje tylko tę warstwę)
COPY --chown=node:node . .

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false
EXPOSE 3000

# Aplikacja nie musi działać jako root
USER node

# Migracje przy starcie kontenera, potem server.
# exec zastępuje proces sh procesem node -> node jest PID 1 i dostaje SIGTERM (graceful shutdown).
CMD ["sh", "-c", "node src/db/migrate.js && exec node src/server.js"]
