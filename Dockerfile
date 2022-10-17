FROM python:3.10
WORKDIR /app
COPY requirements.txt /app/
RUN apt-get update && apt-get -y install poppler-utils
RUN pip install -r requirements.txt
RUN echo "Europe/Brussels" > /etc/timezone && rm /etc/localtime && dpkg-reconfigure -f noninteractive tzdata
RUN pwd
COPY src  /app/
EXPOSE 80
ENTRYPOINT ["/usr/local/bin/python", "waitress_server.py"]
