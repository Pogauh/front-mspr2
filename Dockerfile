# Stage 1 - Build
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Les variables VITE_* sont figées au build : il faut les passer ici, pas à l'exécution
ARG VITE_MOCK=false
ARG VITE_API_BASE_URL=/api-siege
ENV VITE_MOCK=$VITE_MOCK
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build-only

# Stage 2 - Serve (nginx)
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
