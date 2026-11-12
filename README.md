<div align="center">

# ⚡ TraceDeck

**Multi-Vendor Network CLI, Diagnostics & Operations Workbench**

[![Version](https://img.shields.io/badge/version-2.6.0-ff6363?style=for-the-badge)](package.json)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-10b981?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Author](https://img.shields.io/badge/Author-KhangIT-a855f7?style=for-the-badge)](https://www.tiktok.com/@khangdd72)

*Gọn nhẹ (~40MB RAM) • Giao diện Raycast & Dynamic Island • Chuẩn hóa CLI từ tài liệu chính thức của 10 hãng thiết bị mạng*

</div>

---

## 🌐 10 Hãng Thiết Bị Được Hỗ Trợ Chuẩn Hóa

| Hãng / Hệ điều hành | Phạm vi câu lệnh đã kiểm định |
| :--- | :--- |
| **Cisco Catalyst (IOS / IOS-XE)** | L2/L3, OSPF, BGP, NAT, ACL, IPsec, Troubleshoot & ROMMON Recovery |
| **Cisco Business (CBS 250 / 350 / 550)** | `vlan database`, `show interfaces switchport`, `show ports security`, `terminal datadump` |
| **Juniper Networks (Junos OS)** | `set` / `commit confirmed`, `show route`, `loader> boot -s` |
| **Fortinet (FortiGate FortiOS)** | Policy, NAT, IPsec, `execute log display`, `maintainer` Recovery |
| **Huawei (VRP OS)** | `system-view`, `display` commands, BootROM Password Clear |
| **MikroTik (RouterOS v6 & v7)** | Bộ công cụ chuyên sâu: Multi-WAN PPPoE, Recursive Failover, PCC, BGP v7, WireGuard, QoS |
| **HPE Aruba (AOS-CX)** | `no page`, `show lldp neighbor-info`, `show logging -r` |
| **Ruijie Networks (RGOS)** | `terminal length 0`, `show cpu`, `show memory`, U-Boot Recovery |
| **DrayTek (VigorOS)** | `sys version`, `sys health`, `ip route add`, `srv dhcp`, `srv nat`, `wan detect_mtu` |
| **Edgecore Networks (ECS)** | `show process cpu`, `show poe powersupply`, `show port security`, `show sntp` |

---

## ✨ Tính Năng Nổi Bật

* **🎨 Giao diện Raycast & Dynamic Island:** Thanh điều hướng viên thuốc nổi co giãn mượt mà, hỗ trợ **Dark / Light Mode (`☀️ / 🌙`)** và bảng gọi lệnh nhanh **`⌘K` / `Ctrl + K`**.
* **📘 Cẩm Nang Cấu Hình & Sinh Lệnh Động:** Thay đổi VLAN, IP, Port một lần, tự động áp dụng vào toàn bộ 31+ bài cấu hình của 10 hãng.
* **⚡ Quick CLI Builder & Console Sandbox:** Tick chọn tính năng để ghép kịch bản hoàn chỉnh và chạy thử nghiệm mô phỏng trực tiếp.
* **🩺 AI Diagnostic Doctor & Optimizer:** Dán log hoặc quét trực tiếp qua **SSH / Telnet** để chấm điểm sức khỏe thiết bị, phát hiện lỗi CRC/Loop/Bảo mật và xuất kịch bản vá lỗi tự động.
* **🔑 Password Recovery Cầm Tay Chỉ Việc:** Hướng dẫn từng bước chi tiết (Baudrate, cáp Console, phím tắt Bootloader) phù hợp cho cả người mới nhận bàn giao hệ thống.
* **🔄 Auto Check for Update:** Tự động kiểm tra phiên bản mới từ GitHub thông qua API `/api/system/check-update`.

---

## 🚀 Cài Đặt & Triển Khai Nhanh (Ubuntu Server)

```bash
# 1. Clone dự án về máy chủ
git clone <URL_REPO_CUA_BAN> /var/www/netcli
cd /var/www/netcli

# 2. Cài đặt thư viện
npm install --omit=dev

# 3. Khởi chạy bằng PM2 (chạy ngầm tự khởi động lại)
pm2 start ecosystem.config.js
pm2 save
```

Mặc định ứng dụng chạy tại cổng **`8888`** (`http://<IP-Server>:8888`).

### Cập nhật phiên bản mới sau này:
```bash
cd /var/www/netcli && git pull && npm install --omit=dev && pm2 restart netcli
```

---

## 👤 Tác Giả & Bản Quyền

* **Tác giả:** **KhangIT**
* **Email:** [duonganhkhang95@gmail.com](mailto:duonganhkhang95@gmail.com)
* **TikTok:** [@khangdd72](https://www.tiktok.com/@khangdd72)
* **Giấy phép:** [MIT License](LICENSE) &copy; 2026 KhangIT
