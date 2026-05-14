FROM node:20-alpine

# Instala dependências do SO necessárias para puppeteer/canvas (frequentemente usadas com Baileys/QR Code)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    git \
    python3 \
    make \
    g++

WORKDIR /app

# Copia os arquivos de configuração
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia o restante do código
COPY . .

# Otimização de memória para ambientes gratuitos limitados
ENV NODE_ENV=production

# Faz o build do frontend Vite
RUN npm run build

# Expõe a porta que o express usa
EXPOSE 3000

# Inicia o servidor Node.js otimizado para baixo uso de RAM
CMD ["npx", "--node-options=--max-old-space-size=256", "tsx", "server.ts"]
