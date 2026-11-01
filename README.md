# Hệ Thống Kiểm Thử Tự Động Hóa API Thực Tế (Black-box Real API Testing)
## Dự Án: Quản Lý Bệnh Án Mày Đay & Phản Vệ (Urticaria & Anaphylaxis Medical Record System)

Dự án kiểm thử hộp đen (Black-box Testing) gọi trực tiếp vào hệ thống Backend API thực tế (**Zero Mocking**) được xây dựng bằng **TypeScript**, **Jest**, **Supertest** và xuất báo cáo trực quan bằng **`jest-html-reporters`**.

> **Nguyên tắc phân tách thư mục**:
> - `D:\doAn`: Thư mục chứa tài liệu đặc tả gốc (API HTML specs, Thiết kế giao diện Bác sĩ & Bệnh nhân, Bảng gộp mã phản hồi, `TestCaseDesign.md`).
> - `D:\doAnWork`: Thư mục chứa toàn bộ mã nguồn kiểm thử tự động, cấu hình, fixtures đối chiếu UI và báo cáo HTML.

---

## 1. Yêu Cầu Môi Trường (Prerequisites)

Trước khi cài đặt và chạy bộ kiểm thử, máy tính cần cài đặt:
- **Node.js**: Phiên bản `>= 18.x` (khuyến nghị `v18 LTS` hoặc `v20 LTS`).
- **npm**: Phiên bản `>= 9.x` (đi kèm với Node.js).
- **Backend Server & Database**: Hệ thống Backend API cần đang hoạt động (chạy ở `localhost` hoặc môi trường Staging/Dev) để nhận các HTTP Request thực tế từ Supertest.

Kiểm tra nhanh phiên bản trên thiết bị:
```bash
node -v
npm -v
```

---

## 2. Hướng Dẫn Cài Đặt (Installation)

Mở Terminal / PowerShell tại thư mục `D:\doAnWork` và chạy lệnh cài đặt toàn bộ thư viện:

```bash
cd D:\doAnWork
npm install
```
*(Lưu ý cho Windows PowerShell: Nếu máy tính đang bật `Restricted ExecutionPolicy` chặn file `npm.ps1`, bạn có thể chạy `npm.cmd install` và `npm.cmd test`, hoặc mở khóa tạm thời bằng `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`).*

Các thư viện cốt lõi được cài đặt:
- `typescript`, `ts-node`, `@types/node`
- `jest`, `ts-jest`, `@types/jest`
- `supertest`, `@types/supertest`
- `jest-html-reporters` (Xuất báo cáo HTML chi tiết tại `./reports/test-report.html`)
- `dotenv` (Quản lý cấu hình Base URL linh hoạt cho kiến trúc Monolith hoặc Microservices)

---

## 3. Cấu Hình Biến Môi Trường (`.env`)

Sao chép file `.env.example` thành `.env` (nếu chưa có):

```bash
cp .env.example .env
```

Mở file `.env` để cấu hình địa chỉ máy chủ Backend thực tế:

```ini
# Base URL mặc định cho hệ thống Backend (Monolith hoặc API Gateway)
API_BASE_URL=http://localhost:3000

# Cấu hình Base URL riêng biệt cho từng cụm dịch vụ (nếu triển khai Microservices).
# Nếu để trống, hệ thống tự động kế thừa từ API_BASE_URL.
AUTH_SERVICE_URL=http://localhost:3000
USER_ROLE_SERVICE_URL=http://localhost:3000
ORG_FACILITY_SERVICE_URL=http://localhost:3000
TEMPLATE_SERVICE_URL=http://localhost:3000
MEDREC_SERVICE_URL=http://localhost:3000
LESION_UAS7_SERVICE_URL=http://localhost:3000
CLINICAL_NOTIFY_SERVICE_URL=http://localhost:3000

# Thời gian chờ tối đa cho mỗi HTTP Request thực tế (ms)
API_TIMEOUT_MS=15000

# Tài khoản hạt giống (Seed Credentials) dùng cho Setup thực tế ở beforeAll
ADMIN_PHONE=0901000001
ADMIN_PASSWORD=AdminPassword@123
DOCTOR_PHONE=0901000002
DOCTOR_PASSWORD=DoctorPassword@123
NURSE_PHONE=0901000003
NURSE_PASSWORD=NursePassword@123
PATIENT_PHONE=0901000004
PATIENT_PASSWORD=PatientPassword@123
```

---

## 4. Cấu Trúc Thư Mục Theo Lịch Trình 10 Tuần (91 APIs)

Toàn bộ `tests/` được chia thành **10 thư mục tuần** tương ứng chính xác với bảng phân phối 91 API trong tài liệu `D:\doAn\api\1. Weekly API.html`:

```text
D:\doAnWork/
├── .env.example                     # Mẫu cấu hình biến môi trường
├── .env                             # Cấu hình Base URL & tài khoản thực thi
├── package.json                     # Khai báo scripts và dependencies
├── tsconfig.json                    # Cấu hình trình biên dịch TypeScript
├── jest.config.ts                   # Cấu hình Jest + jest-html-reporters
├── reports/
│   └── test-report.html             # Báo cáo kết quả kiểm thử trực quan (tự động sinh sau khi chạy)
├── docs/
│   ├── WEEKLY_API_MAPPING.md        # Bảng ánh xạ chi tiết 91 API vào 10 tuần
│   └── TEST_CASE_DESIGN_MATRIX.md   # Ma trận thiết kế Test Case & Ràng buộc UI
├── src/
│   ├── config/
│   │   ├── env.ts                   # Đọc biến môi trường & Base URL động
│   │   └── responseCodes.ts         # Bảng mã phản hồi đã gộp (1000, 1002, 1003, 1004, 9998, 1009...)
│   ├── types/
│   │   ├── api.types.ts             # Kiểu dữ liệu chuẩn của gói tin API
│   │   └── medrec.types.ts          # Kiểu dữ liệu Bệnh án Phản vệ, Mày đay Cấp/Mạn & UAS7 chuẩn UI
│   ├── clients/
│   │   └── apiClient.ts             # Wrapper Supertest gọi HTTP thật (Zero Mocking)
│   ├── utils/
│   │   ├── teardownRegistry.ts      # Quản lý dọn rác dữ liệu LIFO trong afterEach / afterAll
│   │   ├── authHelper.ts            # Gọi API thật (signup/login/create_staff) lấy Token động
│   │   └── uiValidators.ts          # Bộ kiểm tra logic điều kiện UI & định dạng dữ liệu
│   └── fixtures/
│       └── uiMedicalRecordPayloads.ts # Dữ liệu mẫu chuẩn hóa khớp 100% thiết kế giao diện Bác sĩ & Bệnh nhân
└── tests/
    ├── setup.ts
    ├── week1_auth/
    │   └── auth.spec.ts                                 # Tuần 1: Xác thực & Tài khoản (6 APIs)
    ├── week2_users_roles/
    │   └── users_roles.spec.ts                          # Tuần 2: Người dùng & Vai trò (9 APIs)
    ├── week3_permissions_branches/
    │   └── permissions_branches.spec.ts                 # Tuần 3: Permission & Chi nhánh Branch (12 APIs)
    ├── week4_departments_rooms_templates/
    │   └── departments_rooms_templates.spec.ts          # Tuần 4: Khoa/Ban, Phòng khám & Biểu mẫu Bệnh án (15 APIs)
    ├── week5_template_details/
    │   └── template_details.spec.ts                     # Tuần 5: Chi tiết Biểu mẫu - Sections & Questions (6 APIs)
    ├── week6_medrec_create_read/
    │   ├── medrec_classify_and_create.spec.ts           # Tuần 6 (Phần 1): Bộ câu hỏi, Phân luồng & Tạo bệnh án (3 APIs - 40+ TCs)
    │   └── medrec_read_and_accept.spec.ts               # Tuần 6 (Phần 2): Danh sách, Chi tiết, Tóm tắt & Tiếp nhận (4 APIs - 48 TCs)
    ├── week7_medrec_process_manage/
    │   └── medrec_answers_lifecycle.spec.ts             # Tuần 7: Xử lý Câu trả lời, Kết luận, Trạng thái, Lịch sử & Xóa (6 APIs - 65+ TCs)
    ├── week8_lesion_episodes_locations/
    │   └── lesion_episodes_locations.spec.ts            # Tuần 8: Đợt tổn thương & Vị trí bản đồ cơ thể (9 APIs)
    ├── week9_images_uas7/
    │   └── images_uas7.spec.ts                          # Tuần 9: Ảnh tổn thương, Ảnh câu trả lời & Điểm UAS7 (13 APIs)
    └── week10_prescriptions_lab_notifications/
        └── prescriptions_lab_notifications.spec.ts      # Tuần 10: Đơn thuốc, Xét nghiệm Lab & Thông báo FCM (8 APIs)
```

---

## 5. Hướng Dẫn Chạy Kiểm Thử (Execution Commands)

### 5.1. Kiểm tra biên dịch TypeScript (Type-check)
```bash
npm run typecheck
```

### 5.2. Chạy toàn bộ 10 tuần kiểm thử
```bash
npm test
```

### 5.3. Chạy kiểm thử riêng lẻ cho từng Tuần (từ Tuần 1 đến Tuần 10)
```bash
# Tuần 1: Xác thực & Tài khoản (signup, login, logout, forgot_password, reset_password, create_staff)
npm run test:week1

# Tuần 2: Người dùng & Phân quyền vai trò (profile, admin/users, roles)
npm run test:week2

# Tuần 3: Permission, Role-Permission & Cơ sở/Chi nhánh (Branches)
npm run test:week3

# Tuần 4: Khoa/Ban (Departments), Phòng khám (Rooms) & Biểu mẫu Bệnh án (Templates)
npm run test:week4

# Tuần 5: Chi tiết Biểu mẫu (Template Sections & Conditional Questions)
npm run test:week5

# Tuần 6: Bệnh án – Phân luồng, Tạo mới, Đọc chi tiết, Tóm tắt & Bác sĩ tiếp nhận
npm run test:week6

# Tuần 7: Bệnh án – Câu trả lời (GET/POST/PUT), Cập nhật kết luận, Đổi trạng thái, Lịch sử & Xóa
npm run test:week7

# Tuần 8: Đợt tổn thương (LesionEpisode) & Vị trí trên bản đồ cơ thể (LesionLocation)
npm run test:week8

# Tuần 9: Ảnh tổn thương (LesionPhoto, ImageAttachment, AnswerImage) & Chấm điểm UAS7
npm run test:week9

# Tuần 10: Đơn thuốc (Prescriptions), Xét nghiệm (Lab) & Thông báo (Notifications/FCM)
npm run test:week10
```

### 5.4. Chạy một file test bất kỳ theo đường dẫn
```bash
npx jest tests/week6_medrec_create_read/medrec_classify_and_create.spec.ts
```

---

## 6. Cách Xem Báo Cáo HTML Trực Quan (`jest-html-reporters`)

Ngay sau khi bất kỳ lệnh `npm test` hoặc `npm run test:week*` nào kết thúc, báo cáo HTML sẽ tự động được xuất ra tại:

```text
D:\doAnWork\reports\test-report.html
```

Để mở trực tiếp báo cáo trên trình duyệt mặc định của Windows (PowerShell/CMD):
```powershell
start .\reports\test-report.html
```
Báo cáo hiển thị rõ:
- Tổng số Test Suites và Test Cases (`Passed`, `Failed`, `Pending`).
- Thời gian phản hồi thực tế của từng API.
- Chi tiết thông điệp lỗi (nếu Backend trả về mã `code` khác kỳ vọng) kèm Stack Trace đầy đủ.

---

## 7. Các Quy Tắc Cốt Lõi Được Áp Dụng Trong Bộ Test

### 7.1. Zero Mocking & Quản Lý Dữ Liệu Thực Tế (`beforeAll` / `afterAll`)
- **Tuyệt đối không dùng Mock** (`nock`, `msw`, `jest.mock`). Mọi request đều đi qua `supertest(baseUrl)` tới thẳng Server thật.
- **Setup (`beforeAll`)**: Sử dụng `setupMultiRoleSessions` trong `src/utils/authHelper.ts` để gọi trực tiếp API Tuần 1 (`POST /api/auth/login`, `POST /api/auth/signup`, `POST /api/auth/create-staff`) nhằm lấy JWT Token thật cho 5 vai trò: `Admin`, `Doctor`, `Nurse`, `Patient`, và `OtherPatient` (phục vụ kiểm thử IDOR).
- **Teardown (`afterEach` / `afterAll`)**: Sử dụng `TeardownRegistry` (`src/utils/teardownRegistry.ts`) tự động gọi các API `DELETE` tương ứng theo thứ tự ngược (LIFO) để xóa sạch dữ liệu rác vừa tạo trong quá trình test.

### 7.2. Bảng Mã Phản Hồi Đã Gộp (Consolidated Response Codes)
Mọi lệnh `expectResponseCode(res.body.code, ...)` chỉ kiểm tra theo bảng mã chuẩn hóa trong `D:\doAn\api\3. response code.html`:

| Mã Code | Tên Hằng Số | Ý Nghĩa Chuẩn Hóa (Đã Gộp Mã Cũ) |
| :---: | :--- | :--- |
| **`1000`** | `OK` | Thành công (Bao gồm cả tạo mới thành công; đã gộp mã `1013` cũ). |
| **`1002`** | `MISSING_PARAMETER` | Thiếu tham số bắt buộc hoặc để trống trường required. |
| **`1003`** | `INVALID_PARAMETER_TYPE` | Sai kiểu dữ liệu (VD: truyền `string` vào trường `number` hoặc `array`). |
| **`1004`** | `INVALID_PARAMETER_VALUE` | Giá trị không hợp lệ: sai định dạng SĐT/Email, ngày sinh sai, điểm UAS7/VAS ngoài biên, **hoặc vi phạm logic điều kiện UI** (đã gộp các mã `2001`–`2007`). |
| **`1009`** | `NOT_ACCESS` | Không có quyền truy cập (RBAC: Bệnh nhân gọi API của Bác sĩ/Admin, hoặc lỗi IDOR). |
| **`1010`** | `ACTION_HAS_BEEN_DONE` | Hành động đã được thực hiện trước đó (VD: Bệnh án đã được bác sĩ khác tiếp nhận). |
| **`9992`** | `NOT_FOUND` | Không tìm thấy bản ghi (Bệnh án, Người dùng, Biểu mẫu, Thông báo không tồn tại). |
| **`9995`** | `USER_IS_NOT_VALIDATED` | Tài khoản không tồn tại, bị khóa hoặc sai thông tin đăng nhập (đã gộp `2008`, `2009`). |
| **`9996`** | `USER_EXISTED` | Dữ liệu / Tài khoản / SĐT / Email đã tồn tại (đã gộp `2003`, `2004`). |
| **`9998`** | `INVALID_TOKEN` | Token sai, hết hạn hoặc không truyền header `Authorization` (đã gộp `1011`, `1012`). |
| **`9999`** | `EXCEPTION_ERROR` | Lỗi hệ thống nội bộ (Internal Server Error). |

### 7.3. Đối Chiếu Chặt Chẽ Với Thiết Kế Giao Diện (UI Cross-Referencing)
1. **Logic phân luồng bệnh án (Routing Logic)**:
   - Triệu chứng cấp cứu đe dọa tính mạng (khó thở, thở rít, phù lưỡi/họng, tụt HA, ngất) $\rightarrow$ **`PHAN_VE`**.
   - Sẩn phù/phù mạch kéo dài **$< 6$ tuần** và không có dấu hiệu phản vệ $\rightarrow$ **`MAY_DAY_CAP`**.
   - Sẩn phù/phù mạch kéo dài **$\ge 6$ tuần** liên tục và không có dấu hiệu phản vệ $\rightarrow$ **`MAY_DAY_MAN_TINH`** (mở khóa bảng điểm **UAS7**).
2. **Logic ẩn/hiện trường có điều kiện (Conditional Visibility)**:
   - Khi trường cha `trieu_chung_ho_hap_co_khong_pv = "Không"`, các trường con (`trieu_chung_ho_hap_hien_tai_pv`, `tien_su_benh_nen_ho_hap_pv`, `dien_bien_ho_hap_pv`) bị ẩn trên giao diện nên Payload gửi lên phải bỏ trống hoặc không gửi; nếu cố tình gửi dữ liệu mâu thuẫn sẽ được kiểm tra trả về mã `1004` (hoặc Backend tự động lọc bỏ).
3. **Cấu trúc trường phức hợp & mảng đính kèm**:
   - Nhóm dị nguyên nghi ngờ (`yeu_to_nghi_ngo_pv_thuc_an` đi kèm `thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an`, `tien_su_phan_ung_yeu_to_pv_thuc_an`).
   - Mảng ảnh sẩn phù thực tế (`anh_san_phu`, `anh_san_phu_pv`).
