#!/bin/sh
set -e

# A previous deploy may have left this migration in a failed state while the
# columns already existed (init migration was later updated to include them).
npx prisma migrate resolve --rolled-back 20260623160000_add_geo_coordinates 2>/dev/null || true

exec npx prisma migrate deploy
