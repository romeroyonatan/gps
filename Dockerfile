# syntax=docker/dockerfile:1-labs

FROM oven/bun:1 AS dependencias
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
# --parents copia cada package.json conservando su ruta, y por eso esta linea
# no hay que tocarla al agregar un paquete: la lista explicita se olvidaba y el
# install fallaba recien en el CI. Necesita el frontend 1-labs de Dockerfile.
COPY --parents packages/*/package.json services/*/package.json apps/*/package.json ./
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
