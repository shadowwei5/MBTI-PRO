#!/bin/bash
# Render 启动脚本 — 处理持久化磁盘 + 数据库初始化
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PERSIST_DIR="/opt/render/project/persist"
IMAGES_DIR="$SCRIPT_DIR/generated_images"
PRISMA_DIR="$SCRIPT_DIR/prisma"

# 初始化持久化目录
mkdir -p "$PERSIST_DIR/images"

# 每次启动都同步新图片到持久化磁盘（覆盖同名，保留旧图）
if [ -d "$IMAGES_DIR" ]; then
    echo "[init] syncing images to persistent disk..."
    cp -r "$IMAGES_DIR"/* "$PERSIST_DIR/images/" 2>/dev/null || true
fi

# 链接持久化目录
rm -rf "$IMAGES_DIR"
ln -sf "$PERSIST_DIR/images" "$IMAGES_DIR"

# 数据库初始化
cd "$SCRIPT_DIR"
npx prisma generate
npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push

# 检查是否需要 seed
TABLE_COUNT=$(sqlite3 "$PRISMA_DIR/dev.db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
QUESTION_COUNT=$(sqlite3 "$PRISMA_DIR/dev.db" "SELECT COUNT(*) FROM Question;" 2>/dev/null || echo "0")

if [ "$QUESTION_COUNT" -lt 90 ]; then
    echo "[seed] populating database..."
    npx tsx src/seed.ts
fi

echo "[start] launching MBTI-PRO API..."
exec npx tsx src/index.ts
