# 1. Imagen base ligera con Node.js
FROM node:20-alpine

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache libc6-compat

# Habilitar pnpm mediante Corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copiar manifiestos de dependencias
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Instalar dependencias completas para compilar TypeScript
RUN pnpm install --frozen-lockfile

# Copiar el código fuente y archivos de configuración
COPY . .

# Compilar la aplicación NestJS a JavaScript en /dist
RUN pnpm run build

# Exponer el puerto configurado
EXPOSE 3000

# Arrancar la aplicación compilada en producción
CMD ["node", "dist/main.js"]