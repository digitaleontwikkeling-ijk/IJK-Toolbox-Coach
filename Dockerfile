# IJK Toolbox Coach — productie-image (Next.js standalone).
FROM node:22-alpine AS basis
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM basis AS afhankelijkheden
COPY package.json package-lock.json ./
RUN npm ci

FROM basis AS bouw
COPY --from=afhankelijkheden /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM basis AS draai
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
# Standalone server, statische bestanden, content en SQL-migraties (worden bij het starten uitgevoerd).
COPY --from=bouw --chown=app:app /app/.next/standalone ./
COPY --from=bouw --chown=app:app /app/.next/static ./.next/static
COPY --from=bouw --chown=app:app /app/content ./content
COPY --from=bouw --chown=app:app /app/src/db/migraties ./src/db/migraties
USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
