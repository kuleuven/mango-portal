FROM python:3.10
WORKDIR /app
COPY requirements.txt /app/
RUN apt install poppler-utils
RUN pip install -r requirements.txt
RUN echo "Europe/Brussels" > /etc/timezone && rm /etc/localtime && dpkg-reconfigure -f noninteractive tzdata
RUN pwd
COPY src  /app/
EXPOSE 80
ENTRYPOINT ["waitress-serve","--host=*","--port=80","--threads=8", "app:app"]
