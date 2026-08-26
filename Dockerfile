# syntax=docker/dockerfile:1

FROM oven/bun:1 AS dependencias
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY packages/core/package.json packages/core/
COPY packages/sistema/package.json packages/sistema/
COPY packages/api/package.json packages/api/
COPY services/backend/package.json services/backend/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
RUN bun install --frozen-lockfile

FROM dependencias AS construccion
COPY . .
RUN bun run --filter @gps/api codegen

FROM oven/bun:1-slim AS produccion
WORKDIR /app
ENV ENTORNO=produccion
ENV PUERTO=3000
COPY --from=construccion /app/node_modules ./node_modules
COPY --from=construccion /app/package.json ./package.json
# bunfig.toml es obligatorio en la etapa final, no solo en la de dependencias:
# el CMD corre con cwd /app y Bun lee bunfig.toml SOLO desde el cwd. Sin este
# archivo no se carga bun-plugin-tailwind y la imagen sirve la pagina sin
# estilos, reportando salud perfecta.
COPY --from=construccion /app/bunfig.toml ./bunfig.toml
COPY --from=construccion /app/packages ./packages
COPY --from=construccion /app/services ./services
COPY --from=construccion /app/apps/web ./apps/web
EXPOSE 3000
CMD ["bun", "services/backend/src/index.ts"]
