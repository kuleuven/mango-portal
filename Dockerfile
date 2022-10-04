FROM python:3.10
ARG SERVICE_PORT=80
ARG PROJECT=mango
ARG SERVICE_NAMEicts-t-rdm-mango
ARG SERVICE_TAG=rdm-mango
EXPOSE $SERVICE_PORT
#RUN apt-get update && apt-get -y install nodejs npm
WORKDIR /app

COPY requirements.txt /app/
#RUN apt install gcc
RUN pip install -r requirements.txt
#RUN npm install && npm update && npm run build
RUN echo "Europe/Brussels" > /etc/timezone && rm /etc/localtime && dpkg-reconfigure -f noninteractive tzdata
ENV SERVICE_NAME="$SERVICE_NAME" \
    SERVICE_80_TAGS=$SERVICE_TAG \
    SERVICE_80_IPV6="tcp" \
    SERVICE_80_FIREWALL="g/nx" \
    PYTHONPATH=/app
RUN pwd
COPY src  /app/
CMD ["waitress-serve", "app:app"]
