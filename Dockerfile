### STAGE 1: Build ###
FROM node:lts-alpine AS build

#### make the 'app' folder the current working directory
WORKDIR /usr/src/app

#### copy both 'package.json' and 'package-lock.json' (if available)
COPY package*.json ./

#### install angular cli
RUN npm install -g @angular/cli

#### install project dependencies
RUN npm install

#### copy things
COPY . .

#### generate build --prod
RUN npm run build --prod

### STAGE 2: Run ###
FROM nginxinc/nginx-unprivileged

#### copy nginx conf
COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf

#### copy artifact build from the 'build environment'
COPY --from=build /usr/src/app/dist/subvision/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
