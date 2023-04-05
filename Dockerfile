FROM python:3.10
WORKDIR /app
COPY requirements.txt /app/
RUN apt-get update && apt-get -y upgrade && apt-get -y install poppler-utils nano vim
RUN pip install -r requirements.txt
RUN echo "Europe/Brussels" > /etc/timezone && rm /etc/localtime && dpkg-reconfigure -f noninteractive tzdata
ARG TIKA_URL=http://localhost:9998/
ENV TIKA_URL=$TIKA_URL
ENV spOption="ManGO_portal"
COPY src  /app/
EXPOSE 80
ENTRYPOINT ["/usr/local/bin/python", "waitress_serve.py"]
