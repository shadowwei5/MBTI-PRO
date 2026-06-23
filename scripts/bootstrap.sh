#!/bin/bash
# ============================================================
# MBTI-PRO 腾讯云一键部署脚本
#
# 用法（在腾讯云服务器上粘贴运行）：
#   curl -fsSL https://raw.githubusercontent.com/shadowwei5/MBTI-PRO/master/scripts/bootstrap.sh | bash
#
# 或者手动克隆后运行：
#   git clone https://github.com/shadowwei5/MBTI-PRO.git /opt/MBTI-PRO
#   bash /opt/MBTI-PRO/scripts/bootstrap.sh
# ============================================================
set -e

# ---- 颜色输出 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---- 检测架构 ----
IS_CHINA=false
if curl -s --connect-timeout 2 https://www.baidu.com >/dev/null 2>&1; then
    IS_CHINA=true
fi

# ---- 检测是否为 root ----
if [ "$(id -u)" != "0" ]; then
    error "请用 root 用户运行: sudo bash bootstrap.sh"
    exit 1
fi

REPO_URL="https://github.com/shadowwei5/MBTI-PRO.git"
APP_DIR="/opt/MBTI-PRO"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     MBTI-PRO 腾讯云一键部署脚本          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ============================================================
# Step 1: 安装系统依赖
# ============================================================
info "[1/7] 安装系统依赖..."

if command -v apt-get >/dev/null 2>&1; then
    # Debian/Ubuntu
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl git nginx certbot python3-certbot-nginx 2>&1 | tail -1
elif command -v yum >/dev/null 2>&1; then
    # CentOS/RHEL
    yum install -y -q epel-release 2>/dev/null || true
    yum install -y -q curl git nginx certbot python3-certbot-nginx 2>&1 | tail -1
else
    error "不支持的系统，请手动安装: curl git nginx"
    exit 1
fi

# ============================================================
# Step 2: 安装 Node.js 20
# ============================================================
info "[2/7] 安装 Node.js 20..."

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 20 ]; then
    # 动态获取最新 v20 LTS 版本号
    if [ "$IS_CHINA" = true ]; then
        NODE_MIRROR="https://mirrors.tuna.tsinghua.edu.cn/nodejs-release"
    else
        NODE_MIRROR="https://nodejs.org/dist"
    fi

    NODE_VERSION=$(curl -fsSL "$NODE_MIRROR/latest-v20.x/SHASUMS256.txt" 2>/dev/null | head -1 | grep -oP 'v20\.\d+\.\d+' | head -1)

    if [ -z "$NODE_VERSION" ]; then
        # 降级：直接用已知稳定版本
        NODE_VERSION="v20.19.2"
    fi

    info "  安装 Node.js ${NODE_VERSION}..."

    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then NODE_ARCH="x64"; else NODE_ARCH="arm64"; fi

    NODE_URL="$NODE_MIRROR/$NODE_VERSION/node-$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
    curl -fsSL "$NODE_URL" -o /tmp/node.tar.xz
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
    rm /tmp/node.tar.xz

    # 确保当前 shell 能找到 node（OpenCloudOS/CentOS 非登录 shell 可能缺少 /usr/local/bin）
    export PATH="/usr/local/bin:$PATH"
    # 创建全局软链接（万无一失）
    ln -sf /usr/local/bin/node /usr/bin/node
    ln -sf /usr/local/bin/npm /usr/bin/npm
    ln -sf /usr/local/bin/npx /usr/bin/npx
    hash -r 2>/dev/null || true
fi

info "  Node.js $(node -v) ✓"
info "  npm $(npm -v) ✓"

# ============================================================
# Step 3: 配置 npm 镜像（国内加速）
# ============================================================
if [ "$IS_CHINA" = true ]; then
    info "[3/7] 配置 npm 国内镜像..."
    npm config set registry https://registry.npmmirror.com
else
    info "[3/7] npm 使用默认 registry"
fi

# ============================================================
# Step 4: 克隆/更新代码
# ============================================================
info "[4/7] 部署代码..."

if [ -d "$APP_DIR/.git" ]; then
    info "  检测到已有仓库，执行 git pull..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/master
else
    info "  克隆仓库..."
    mkdir -p "$(dirname "$APP_DIR")"
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# ============================================================
# Step 5: 安装后端依赖 & 初始化数据库
# ============================================================
info "[5/7] 安装后端依赖 & 初始化数据库..."

cd "$APP_DIR/server"
npm install --include=dev
npx prisma generate
npx prisma db push

# 种子数据（如果数据库为空）
QUESTION_COUNT=$(sqlite3 "$APP_DIR/server/prisma/dev.db" "SELECT COUNT(*) FROM Question;" 2>/dev/null || echo "0")
if [ "$QUESTION_COUNT" -lt 90 ]; then
    info "  导入种子数据..."
    npx tsx src/seed.ts
else
    info "  数据库已有 $QUESTION_COUNT 题，跳过种子导入"
fi

# ============================================================
# Step 6: 构建前端
# ============================================================
info "[6/7] 构建前端..."

cd "$APP_DIR/client"
npm install
npm run build

# ============================================================
# Step 7: 配置 Nginx & 启动服务
# ============================================================
info "[7/7] 配置 Nginx & 启动服务..."

# -- Nginx 配置 --
cat > /etc/nginx/conf.d/mbti-pro.conf << 'NGINX_EOF'
# MBTI-PRO 站点配置
server {
    listen 80;
    server_name _;

    # 前端静态文件
    root /opt/MBTI-PRO/client/dist;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/css application/javascript image/svg+xml application/json;
    gzip_min_length 512;
    gzip_comp_level 6;

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 图片代理
    location /generated_images/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_cache_valid 200 1d;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX_EOF

# -- 测试 Nginx 配置 --
if nginx -t 2>&1; then
    info "  Nginx 配置测试通过"
else
    error "Nginx 配置测试失败，请检查"
    exit 1
fi

# -- 启动/重启 Nginx --
if systemctl is-active nginx >/dev/null 2>&1; then
    systemctl reload nginx
else
    systemctl start nginx
fi
systemctl enable nginx >/dev/null 2>&1 || true

# -- PM2 管理后端 --
if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
fi

pm2 stop mbti-pro-api 2>/dev/null || true
pm2 start "$APP_DIR/server/src/index.ts" \
    --name mbti-pro-api \
    --interpreter tsx \
    --cwd "$APP_DIR/server"
pm2 save

# 设置 PM2 开机自启
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ============================================================
# 完成
# ============================================================
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ip.sb 2>/dev/null || echo "YOUR_IP")

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         ✅  部署完成！                    ║"
echo "╠══════════════════════════════════════════╣"
echo "║  访问地址: http://${SERVER_IP}/           "
echo "║  API 地址: http://${SERVER_IP}/api/health "
echo "║                                          ║"
echo "║  管理命令:                                ║"
echo "║    pm2 status          # 查看服务状态     ║"
echo "║    pm2 logs mbti-pro-api  # 查看日志     ║"
echo "║    pm2 restart mbti-pro-api # 重启服务   ║"
echo "║                                          ║"
echo "║  更新代码:                                ║"
echo "║    cd /opt/MBTI-PRO && git pull           ║"
echo "║    cd server && npx prisma db push        ║"
echo "║    cd ../client && npm run build          ║"
echo "║    pm2 restart mbti-pro-api              ║"
echo "║    systemctl reload nginx                ║"
echo "╚══════════════════════════════════════════╝"
echo ""

info "下一步: 配置 SSL 证书（HTTPS）"
echo "  certbot --nginx -d your-domain.com"
echo ""
info "部署脚本执行完毕"
