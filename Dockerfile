FROM node:22.20.0

RUN npm i -g typescript

# CMD while : ; do sleep 1000; done
# CMD ["tsc", "--watch"]
CMD npm run serve