# NetCLI Enterprise Workbench - Node.js Edition

Bộ công cụ cẩm nang và sinh lệnh mạng đa hãng (Cisco, Juniper, Fortinet, Huawei, MikroTik, Aruba, Ruijie, Edgecore) được thiết kế theo kiến trúc Node.js / Express chuyên nghiệp.

## Cấu trúc thư mục:
```text
netcli-workbench/
├── server.js              # Express.js Server chính (chạy cổng 8888)
├── package.json           # Khai báo dependencies
├── ecosystem.config.js    # Cấu hình PM2 Process Manager
├── Dockerfile             # Docker Container
├── docker-compose.yml     # Docker Compose
├── deploy.sh              # Script cài đặt tự động 1 lệnh cho Ubuntu
├── data/                  # Cơ sở dữ liệu JSON tách biệt
│   ├── vendors.json       # Danh sách các hãng thiết bị
│   ├── tasks.json         # Danh sách các bài cấu hình L2, L3, OSPF, BGP, NAT
│   ├── show_commands.json # 35+ lệnh Show/Display đa hãng
│   ├── ports.json         # Danh bạ Port mạng chuẩn
│   └── recovery.json      # Sổ tay Password Recovery console
├── routes/
│   └── api.js             # REST API Router (/api/tasks, /api/vendors...)
└── public/                # Frontend Web
    ├── index.html         # Giao diện chính
    ├── css/style.css      # CSS hiệu ứng chuyển động mượt mà
    └── js/app.js          # Logic xử lý giao diện & kết nối API
```

## Cách chạy trên Ubuntu Server:

### Cách 1: Chạy trực tiếp bằng PM2 (Khuyên dùng)
```bash
npm install
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Cách 2: Chạy bằng Docker
```bash
docker compose up -d --build
```

### Cách 3: Chạy test nhanh
```bash
npm install
npm start
```
Truy cập: `http://<IP_UBUNTU_SERVER>:8888`
