# BẢNG ĐỊNH DANH THÀNH PHẦN DỰ ÁN (COMPONENT REGISTRY)
> **Mục đích:** Chuẩn hóa mã định danh (Component ID) cho từng phân hệ, module và file dữ liệu.  
> Khi cần nâng cấp hoặc sửa lỗi, bạn chỉ cần nêu mã định danh (ví dụ: `MOD-06` hoặc `DB-SHOW`) để AI chỉ tác động chính xác vào thành phần đó mà không bao giờ làm ảnh hưởng đến toàn cục.

---

## 1. PHÂN HỆ GIAO DIỆN & TÍNH NĂNG (FRONTEND VIEWS)

| Mã Định Danh | Tên Phân Hệ | File Giao Diện / Logic | Chức Năng Chính |
| :--- | :--- | :--- | :--- |
| **`VIEW-01`** (`view-generator`) | **Cẩm Nang Cấu Hình** | `public/index.html` + `public/js/app.js` | Tra cứu cú pháp song song 8 hãng, lọc danh mục, bộ thông số động. |
| **`VIEW-02`** (`view-builder`) | **Sinh Lệnh Nhanh & Giả Lập** | `public/index.html` + `public/js/app.js` | Checklist chọn tính năng, render kịch bản `.cfg`, Console Sandbox chạy thử. |
| **`VIEW-03`** (`view-showcmds`) | **Bách Khoa Lệnh Show** | `public/index.html` + `public/js/app.js` | 37+ lệnh show/display đa hãng, mẹo phân tích output thực tế. |
| **`VIEW-04`** (`view-diagnose`) | **Chẩn Đoán Sự Cố (Bác Sĩ Mạng)** | `public/index.html` + `public/js/app.js` | Rà soát output log, bắt bệnh CRC/Loop/OSPF/BGP, kê đơn thuốc lệnh sửa. |
| **`VIEW-05`** (`view-mikrotik`) | **MikroTik RouterOS Chuyên Sâu** | `public/index.html` + `public/js/app.js` | BGP v7, Recursive Failover, PCC Load Balancing, MPLS/VPLS, Mangle HTB. |
| **`VIEW-06`** (`view-subnet`) | **Máy Tính Subnet / Wildcard** | `public/index.html` + `public/js/app.js` | Tính Network ID, Broadcast, Wildcard mask, dải IP khả dụng. |
| **`VIEW-07`** (`view-console`) | **Thông Số Cáp & Console** | `public/index.html` + `public/js/app.js` | Bảng Baudrate 9600/115200, chân cáp, user mặc định 8 hãng. |
| **`VIEW-08`** (`view-fiber`) | **Cáp Quang & SFP Unlock** | `public/index.html` + `public/js/app.js` | Chuẩn SMF/MMF, ngưỡng dBm an toàn, lệnh mở khóa SFP bên thứ 3. |
| **`VIEW-09`** (`view-ports`) | **Danh Bạ Port Mạng** | `public/index.html` + `public/js/app.js` | Tra cứu nhanh 25+ số cổng TCP/UDP tiêu chuẩn. |
| **`VIEW-10`** (`view-recovery`) | **Password Recovery Playbook** | `public/index.html` + `public/js/app.js` | Sổ tay cứu hộ mật khẩu console từng bước khi bị khóa pass. |
| **`VIEW-11`** (`view-admin`) | **Trang Quản Trị Hệ Thống** | `public/index.html` + `public/js/app.js` | Dashboard RAM/CPU, CRUD thêm hãng, thêm bài cấu hình, Golden Backup. |
| **`NAV-BAR`** | **Thanh Điều Hướng Header** | `public/index.html` | Logo, thanh menu chính, dropdown "Sổ Tay Kỹ Sư", mobile touch strip. |

---

## 2. KHO DỮ LIỆU ĐỘC LẬP (DATABASE JSON - Thư mục `/data/`)

> Khi chỉ muốn bổ sung thêm lệnh, thêm bài cấu hình hoặc chỉnh sửa cú pháp, **CHỈ CẦN SỬA FILE JSON TƯƠNG ỨNG**, không cần đụng đến code web hay server!

| Mã Dữ Liệu | File Tương Ứng | Nội Dung Lưu Trữ |
| :--- | :--- | :--- |
| **`DB-TASKS`** | `data/tasks.json` | 31+ bài cấu hình đa hãng (L2, L3, OSPF, BGP, NAT, DHCP, Voice VLAN, Snooping, SNMPv3...). |
| **`DB-SHOW`** | `data/show_commands.json` | 37+ lệnh show/display, mẹo phân tích output (Cisco, CBS, Junos, FortiOS, Huawei, Aruba, Ruijie, Edgecore). |
| **`DB-MIKROTIK`**| `data/mikrotik_mtcine.json`| Toàn bộ kịch bản chuyên sâu RouterOS (Recursive failover, PCC, BGP v7, MPLS, HTB QoS) và sổ tay bắt bệnh. |
| **`DB-VENDORS`** | `data/vendors.json` | Danh sách các hãng hỗ trợ, tên hiển thị và màu sắc badge. |
| **`DB-CONSOLE`** | `data/console_serial.json` | Bảng thông số Baudrate, loại cáp console, user mặc định của các hãng. |
| **`DB-FIBER`** | `data/fiber_optics.json` | Bảng thông số cáp quang, ngưỡng công suất thu dBm và lệnh mở khóa module quang OEM. |
| **`DB-PORTS`** | `data/ports.json` | Danh bạ các port mạng và giao thức tiêu chuẩn. |
| **`DB-RECOVERY`** | `data/recovery.json` | Hướng dẫn bẻ khóa/khôi phục mật khẩu console từng hãng. |

---

## 3. MÁY CHỦ & BACKEND API (SERVER CORE)

| Mã Backend | File / Thư Mục | Chức Năng |
| :--- | :--- | :--- |
| **`SRV-CORE`** | `server.js` | Express.js Web Server chính, lắng nghe cổng 8888, phục vụ static assets và API. |
| **`SRV-API`** | `routes/api.js` | REST API Router xử lý các endpoint `/api/tasks`, `/api/diagnose/analyze`, `/api/admin/*`... |
| **`SRV-PM2`** | `ecosystem.config.js` | Cấu hình PM2 Process Manager chạy nền tự khởi động cùng Ubuntu Server. |
| **`SRV-DOCKER`** | `Dockerfile` & `docker-compose.yml` | Đóng gói container Node.js độc lập. |
| **`SRV-DEPLOY`** | `deploy.sh` | Script tự động triển khai 1 lệnh trên Ubuntu Server. |

---

## 4. HƯỚNG DẪN CÁCH YÊU CẦU NÂNG CẤP SIÊU NHANH & AN TOÀN

Khi bạn muốn nâng cấp hoặc tinh chỉnh trong tương lai, bạn chỉ cần dùng cú pháp:

* **Ví dụ 1 (Thêm lệnh show):**  
  > *"Hãy update `DB-SHOW`: Thêm lệnh kiểm tra trạng thái quạt `show environment fan` cho các hãng."*  
  *(AI sẽ chỉ sửa đúng file `data/show_commands.json`, giao diện và server giữ nguyên 100%).*

* **Ví dụ 2 (Thêm kịch bản MikroTik):**  
  > *"Hãy bổ sung vào `DB-MIKROTIK`: Thêm kịch bản cấu hình VRF tách mạng khách."*  
  *(Chỉ sửa đúng file `data/mikrotik_mtcine.json`).*

* **Ví dụ 3 (Sửa giao diện hoặc nút bấm):**  
  > *"Hãy tinh chỉnh `VIEW-02` (Sinh Lệnh Nhanh): Thêm nút sao chép nhanh từng phần."*  
  *(Chỉ tác động đúng khối View 02, không làm ảnh hưởng các phân hệ khác).*
