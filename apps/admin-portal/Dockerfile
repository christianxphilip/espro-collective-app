FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build argument for VITE_API_URL (can be overridden)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the application (Vite will embed VITE_API_URL at build time)
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

