#!/bin/bash
podman build --build-arg TIKA_URL=$TIKA_URL -t mango:1.0 .
podman rm -f mango
podman run -d --name mango -p 8080:80 -e API_TOKEN=$(data-platform-cli token) mango:1.0
