# ============================================================================
# Dockerfile multi-stage do portal Mercantis.
# Stage 1: builda o frontend React (Vite).
# Stage 2: imagem final enxuta com o backend Express servindo o build.
# ============================================================================

# ---- Stage 1: build do React ----
FROM node:20-bookworm-slim AS client
WORKDIR /client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

# Dependências do backend (apenas produção).
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Código do backend e build do frontend.
COPY server.js ./
COPY db ./db
COPY --from=client /client/dist ./client/dist

EXPOSE 80
CMD ["node", "server.js"]
