#!/bin/bash
set -e

echo "=== Triển khai NetCLI Enterprise Workbench (Node.js Edition) ==="

# 1. Kiểm tra Node.js
if ! command -v node &> /dev/null; then
    echo "[*] Đang cài đặt Node.js 18 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 2. Cài đặt dependencies
echo "[*] Đang cài đặt thư viện npm..."
npm install --production

# 3. Khởi chạy bằng PM2 (Process Manager tự khởi động cùng OS)
if ! command -v pm2 &> /dev/null; then
    echo "[*] Đang cài đặt PM2..."
    sudo npm install -g pm2
fi

echo "[*] Khởi động ứng dụng với PM2..."
pm2 delete netcli-workbench 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo "========================================================"
echo "[✓] Triển khai thành công NetCLI Workbench (Node.js)!"
echo "[✓] Truy cập ngay tại: http://$(hostname -I | awk '{print $1}'):8888"
echo "========================================================"
