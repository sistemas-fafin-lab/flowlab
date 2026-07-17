# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# FlowLAB (Vite SPA + API serverless) — imagem multi-stage.
# Serve o frontend buildado (dist/) e as rotas da API via api/server.ts.
# ─────────────────────────────────────────────────────────────────────────────

# 1) Builder — instala deps, builda frontend e compila API + server.
FROM node:22-alpine AS builder
WORKDIR /app

# Manifestos primeiro (cache de deps).
COPY package.json package-lock.json ./
RUN npm ci

# Fontes necessárias ao build.
COPY tsconfig.json tsconfig.app.json vite.config.ts tailwind.config.js postcss.config.js ./
COPY index.html ./
COPY public ./public
COPY src ./src
COPY api ./api

# Build do frontend (SPA → dist/).
RUN npm run build

# Compilação da API + server.ts para JS (ESM).
RUN npx tsc -p api/tsconfig.json --outDir dist-api

# 2) Prod deps — apenas runtime, sem devDependencies.
FROM node:22-alpine AS proddeps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# 3) Runtime — imagem final mínima.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app

# Frontend estático.
COPY --from=builder /app/dist ./dist

# API compilada (handlers + server).
COPY --from=builder /app/dist-api ./api

# Dependências de runtime.
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
USER node

# Healthcheck no próprio servidor (rota de fallback/index.html).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "api/server.js"]
