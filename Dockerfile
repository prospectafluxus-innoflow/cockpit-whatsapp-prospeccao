# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Instalar pnpm
RUN npm install -g pnpm@10.4.1

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar código-fonte
COPY . .

# Build do frontend (Vite) e backend (esbuild)
RUN pnpm run build:prod

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Instalar pnpm para instalar apenas dependências de produção
RUN npm install -g pnpm@10.4.1

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar apenas dependências de produção
RUN pnpm install --frozen-lockfile --prod

# Copiar build completo (frontend em dist/public, backend em dist/index.js)
COPY --from=builder /app/dist ./dist

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=8080

# Cloud Run usa a porta 8080 por padrão
EXPOSE 8080

# Iniciar o servidor
CMD ["node", "dist/index.js"]
