#!/bin/sh
# Fix ownership of the uploads volume (may be root-owned from Docker volume init)
chown -R appuser:appuser /app/uploads 2>/dev/null || true

# Run migrations and start the server as appuser
exec su-exec appuser sh -c "npx prisma migrate deploy && node index.js"
