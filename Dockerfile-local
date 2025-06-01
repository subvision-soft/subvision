FROM node:alpine

WORKDIR /subvision

COPY ./package.json /subvision/package.json

RUN npm install -g @angular/cli

RUN npm install

COPY . /subvision

EXPOSE 4200

CMD ["ng", "serve", "--host", "0.0.0.0","--poll", "500"]
