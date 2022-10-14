#!/bin/bash
podman build -t mango:1.0 .
podman run --rm -it --name mango -p 8080:8080 mango:1.0
