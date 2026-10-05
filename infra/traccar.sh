#!/bin/bash
# Run the local Traccar telematics platform without docker compose.
#   ./infra/traccar.sh up | down | logs
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
NAME=fleetfusion-traccar
case "${1:-up}" in
  up)
    if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
      docker start "$NAME" >/dev/null
    else
      docker run -d --name "$NAME" --restart unless-stopped \
        -p 8082:8082 -p 5055:5055 \
        -v "$DIR/traccar/traccar.xml:/opt/traccar/conf/traccar.xml:ro" \
        -v fleetfusion-traccar-data:/opt/traccar/data \
        -v fleetfusion-traccar-logs:/opt/traccar/logs \
        --add-host host.docker.internal:host-gateway \
        traccar/traccar:6.16.0 >/dev/null
    fi
    echo "Traccar running: web http://localhost:8082, device reports http://localhost:5055"
    ;;
  down) docker stop "$NAME" >/dev/null && echo "Traccar stopped" ;;
  logs) docker logs -f "$NAME" ;;
  *) echo "usage: $0 up|down|logs"; exit 1 ;;
esac
