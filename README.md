# Hướng dẫn cài đặt & chạy API Auto-Test — Mayday

Tài liệu dành cho các đội **Backend Node.js** muốn chạy bộ kiểm thử API của dự án Mayday trên backend của mình. Bộ test dùng **Jest + Supertest**, gửi request HTTP tới service đang chạy và không import mã nguồn backend.

> **Phạm vi hiện tại:** 1.606 test case thuộc Week 1–9. Week 10 chưa được chuyển đổi.

---

## 1. Nguyên tắc hoạt động & bảo vệ dữ liệu

Bộ test chạy theo kiểu **black-box API testing**: mỗi backend chỉ cần cung cấp service URL, database test riêng và adapter tương thích.

1. **Không chạy mock hoặc app giả lập**
   - Bộ test không dùng `app.js`, không tự khởi động server và không truy cập trực tiếp database trong các test script.
   - `npm test` là lệnh duy nhất để chạy các suite hiện có.

2. **Có các bước chặn trước khi gửi request**
   - Phải khai báo rõ URL, hostname xác nhận, môi trường test, tên database test và đường dẫn adapter.
   - Database name phải có chữ `test`; hostname xác nhận phải trùng chính xác hostname trong URL.
   - Backend deploy phải dùng HTTPS. HTTP chỉ được phép với địa chỉ loopback như `127.0.0.1`.
   - URL chỉ được gồm origin, không kèm credentials, path, query hoặc fragment.

3. **Tài khoản và dữ liệu do suite sở hữu**
   - Suite đăng ký tài khoản qua API rồi mới nhờ adapter nâng quyền.
   - Dữ liệu cần ghi/xóa được tạo riêng cho test và được theo dõi bằng ID hoặc token fixture.
   - Adapter phải chỉ xóa đúng tài khoản và fixture mà suite tạo; **không truncate/reset toàn database**.

4. **Adapter phải xác minh database thật**
   - Cờ môi trường chỉ là xác nhận của người chạy; trước request đầu tiên, adapter vẫn phải kiểm tra kết nối database thực tế.
   - Không chạy trên production hoặc database dùng chung.

---

## 2. Yêu cầu môi trường

Trước khi chạy, cần có:

- **Node.js 18 trở lên** và npm.
- Backend của đội đang chạy tại URL có thể truy cập từ máy chạy test.
- Một **database test riêng biệt**, đã chạy các migration/seed cần thiết.
- Adapter riêng của backend, có thể xác minh database và dọn dữ liệu do suite tạo.

> Bộ test không tự bật backend. Với môi trường local, hãy khởi động service trước khi chạy Jest.

---

## 3. Cài đặt bộ Auto-Test

### Bước 1: Lấy repository

```powershell
git clone <URL_REPOSITORY_MAYDAY_TEST>
cd mayday-test
```

### Bước 2: Cài dependency

```powershell
npm ci
```

### Bước 3: Chuẩn bị adapter cho backend

Xem [adapter.example.js](./tests/integration/adapters/adapter.example.js) để biết danh sách hàm và hợp đồng cần triển khai. Adapter là phần phụ thuộc vào database/schema của từng nhóm; test script vẫn chỉ gọi backend qua HTTP.

Adapter mẫu hiện là các hàm placeholder có chủ ý và sẽ báo lỗi cho đến khi nhóm backend triển khai. Tối thiểu, adapter phải xác minh database test, đọc role ID thực tế, promote tài khoản suite vừa đăng ký, xóa chính xác tài khoản/fixture theo quyền sở hữu và khôi phục các test hook sau khi chạy.

---

## 4. Cấu hình target của từng nhóm

Runner hiện đọc cấu hình từ **environment variables**; chưa dùng `.env.test`. Hãy mở PowerShell tại thư mục repository và cấu hình URL, database cùng adapter cho backend cần test.

### Backend local

```powershell
$env:MAYDAY_TEST_TARGET_NAME = "backend-group-a-local"
$env:MAYDAY_TEST_BASE_URL = "http://127.0.0.1:3000"
$env:MAYDAY_TEST_CONFIRM_HOST = "127.0.0.1"
$env:MAYDAY_TEST_ENV = "1"
$env:MAYDAY_TEST_DB = "1"
$env:MAYDAY_TEST_DB_NAME = "mayday_test"
$env:MAYDAY_TEST_ADAPTER = "C:\path\to\backend\mayday-test-adapter.js"
```

### Backend trên môi trường deploy

```powershell
$env:MAYDAY_TEST_TARGET_NAME = "backend-group-a"
$env:MAYDAY_TEST_BASE_URL = "https://<host-deploy-cua-nhom>"
$env:MAYDAY_TEST_CONFIRM_HOST = "<host-deploy-cua-nhom>"
$env:MAYDAY_TEST_ENV = "1"
$env:MAYDAY_TEST_DB = "1"
$env:MAYDAY_TEST_DB_NAME = "mayday_test"
$env:MAYDAY_TEST_ADAPTER = "C:\path\to\backend\mayday-test-adapter.js"
```

### Lưu ý cấu hình

- Thay `MAYDAY_TEST_BASE_URL`, `MAYDAY_TEST_CONFIRM_HOST`, `MAYDAY_TEST_DB_NAME` và `MAYDAY_TEST_ADAPTER` theo đúng target của nhóm.
- `MAYDAY_TEST_ADAPTER` phải là đường dẫn tuyệt đối tới adapter đã triển khai.
- `MAYDAY_TEST_CONFIRM_HOST` phải khớp chính xác hostname trong URL.
- `MAYDAY_TEST_DB_NAME` phải là database test riêng và tên phải chứa `test` (ví dụ `mayday_test`).
- Backend deploy ngoài loopback bắt buộc dùng HTTPS; URL không được có path, query, fragment hoặc username/password.
- Không lưu credentials vào test script hoặc commit secrets. Mỗi đội tự cấu hình adapter an toàn cho môi trường của mình.

---

## 5. Các lệnh chạy test

### Liệt kê các suite Jest nhận diện được

```powershell
npm test -- --listTests
```

### Chạy toàn bộ suite hiện có

```powershell
npm test
```

### Chạy một tuần cụ thể

Truyền đường dẫn suite qua Jest:

```powershell
npm test -- --runTestsByPath tests/integration/week1/auth.integration.js
npm test -- --runTestsByPath tests/integration/week2/users.integration.js
```

Thay đường dẫn tương ứng để chạy tuần khác. Các biến môi trường và adapter vẫn bắt buộc cho mọi lệnh test.

---

## 6. Phạm vi test hiện có

| Tuần | Suite | Số case | Nội dung chính |
|---|---|---:|---|
| 1 | [auth.integration.js](./tests/integration/week1/auth.integration.js) | 144 | Signup, login, logout, OTP/password, tạo staff |
| 2 | [users.integration.js](./tests/integration/week2/users.integration.js) | 176 | Profile, users, roles |
| 3 | [permissions-branches.integration.js](./tests/integration/week3/permissions-branches.integration.js) | 187 | Permissions, role-permissions, branches |
| 4 | [organization-templates.integration.js](./tests/integration/week4/organization-templates.integration.js) | 241 | Departments, rooms, templates |
| 5 | [template-sections-questions.integration.js](./tests/integration/week5/template-sections-questions.integration.js) | 125 | Template sections, questions, options |
| 6 | [medical-records-create-read.integration.js](./tests/integration/week6/medical-records-create-read.integration.js) | 110 | Tạo, lọc và đọc medical records |
| 7 | [medical-records-answers-status-history.integration.js](./tests/integration/week7/medical-records-answers-status-history.integration.js) | 115 | Answers, trạng thái và lịch sử |
| 8 | [lesion-episodes-locations.integration.js](./tests/integration/week8/lesion-episodes-locations.integration.js) | 206 | Lesions, episodes, locations |
| 9 | [image-attachments-lesion-photos-uas7.integration.js](./tests/integration/week9/image-attachments-lesion-photos-uas7.integration.js) | 302 | Upload, attachments, lesion photos, UAS7 |
| **Tổng** |  | **1.606** | Đối chiếu ID và mã expected theo workbook |

---

## 7. Adapter: các nhóm chức năng cần triển khai

Hợp đồng đầy đủ nằm trong [adapter.example.js](./tests/integration/adapters/adapter.example.js). Theo tuần, adapter có thể cần:

- **Dùng chung:** xác nhận test database, lấy role IDs, promote/xóa tài khoản, lấy OTP/token hết hạn, bật/tắt test hooks.
- **Week 2–3:** user liên kết, branch/department/room fixtures, permission/role/branch cleanup.
- **Week 4–5:** dependency fixture cho organization/template và record dùng template.
- **Week 6–7:** template/question/answer fixtures và medical-record fixture.
- **Week 8–9:** photo fixture và test hook giả lập lỗi MinIO.

Mọi hàm nhận `expectedDatabaseName`. Cách kết nối thực tế và xác minh đúng database là trách nhiệm của adapter. Các hook cleanup phải nhận và xóa đúng ID/token được suite truyền vào; không được xóa theo điều kiện rộng như “mọi user test” nếu không có giới hạn ownership rõ ràng.

---

## 8. Lưu ý từ workbook và giả định API

- **Week 4:** một số test template dùng `999999999` làm mã không tồn tại dù có thể không hợp lệ theo format code. Trước khi PUT/DELETE sentinel, suite kiểm tra GET trả `9992`.
- **Week 5:** `{id}` của question được hiểu là `question_id` dạng chuỗi; option IDs do backend cấp. Case missing-resource dùng fixture suite tự tạo rồi xóa.
- **Week 6:** W6-MCR-02 xác minh answers qua `GET /api/medical_records/{id}/answers` (route được lập lịch ở Week 7). W6-MRL-14 giữ expected `1003` trong cột G cho `patient_id` sai kiểu và kiểm tra riêng SQL-like `status` trả `1004`.
- **Week 7:** W7-MAS-16 giữ mã expected `1004` theo cột G, dù quy tắc chung về giới hạn request có thể được hiểu là `1009`.
- **Week 8:** dùng template fixture từ Week 7 và một số GET của Week 9 để kiểm tra cascade delete. Backend cần có các route đọc liên quan; delete kỳ vọng `1000`, GET tài nguyên đã xóa kỳ vọng `9992`.
- **Week 9:** upload một ảnh dùng field `file`, nhiều ảnh dùng `images[]`; tên field nhiều ảnh là giả định vì workbook không quy định rõ. ATU-15 bật test hook MinIO failure, kỳ vọng `1007`, rồi tắt hook trong `finally`. Các route ATV/PHX chỉ xác nhận HTTP 200.

Các suite chưa được chạy với API thật vì cần URL backend, database test riêng và adapter đã triển khai.

---

## 9. Lỗi thường gặp

| Lỗi | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `Set MAYDAY_TEST_BASE_URL...` | Chưa cấu hình URL backend | Đặt `MAYDAY_TEST_BASE_URL` tới service đang chạy |
| `set MAYDAY_TEST_ENV=1 and MAYDAY_TEST_DB=1` | Thiếu cờ xác nhận môi trường test | Chỉ đặt hai biến bằng `1` sau khi chắc chắn target dùng database test |
| `MAYDAY_TEST_DB_NAME must identify an isolated test database...` | Tên database thiếu `test` hoặc không phải DB riêng | Dùng database test chuyên biệt, ví dụ `mayday_test` |
| `MAYDAY_TEST_ADAPTER must be an absolute path...` | Chưa đặt adapter hoặc đường dẫn không tuyệt đối | Đặt đường dẫn tuyệt đối tới adapter đã triển khai |
| `Set MAYDAY_TEST_CONFIRM_HOST...` | Host xác nhận không khớp URL | Đặt bằng chính xác hostname của `MAYDAY_TEST_BASE_URL` |
| `Deployment targets must use HTTPS...` | Target deploy dùng HTTP | Dùng HTTPS; HTTP chỉ dùng được với loopback local |
| `MAYDAY_TEST_BASE_URL must contain only the origin...` | URL có thêm path, query, fragment hoặc credentials | Chỉ đặt scheme + hostname + port |
| Adapter không xác nhận test database | Adapter chưa kiểm tra đúng database thực tế | Hoàn thiện `assertTestDatabase()` trước khi chạy suite |
| `ECONNREFUSED` / timeout | Backend chưa chạy, sai port hoặc không truy cập được | Khởi động service, kiểm tra URL/port/firewall |
| `The target adapter must implement ...()` | Adapter thiếu hook mà suite cần | Bổ sung hook tương ứng từ `adapter.example.js` |

---

## 10. Cách phối hợp với đội Backend

1. Đội backend tạo database test riêng, chạy migration/seed và khởi động service.
2. Triển khai adapter theo schema/database của đội; xác minh DB trước khi thay đổi fixture.
3. Cấu hình target bằng các biến ở mục 4, sau đó chạy một suite riêng trước.
4. Khi suite riêng ổn, chạy `npm test` để chạy toàn bộ các tuần hiện có.
5. Đọc response code/assertion lỗi như sai khác API contract; không “sửa” expected chỉ để làm test pass nếu chưa đối chiếu workbook/spec.

Không chạy suite trên production hoặc database dùng chung.
