#!/bin/bash
podman build -t mango:1.0 Docker/Dockerfile
podman run --rm -it --name mango-slim -p 8887:80 mango:1.0
