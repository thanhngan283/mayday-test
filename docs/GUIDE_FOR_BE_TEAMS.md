# Hướng Dẫn Chạy Bộ Kiểm Thử Tự Động Hóa API Thực Tế (Dành Cho Các Nhóm Backend)

Tài liệu này hướng dẫn từng bước để **mỗi nhóm Backend tự cấu hình và chạy bộ Automation Test** trực tiếp vào Server & Database của nhóm mình trên **Windows Command Prompt (`cmd`)**.

> **Nguyên tắc:** Bộ test gọi **API thật (Zero Mocking)** tới server của nhóm và tự dọn dữ liệu test sau khi chạy (`afterEach` / `afterAll`). Các nhóm **không cần sửa mã nguồn test**, chỉ cần cấu hình đúng file `.env` và chạy lệnh theo hướng dẫn dưới đây.

---

## 0. Yêu Cầu Trước Khi Bắt Đầu

1. Máy đã cài **Node.js `>= 18.x`** và **`npm`**:
   ```cmd
   node -v
   npm -v
   ```
2. **Server Backend và Database của nhóm phải đang chạy** (chạy Local bằng Node/Nest/Spring hoặc chạy qua Docker Compose) và đã nạp dữ liệu tài khoản mẫu (seed).

---

## Bước 1: Mở Terminal Tại Thư Mục Bộ Test & Cài Thư Viện

Mở **Command Prompt (`cmd`)**, đi tới thư mục chứa bộ Automation Test (thay `<DUONG_DAN_BO_TEST>` bằng đường dẫn thật trên máy bạn, ví dụ `D:\doAnWork`) và cài đặt thư viện:

```cmd
cd /d <DUONG_DAN_BO_TEST>
npm install
```

*(Lưu ý: Khuyên dùng **Command Prompt (`cmd`)**. Nếu bạn dùng Windows PowerShell và gặp lỗi chặn `npm.ps1`, hãy chạy `npm.cmd install` thay cho `npm install`.)*

---

## Bước 2: Cấu Hình File `.env` Khớp Với Project Backend Của Nhóm

### 2.1. Tạo file `.env` từ mẫu
```cmd
copy .env.example .env
```

### 2.2. Chỉnh sửa `.env` theo thông số Server & DB của nhóm
> **⛔ LƯU Ý QUAN TRỌNG:** **KHÔNG copy đè file `.env` của Backend** (chứa `DB_PASSWORD`, `JWT_SECRET`, `DATABASE_URL`...) vào thư mục bộ test. Bộ test chỉ cần **địa chỉ URL/Port của API** và **4 tài khoản đăng nhập có sẵn trong DB** của nhóm.

Mở file `.env` (`notepad .env`) và điền đúng thông tin của nhóm theo mẫu sau:

```ini
# ============================================================================
# 1. ĐỊA CHỈ BACKEND CỦA NHÓM (Thay <PORT> bằng port thật: 3000, 5000, 8080...)
# ============================================================================
DEFAULT_API_BASE_URL=http://localhost:<PORT>

# Nếu nhóm chạy 1 server duy nhất (Monolith): giữ tất cả giống DEFAULT_API_BASE_URL.
# Nếu nhóm tách nhiều port theo từng service (Microservices): điền đúng port từng dòng.
AUTH_BASE_URL=http://localhost:<PORT>
USER_ROLE_BASE_URL=http://localhost:<PORT>
ORG_PERMISSION_BASE_URL=http://localhost:<PORT>
TEMPLATE_BASE_URL=http://localhost:<PORT>
MEDREC_BASE_URL=http://localhost:<PORT>
LESION_BASE_URL=http://localhost:<PORT>
IMAGE_UAS7_BASE_URL=http://localhost:<PORT>
PRESCRIPTION_LAB_NOTI_BASE_URL=http://localhost:<PORT>
AI_SERVICE_BASE_URL=http://localhost:<PORT>

# ============================================================================
# 2. TÀI KHOẢN SEED CÓ SẴN TRONG DATABASE CỦA NHÓM (Dùng để Login lấy Token)
# ============================================================================
# Tài khoản Quản trị viên (Admin)
ADMIN_PHONE=<SDT_ADMIN_TRONG_DB>
ADMIN_PASSWORD=<MAT_KHAU_ADMIN>

# Tài khoản Bác sĩ thứ 1
DOCTOR_PHONE=<SDT_BAC_SI_1_TRONG_DB>
DOCTOR_PASSWORD=<MAT_KHAU_BAC_SI_1>

# Tài khoản Bác sĩ thứ 2 (dùng để test 2 bác sĩ tiếp nhận trùng 1 bệnh án)
# LƯU Ý: Phải là tài khoản có vai trò Bác sĩ, KHÔNG điền Điều dưỡng hay Bệnh nhân!
SECOND_DOCTOR_PHONE=<SDT_BAC_SI_2_TRONG_DB>
SECOND_DOCTOR_PASSWORD=<MAT_KHAU_BAC_SI_2>

# Tài khoản Bệnh nhân
PATIENT_PHONE=<SDT_BENH_NHAN_TRONG_DB>
PATIENT_PASSWORD=<MAT_KHAU_BENH_NHAN>

# ============================================================================
# 3. CẤU HÌNH LOG & TIMEOUT (GIỮ NGUYÊN)
# ============================================================================
API_TIMEOUT_MS=15000
ENABLE_HTTP_TRACE=true
```

---

## Bước 3: Kiểm Tra Kết Nối Server Backend Trước Khi Chạy Test

Chạy 2 lệnh sau trên `cmd` (thay `<PORT>` bằng port thật của nhóm):

```cmd
curl.exe -i -m 5 http://localhost:<PORT>/
curl.exe -i -m 5 -X POST http://localhost:<PORT>/api/auth/login -H "Content-Type: application/json" -d "{}"
```

* Nếu báo **`Failed to connect` / `Connection refused`**: Server Backend chưa chạy hoặc sai `<PORT>` trong `.env`. Hãy bật Backend trước rồi kiểm tra lại.
* Nếu có phản hồi HTTP (200 / 400 / 401 / 404 kèm JSON): Kết nối đã thông, chuyển sang Bước 4.

---

## Bước 4: Chạy Bộ Kiểm Thử & Xuất Báo Cáo

Luôn chạy từ thư mục bộ test trên `cmd` (`cd /d <DUONG_DAN_BO_TEST>`).

### 4.1. Luôn chạy thử riêng Tuần 1 (Auth) trước
Để đảm bảo các API đăng nhập/đăng ký (`login`, `signup`, `logout`) và tài khoản `.env` hoạt động chuẩn trước khi test các tuần sau:

```cmd
npx jest tests/week1_auth --runInBand --verbose --no-cache --bail=false --json --outputFile=reports\week1_auth.json > reports\week1_auth.log 2>&1
start reports\test-report.html
```

### 4.2. Chạy riêng từng tuần mà nhóm muốn kiểm tra
Thay `<THU_MUC_TUAN>` và `<TEN_FILE>` theo bảng danh sách bên dưới:

```cmd
npx jest tests/<THU_MUC_TUAN> --runInBand --verbose --no-cache --bail=false --json --outputFile=reports\<TEN_FILE>.json > reports\<TEN_FILE>.log 2>&1
start reports\test-report.html
```

**Bảng ánh xạ 10 Tuần + Kịch bản Nâng cao:**

| Tuần | Thư mục (`<THU_MUC_TUAN>`) | Nội dung kiểm thử |
| :---: | :--- | :--- |
| **Tuần 1** | `week1_auth` | Xác thực & Tài khoản (`signup`, `login`, `logout`, `forgot_password`, `reset_password`, `create_staff`) |
| **Tuần 2** | `week2_users_roles` | Hồ sơ cá nhân (`profile`), Quản lý người dùng (`admin/users`) & Vai trò (`roles`) |
| **Tuần 3** | `week3_permissions_branches` | Phân quyền (`permissions`, `role_permissions`) & Chi nhánh (`branches`) |
| **Tuần 4** | `week4_departments_rooms_templates` | Khoa/Ban (`departments`), Phòng khám (`rooms`) & Biểu mẫu bệnh án (`templates`) |
| **Tuần 5** | `week5_template_details` | Chi tiết biểu mẫu (`sections` & `questions` có điều kiện ẩn/hiện) |
| **Tuần 6** | `week6_medrec_create_read` | Bệnh án: Bộ câu hỏi phân luồng, phân loại, tự tạo bệnh án, danh sách, chi tiết, tóm tắt & tiếp nhận |
| **Tuần 7** | `week7_medrec_process_manage` | Bệnh án: Câu trả lời (`answers`), cập nhật kết luận, đổi trạng thái, lịch sử & xóa |
| **Tuần 8** | `week8_lesion_episodes_locations` | Đợt tổn thương (`lesion-episodes`) & Vị trí tổn thương trên bản đồ cơ thể (`lesion-locations`) |
| **Tuần 9** | `week9_images_uas7` | Ảnh tổn thương (`lesion-photos`, `image-attachments`, `answer-images`) & Chấm điểm `UAS7` |
| **Tuần 10** | `week10_prescriptions_lab_notifications` | Đơn thuốc (`prescriptions`), Xét nghiệm (`lab-requests`, `lab-results`) & Thông báo (`notifications`, FCM) |
| **Nâng cao** | `advanced_scenarios` | Concurrency / Race Condition (`Promise.all`), Vòng đời Token Blacklist & Trường tự động tính (`nlr`, `plr`, `uas7_tong`, `aas7_tong`) |

### 4.3. Chạy gộp toàn bộ 10 Tuần (Tuần 1 $\rightarrow$ Tuần 10) vào 1 báo cáo HTML duy nhất
```cmd
npx jest tests/week --runInBand --verbose --no-cache --bail=false --json --outputFile=reports\weeks1_to_10.json > reports\weeks1_to_10.log 2>&1
start reports\test-report.html
```

### 4.4. Chạy toàn bộ dự án (Cả 10 Tuần + Kịch bản Nâng cao)
```cmd
npx jest --runInBand --verbose --no-cache --bail=false --json --outputFile=reports\all_tests.json > reports\all_tests.log 2>&1
start reports\test-report.html
```

---

## Bước 5: Hướng Dẫn Đọc Báo Cáo & Tự Debug Lỗi Backend

### 5.1. Lưu ý quan trọng khi mở file báo cáo HTML
* Thư viện `jest-html-reporters` luôn ghi dữ liệu hiển thị vào thư mục dùng chung `reports\jest-html-reporters-attach\test-report\index.js`.
* Do đó, **luôn mở trực tiếp `reports\test-report.html`** ngay sau khi chạy lệnh Jest. Nếu muốn xem kết quả của **nhiều tuần cùng lúc trên 1 trang HTML**, hãy chạy lệnh **Mục 4.3** hoặc **Mục 4.4**.
* Các file `reports\*.log` và `reports\*.json` là file kết quả độc lập cho từng lần chạy — bạn có thể lưu hoặc gửi các file này khi cần báo cáo/đối soát lỗi.

### 5.2. Cách xem chính xác API nào lỗi và Backend đã trả về gì
Mỗi lần chạy đều bật `ENABLE_HTTP_TRACE=true`. Khi một test bị **FAIL**, mở mục **Console Log** trong `reports\test-report.html` (hoặc mở file `reports\*.log`) và tìm dòng `[API TRACE]` ngay phía trên test đó:
```json
[API TRACE] {
  "service": "MEDREC",
  "request": "POST http://localhost:8080/api/medical_records",
  "requestPayload": { "...": "..." },
  "httpStatus": 400,
  "responseBody": { "code": "1002", "message": "Missing required parameter" }
}
```
Từ đây nhóm BE xác định ngay được nguyên nhân:
1. **HTTP 404 (`"9992"`)**: Chưa có route / sai đường dẫn URL hoặc thiếu prefix API.
2. **HTTP 400 (`"1002"` / `"1003"` / `"1004"`)**: Sai tên field trong DTO/Payload hoặc sai kiểu dữ liệu.
3. **HTTP 500 (`"1001"` / `"9999"`)**: Lỗi SQL/Database hoặc exception chưa được bắt trong Backend.
4. **Test Concurrency (`Expected: 1`, `Received: 2` hoặc `3`)**: Test bắn đồng thời 2–3 request trùng dữ liệu duy nhất (VD: trùng `bhyt_so_the` hoặc trùng `phone`) bằng `Promise.all()` và đếm số request trả về `"1000"`. Nếu `Received > 1` nghĩa là DB/BE chưa có ràng buộc `UNIQUE` hoặc transaction lock chống trùng lặp.

### 5.3. Bảng Mã Phản Hồi Chuẩn Đã Gộp (`response.body.code`)
Bộ test kiểm tra `response.body.code` theo đúng bộ mã phản hồi chuẩn hóa của dự án (không dùng mã cũ `2xxx`, `3xxx`, `4xxx`):

| Mã `code` | Ý nghĩa chuẩn |
| :---: | :--- |
| **`1000`** | Thành công (OK) |
| **`1002`** | Thiếu tham số bắt buộc |
| **`1003`** | Sai kiểu dữ liệu tham số |
| **`1004`** | Giá trị tham số không hợp lệ / Vi phạm logic điều kiện UI |
| **`1009`** | Không có quyền truy cập (RBAC / IDOR) |
| **`1010`** | Hành động đã được thực hiện trước đó (VD: bệnh án đã có bác sĩ tiếp nhận) |
| **`9992`** | Không tìm thấy đối tượng (Not Found) |
| **`9995`** | Tài khoản chưa xác thực / Sai mật khẩu |
| **`9996`** | Dữ liệu / Tài khoản đã tồn tại (Duplicate / Unique Constraint) |
| **`9998`** | Thiếu Token / Token sai / Hết hạn / Đã đăng xuất (Blacklist) |
| **`9999`** | Lỗi hệ thống nội bộ (Internal Server Error) |
