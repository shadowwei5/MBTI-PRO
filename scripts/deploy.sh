#!/bin/bash
set -e
echo "=== MBTI-PRO 部署脚本 ==="

# 1. Nginx 配置
echo "[1/6] 配置 Nginx..."
mkdir -p /etc/nginx/conf.d
cat > /etc/nginx/conf.d/mbti-pro.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name _;
    root /opt/MBTI-PRO/client/dist;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /generated_images/ {
        proxy_pass http://127.0.0.1:3001;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX_EOF
echo "  Nginx 配置完成"

# 2. 测试 Nginx
echo "[2/6] 测试 Nginx..."
nginx -t

# 3. 启动 Nginx
echo "[3/6] 启动 Nginx..."
systemctl start nginx 2>/dev/null || nginx
systemctl enable nginx 2>/dev/null || true

# 4. 安装后端依赖
echo "[4/6] 安装后端依赖..."
cd /opt/MBTI-PRO/server
npm install --include=dev
npx prisma generate
npx prisma db push

# 5. 种子数据
echo "[5/6] 导入数据..."
npx tsx src/seed.ts 2>/dev/null || echo "  种子数据可能已存在，跳过"

# 6. 启动后端
echo "[6/6] 启动后端..."
pm2 stop mbti-pro-api 2>/dev/null || true
pm2 start src/index.ts --name mbti-pro-api --interpreter tsx
pm2 save
pm2 status

echo "=== 部署完成 ==="
echo "访问: http://$(curl -s ifconfig.me)/"
