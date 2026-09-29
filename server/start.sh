#!/bin/bash
# Render 启动脚本 - 兼容免费层（无持久盘）与付费层（有持久盘）
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGES_DIR="$SCRIPT_DIR/generated_images"
PRISMA_DIR="$SCRIPT_DIR/prisma"
PERSIST_DIR="/opt/render/project/persist"

# 持久盘可用（付费层）：把图片同步到持久盘并软链；否则直接用 git 内置图片（免费层）
if [ -d "$PERSIST_DIR" ] && [ -w "$PERSIST_DIR" ]; then
  echo "[init] persistent disk detected, syncing images..."
  mkdir -p "$PERSIST_DIR/images"
  if [ -d "$IMAGES_DIR" ]; then
    cp -r "$IMAGES_DIR"/* "$PERSIST_DIR/images/" 2>/dev/null || true
  fi
  rm -rf "$IMAGES_DIR"
  ln -sf "$PERSIST_DIR/images" "$IMAGES_DIR"
else
  echo "[init] no persistent disk, using in-place images (free tier)"
fi

cd "$SCRIPT_DIR"
npx prisma generate
npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push

# 数据库为空时播种（题目 + 81 型内容）
QUESTION_COUNT=0
if command -v sqlite3 >/dev/null 2>&1; then
  QUESTION_COUNT=$(sqlite3 "$PRISMA_DIR/dev.db" "SELECT COUNT(*) FROM Question;" 2>/dev/null || echo "0")
fi
if [ "$QUESTION_COUNT" -lt 90 ]; then
  echo "[seed] populating database..."
  npx tsx src/seed.ts
fi

echo "[start] launching MBTI-PRO API..."
exec npx tsx src/index.ts