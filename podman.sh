#!/bin/bash
podman build --build-arg TIKA_URL=$TIKA_URL -t mango:1.0 .
podman run -d --name mango -p 8080:80 mango:1.0
