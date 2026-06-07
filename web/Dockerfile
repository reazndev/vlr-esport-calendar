FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json angular.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
RUN npm ci
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/vlr-esports-ics-web/browser /usr/share/nginx/html
EXPOSE 80
