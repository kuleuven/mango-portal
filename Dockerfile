FROM python:3.10
WORKDIR /app
COPY requirements-mango-flow.txt requirements.txt
RUN apt-get update && apt-get -y upgrade && \
	apt-get -y install libimage-exiftool-perl nano poppler-utils vim && \
	rm -rf /var/lib/apt/lists/*
RUN pip install -r requirements.txt
RUN echo "Europe/Brussels" > /etc/timezone && rm /etc/localtime && dpkg-reconfigure -f noninteractive tzdata
ARG TIKA_URL=http://localhost:9998/
ENV TIKA_URL=$TIKA_URL
ENV spOption="ManGO_portal"
COPY src  /app/
COPY unstash/src /app/
COPY build-labels.json /app/static/build-info.json
EXPOSE 80
CMD ["python", "waitress_serve.py"]
