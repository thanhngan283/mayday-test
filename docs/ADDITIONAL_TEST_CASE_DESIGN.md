# Thiết Kế Kịch Bản Kiểm Thử Nâng Cao (Additional Test Case Design)
## Chuẩn Hóa Theo `QA_Agent.md` & `AdditionalTestCaseDesign.md`

Tài liệu này liệt kê **15 Kịch bản Kiểm thử Hộp đen Thực tế (Real API - Zero Mocking)** bổ sung cho:
1. **Race Condition & Unique Constraint (Chống trùng lặp dữ liệu bằng `Promise.all()`)**
2. **Token Lifecycle & Blacklist (Danh sách Token thu hồi/hết hạn & Chống False Positive)**
3. **Read-only / Auto-calculated Fields (`nlr`, `plr`, `uas7_tong`, `aas7_tong`) & Ràng buộc Ẩn/Hiện UI**

---

## 1. Bảng Thiết Kế 15 Test Cases Chuyên Sâu (Test Case Design Matrix)

| Mã Test Case | Nhóm Kịch Bản | Endpoint & Phương Thức | Mô Tả Kịch Bản & Dữ Liệu Đầu Vào | Mã Phản Hồi Kỳ Vọng (`body.code`) |
| :--- | :--- | :--- | :--- | :---: |
| **`TC-ADV-CONC-01`** | **Concurrency / Race Condition (`bhyt_so_the`)** | `PUT /api/profile` (`Promise.all` x2) | 2 request gửi đồng thời (cùng millisecond) cập nhật cùng 1 số thẻ BHYT duy nhất (`bhyt_so_the: "DN401..."`). | **1 pass (`"1000"`), 1 fail (`"9996"`)** |
| **`TC-ADV-CONC-02`** | **Concurrency / Race Condition (`bhyt_so_the`)** | `POST /api/medical_records` (`Promise.all` x2) | 2 request khởi tạo bệnh án đồng thời chứa cùng 1 số thẻ BHYT (`bhyt_so_the`). | **1 pass (`"1000"`), 1 fail (`"9996"`)** |
| **`TC-ADV-CONC-03`** | **Concurrency / Spam Click x3 (`bhyt_so_the`)** | `PUT /api/profile` (`Promise.all` x3) | Gửi đồng thời 3 HTTP PUT requests chứa cùng 1 mã thẻ BHYT `bhyt_so_the`. | **1 pass (`"1000"`), 2 fail (`"9996"`)** |
| **`TC-ADV-CONC-04`** | **Concurrency / Race Condition (`phone`)** | `POST /api/auth/signup` (`Promise.all` x2) | 2 request đăng ký tài khoản bệnh nhân cùng lúc với cùng 1 số điện thoại `phone`. | **1 pass (`"1000"`), 1 fail (`"9996"`)** |
| **`TC-ADV-CONC-05`** | **Concurrency / Race Condition (`staff phone`)** | `POST /api/auth/create-staff` (`Promise.all` x2) | Admin gửi đồng thời 2 request tạo nhân viên y tế trùng số điện thoại `phone`. | **1 pass (`"1000"`), 1 fail (`"9996"`)** |
| **`TC-ADV-CONC-06`** | **Concurrency / Race Condition (`template_code`)** | `POST /api/templates` (`Promise.all` x2) | Gửi đồng thời 2 request tạo biểu mẫu bệnh án trùng mã `code`. | **1 pass (`"1000"`), 1 fail (`"9996"`)** |
| **`TC-ADV-CONC-07`** | **Concurrency / Race Condition (`accept record`)** | `POST /api/medical_records/:id/accept` (`Promise.all` x2) | 2 Bác sĩ bấm "Tiếp nhận bệnh án" trên cùng 1 `record_id` tại cùng một thời điểm. | **1 pass (`"1000"`), 1 fail (`"1010"` / `"9996"`)** |
| **`TC-ADV-TOKEN-01`** | **Token Lifecycle & Blacklist (Luồng 4 Bước)** | `POST /api/auth/login` $\rightarrow$ `GET /api/profile` (x3) $\rightarrow$ `POST /api/auth/logout` $\rightarrow$ `GET /api/profile` | **B1**: Login lấy `Token_A` (`1000`).<br>**B2**: Gọi `GET /api/profile` 3 lần liên tiếp bằng `Token_A` (cả 3 đều `1000` - chống False Positive).<br>**B3**: Gọi `POST /api/auth/logout` bằng `Token_A` (`1000`).<br>**B4**: Gọi lại `GET /api/profile` bằng `Token_A` $\rightarrow$ Bị chặn đứng. | **B1–B3: `"1000"`<br>B4: `"9998"`** |
| **`TC-ADV-TOKEN-02`** | **Token Blacklist (Anti-False-Positive Burst)** | `GET /api/profile` (`Promise.all` x3) $\rightarrow$ `POST /api/auth/logout` $\rightarrow$ `GET /api/profile` | Dùng `Token_A` gọi đồng thời 3 requests `GET /api/profile` (vẫn pass `1000`), sau khi Logout mới chặn `9998`. | **Trước Logout: `"1000"`<br>Sau Logout: `"9998"`** |
| **`TC-ADV-TOKEN-03`** | **Token Blacklist (Cross-Module Enforcement)** | `PUT /api/profile` & `GET /api/medical_records/all` | Dùng `Token_A` đã bị thu hồi gọi sang các phân hệ khác (sửa hồ sơ, đọc bệnh án). | **`"9998"`** |
| **`TC-ADV-TOKEN-04`** | **Token Blacklist (Replay Logout Attack)** | `POST /api/auth/logout` (x2) | Dùng `Token_A` đã đăng xuất để gọi lại API `logout` lần thứ 2. | **`"9998"`** |
| **`TC-ADV-TOKEN-05`** | **Token Blacklist (Multi-Session Isolation)** | `POST /api/auth/login` (`Token_A`, `Token_B`) | Logout `Token_A` chỉ thu hồi `Token_A` (`9998`), không làm hỏng `Token_B` mới đăng nhập (`1000`). | **`Token_A`: `"9998"`<br>`Token_B`: `"1000"`** |
| **`TC-ADV-CALC-01`** | **Read-only / Auto-calculated (`nlr`, `plr`)** | `POST /api/medical_records/:id/answers` | Gửi thử `nlr: 9999.9`, `plr: 8888.8` kèm Neutrophils=6.0, Lymphocytes=2.0, Platelets=240. BE phải bỏ qua giá trị giả mạo và tự tính lại. | **`"1000"`** *(BE ignore `9999.9`/`8888.8`)* |
| **`TC-ADV-CALC-02`** | **Read-only / Auto-calculated (`uas7_tong`, `aas7_tong`)** | `POST /api/uas7-scores` | Gửi thử `uas7_tong: 999`, `aas7_tong: 777` trong payload chấm điểm ngày. BE phải bỏ qua và tự tính tổng thực tế ($\le 42$). | **`"1000"`** *(BE ignore `999`/`777`)* |
| **`TC-ADV-COND-01`** | **Conditional Logic (`trieu_chung_ho_hap_co_khong_pv`)** | `POST /api/medical_records/:id/answers` | Trường cha `trieu_chung_ho_hap_co_khong_pv = "Không"` nhưng vẫn gửi trường con `trieu_chung_ho_hap_hien_tai_pv`. | **`"1004"`** *(hoặc `"1000"` kèm nullify trường con)* |

---

## 2. Lệnh Thực Thi Bộ Kiểm Thử Nâng Cao

Tại thư mục `D:\doAnWork`:
```powershell
# Chạy riêng bộ 15 Test Cases Nâng cao (Concurrency, Token Blacklist, Auto-Calculated Fields)
npm.cmd run test:advanced

# Hoặc chạy trực tiếp bằng Jest
npx jest tests/advanced_scenarios/concurrency_and_token_blacklist.spec.ts --runInBand
```
