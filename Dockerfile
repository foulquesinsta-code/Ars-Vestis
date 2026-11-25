FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/health.cjs ./server/health.cjs
EXPOSE 3000
CMD ["node", "server/health.cjs"]
