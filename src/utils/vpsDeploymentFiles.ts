export const VPS_DEPLOYMENT_ARTIFACTS = {
  dockerCompose: `version: "3.9"

services:
  app:
    build: .
    container_name: rp_order_app
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATA_DIR=/app/data
      - DATABASE_URL=postgresql://rpuser:\${POSTGRES_PASSWORD:-rp_secure_pass}@postgres:5432/rp_orders
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - rp_app_data:/app/data
      - rp_media_storage:/app/media
    depends_on:
      - postgres
      - redis
    networks:
      - rp_net

  postgres:
    image: pgvector/pgvector:pg16
    container_name: rp_order_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: rpuser
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-rp_secure_pass}
      POSTGRES_DB: rp_orders
    volumes:
      - rp_pg_data:/var/lib/postgresql/data
    networks:
      - rp_net

  redis:
    image: redis:7-alpine
    container_name: rp_order_redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - rp_redis_data:/data
    networks:
      - rp_net

  nginx:
    image: nginx:1.27-alpine
    container_name: rp_order_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./deploy/certs:/etc/letsencrypt:ro
    depends_on:
      - app
    networks:
      - rp_net

volumes:
  rp_app_data:
  rp_media_storage:
  rp_pg_data:
  rp_redis_data:

networks:
  rp_net:
    driver: bridge`,

  postgresSchemaSql: `-- PostgreSQL 16 + pgvector Schema (Section 8 of Project Plan)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE whatsapp_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  business_account_id TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  profile_name TEXT,
  display_name TEXT,
  notes TEXT,
  last_message_at TIMESTAMPTZ
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  number SERIAL UNIQUE,
  account_id TEXT REFERENCES whatsapp_accounts(id),
  customer_id TEXT REFERENCES customers(id),
  source TEXT CHECK (source IN ('whatsapp', 'onsite')),
  is_draft BOOLEAN DEFAULT TRUE,
  linked_order_id TEXT REFERENCES orders(id),
  catalog_book_name TEXT,
  catalog_item_number TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ -- Soft-delete only; history stays intact
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  usage_count INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE category_fields (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  key TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ur TEXT NOT NULL,
  field_type TEXT NOT NULL,
  units JSONB
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- Argon2id / bcrypt
  role TEXT CHECK (role IN ('admin', 'owner', 'staff', 'designer')),
  full_name TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  category_id TEXT REFERENCES categories(id),
  designer_id TEXT REFERENCES users(id),
  status TEXT NOT NULL,
  specs JSONB DEFAULT '{}'::jsonb,
  previous_specs JSONB DEFAULT '{}'::jsonb,
  note TEXT,
  change_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES whatsapp_accounts(id),
  customer_id TEXT REFERENCES customers(id),
  wa_message_id TEXT UNIQUE NOT NULL, -- Prevents duplicate Meta webhooks
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  type TEXT NOT NULL,
  text TEXT,
  media_id TEXT,
  reply_to_wa_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  raw JSONB,
  order_id TEXT REFERENCES orders(id),
  item_id TEXT REFERENCES order_items(id)
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  size BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  kind TEXT CHECK (kind IN ('customer', 'output')),
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE item_media (
  item_id TEXT REFERENCES order_items(id),
  media_id TEXT REFERENCES media(id),
  role TEXT CHECK (role IN ('reference', 'output')),
  PRIMARY KEY (item_id, media_id, role)
);

CREATE TABLE embeddings (
  media_id TEXT PRIMARY KEY REFERENCES media(id),
  vector vector(512) -- CLIP image similarity embedding (Phase 3)
);`,

  backupCronScript: `#!/usr/bin/env bash
# Daily VPS Backup Script (/etc/cron.daily/rp-order-backup)
# Dumps database + syncs media to secondary off-site S3 storage (18 GB/month growth plan)
set -euo pipefail

TIMESTAMP=$(date +"%Y-%m-%d_%H%M")
BACKUP_DIR="/var/backups/rp_orders"
mkdir -p "$BACKUP_DIR"

# 1. Dump PostgreSQL + JSON state
docker exec rp_order_postgres pg_dump -U rpuser -Fc rp_orders > "$BACKUP_DIR/db_$TIMESTAMP.dump"
cp /var/lib/docker/volumes/rp_app_data/_data/rp_state.json "$BACKUP_DIR/state_$TIMESTAMP.json" || true

# 2. Sync to off-site S3 / Backblaze B2 bucket
aws s3 sync "$BACKUP_DIR" s3://rp-design-offsite-backups/db/
aws s3 sync /var/lib/docker/volumes/rp_media_storage/_data s3://rp-design-offsite-backups/media/

# 3. Prune local dumps older than 14 days
find "$BACKUP_DIR" -type f -mtime +14 -delete
echo "Backup completed at $TIMESTAMP"`,
};
