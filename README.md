# Mayday API tests — Weeks 1–8

Đây là một bộ Jest + Supertest duy nhất, gọi backend qua HTTP. Bộ test không import source của backend, không có mock server `app.js`, không tự khởi động service. Các backend Node.js khác nhau chỉ cần cung cấp đúng API contract và một adapter riêng để chuẩn bị/xóa dữ liệu test.

## Cài đặt

Yêu cầu Node.js 18+:

```powershell
npm ci
```

## Cấu hình URL cho từng nhóm

Trước khi chạy, xác nhận backend đang trỏ tới **database test riêng biệt**, không phải production hoặc database dùng chung. Mỗi nhóm chạy cùng bộ test bằng cách thay URL, tên target, database và đường dẫn adapter:

```powershell
$env:MAYDAY_TEST_TARGET_NAME = "backend-group-a"
$env:MAYDAY_TEST_BASE_URL = "https://<host-deploy-cua-nhom>"
$env:MAYDAY_TEST_CONFIRM_HOST = "<host-deploy-cua-nhom>"
$env:MAYDAY_TEST_ENV = "1"
$env:MAYDAY_TEST_DB = "1"
$env:MAYDAY_TEST_DB_NAME = "mayday_test"
$env:MAYDAY_TEST_ADAPTER = "C:\path\to\backend\mayday-test-adapter.js"
npm test
```

Với backend local, dùng URL `http://127.0.0.1:<port>` và đặt `MAYDAY_TEST_CONFIRM_HOST` chính xác là `127.0.0.1`. Mọi target, kể cả local, phải bật cờ xác nhận và có database name chứa `test`. Target không loopback bắt buộc HTTPS.

Guard kiểm tra URL/host trước khi có request HTTP. Trước request đầu tiên, adapter phải xác nhận kết nối thực tế tới đúng database test. Không cấu hình credential trong test hoặc commit secret. Chỉ các target có thể xóa tài khoản và fixtures do bộ test tạo mới phù hợp để chạy.

## Adapter cho từng backend

Adapter mẫu ở [adapter.example.js](./tests/integration/adapters/adapter.example.js) là giao diện cần triển khai cho mỗi nhóm. Adapter là phần duy nhất phụ thuộc database/schema của nhóm; các kiểm thử còn lại chỉ gọi HTTP:

- xác nhận đúng database test;
- lấy role ID và nâng quyền cho tài khoản admin do test vừa đăng ký (`director` mặc định role ID `1`);
- xóa đúng các tài khoản được tạo bởi suite; soft-delete fixture khi case yêu cầu;
- xóa role test được tạo bởi Week 2;
- bật/tắt trạng thái tài khoản;
- lấy OTP bằng test hook, điều khiển test clock và tạo token hết hạn;
- tạo fixture branch/department/room, gồm các fixture không khớp quan hệ hoặc đã xóa;
- tạo department/staff phụ thuộc branch và dọn permissions, roles, branches do Week 3 tạo;
- tạo và dọn các dependency fixtures của khoa, phòng và template do Week 4 tạo;
- tạo và dọn record test-only dùng template để kiểm tra thao tác bị khóa ở Week 5;
- tạo và dọn câu hỏi/template classify cùng các bản ghi bệnh án test-only của Week 6;
- tạo và dọn template/câu hỏi/option cùng bản ghi bệnh án test-only của Week 7;
- tạo và dọn ảnh fixture test-only; episode/location của Week 8 được tạo qua API;
- dọn fixture và khôi phục test hook sau khi chạy.

Giá trị adapter cần trả về:

- `getRoleIds()`: `{ admin: 1, patient: 8, doctor: 4, nurse: 6, technician: 7 }` (lấy từ DB thực của nhóm; admin phải là `director=1`);
- `prepareStaffFixture()`: `{ branch_id, department_id, room_id, other_branch_department_id, other_department_room_id, deleted_branch_id, deleted_department_id }`, tất cả ID là số nguyên;
- `prepareUserWithLinkedData()`: tạo dữ liệu phụ thuộc test-only cho user để xác nhận xóa mềm không làm mất dữ liệu liên quan;
- `prepareBranchDependencies()`: tạo khoa và, khi được yêu cầu, nhân viên test-only gắn đúng vào branch ID được truyền vào;
- `cleanupWeek3Resources()`: xóa đúng các permission, role, branch và liên kết mà suite Week 3 đã tạo theo ID;
- `restoreRolePermission()`: khôi phục liên kết có sẵn của admin nếu backend xóa nhầm liên kết trong case kiểm tra bảo vệ quyền admin;
- `prepareWeek4OrganizationDependency()`: tạo fixture test-only theo `kind` (`staff_department`, `staff_room`, `template_tree`, `template_in_use`), trả về `{ fixtureId, staffId?, sectionIds?, questionIds? }`;
- `cleanupWeek4OrganizationDependencies()`: xóa đúng fixture theo các `fixtureId` đã trả về từ hook setup;
- `prepareWeek5TemplateUsage()`: gắn một record test-only vào template suite vừa tạo, trả về `{ fixtureIds }`;
- `cleanupWeek5Fixtures()`: xóa chính xác dependency fixture theo các ID đã trả về;
- `prepareWeek6Fixtures()`: tạo câu hỏi sàng lọc, template/quy tắc ánh xạ và answer fixtures, không tạo tài khoản;
- `prepareWeek6MedicalRecord()`: tạo một bản ghi test-only theo patient/template/status truyền vào, trả về `{ fixtureId, medicalRecordId, record }`;
- `cleanupWeek6Fixtures()`: chỉ xóa fixture ID, record ID và record thuộc hai patient mới do suite đăng ký;
- `prepareWeek7Fixtures()`: tạo template active cùng câu hỏi/option test-only, trả về `{ fixtureIds, template: { id }, questions: { choice, text, json, foreignOption }, absentQuestionId }`; không tạo user hoặc bệnh án;
- `prepareWeek7MedicalRecord()`: tạo mới một bệnh án pending cho patient/doctor do suite vừa đăng ký, trả về `{ fixtureId, medicalRecordId }`;
- `cleanupWeek7Fixtures()`: xóa chính xác các token fixture được truyền vào, hỗ trợ gọi lặp an toàn và trả về `{ cleaned: true }`;
- `prepareWeek8LesionPhoto()`: tạo ảnh test-only liên kết với bệnh nhân, bệnh án, episode và location được truyền vào, trả về `{ fixtureId, attachmentId, fileUrl }`;
- `cleanupWeek8Fixtures()`: xóa chính xác các token fixture của Week 8, hỗ trợ gọi lặp an toàn và trả về `{ cleaned: true }`;
- `getExpiredToken()`: JWT đã ký hợp lệ cho tài khoản chỉ định nhưng đã hết hạn.

Không dùng ID cố định cho fixture được tạo mới; các ID sentinel trong workbook chỉ dùng để kiểm tra không tồn tại, và trước khi gửi PUT/DELETE lên sentinel suite phải xác nhận GET trả `9992`. Không truncate/reset toàn database. Adapter phải giới hạn cleanup đúng vào dữ liệu riêng của suite. Test tạo tài khoản bằng API rồi mới promote; do đó không cần seed tài khoản test trước.

## Chạy và phạm vi

```powershell
npm test
```

Suite [auth.integration.js](./tests/integration/week1/auth.integration.js) phủ đủ **144 case** của Week 1. Suite [users.integration.js](./tests/integration/week2/users.integration.js) phủ đủ **176 case** của Week 2. Tổng cộng có 320 test riêng, so khớp ID và mã expected với workbook. Cả hai chạy bằng cùng `npm test`; không có mock/alternate test path.

Suite [permissions-branches.integration.js](./tests/integration/week3/permissions-branches.integration.js) phủ đủ **187 case** của Week 3; [organization-templates.integration.js](./tests/integration/week4/organization-templates.integration.js) phủ đủ **241 case** của Week 4; [template-sections-questions.integration.js](./tests/integration/week5/template-sections-questions.integration.js) phủ đủ **125 case** của Week 5; [medical-records-create-read.integration.js](./tests/integration/week6/medical-records-create-read.integration.js) phủ đủ **110 case** của Week 6; [medical-records-answers-status-history.integration.js](./tests/integration/week7/medical-records-answers-status-history.integration.js) phủ đủ **115 case** của Week 7; [lesion-episodes-locations.integration.js](./tests/integration/week8/lesion-episodes-locations.integration.js) phủ đủ **206 case** của Week 8. Tổng cộng có **1.304 test riêng từ Week 1–8**, so khớp ID và mã expected với workbook. Week 9–10 chưa được chuyển đổi; tiếp tục theo đúng thứ tự workbook và không dùng lại các test mock cũ.

Ghi chú workbook Week 4: một số case template dùng `999999999` để đại diện mã template không tồn tại dù giá trị này có thể không hợp lệ theo format code. Suite giữ expected code của workbook; riêng DELETE sentinel được chặn an toàn bằng GET preflight trước khi gửi request.

Week 5 giả định `{id}` trên endpoint question là `question_id` dạng chuỗi theo workbook; option `id` được backend cấp khi tạo option. Các case missing-resource dùng ID của fixture do chính test tạo rồi xóa trước, tránh tác động nhầm dữ liệu.

Week 7 dùng câu hỏi lựa chọn, text và JSON thuộc template fixture; `foreignOption` phải thuộc một câu hỏi lựa chọn khác trong cùng template, còn `absentQuestionId` phải được xác minh không tồn tại. Case sửa bệnh án dùng record pending mới do adapter tạo. Những record được API tạo trong các case còn lại chỉ được xóa theo ID đã ghi nhận qua HTTP admin API; tài khoản đăng ký được xóa theo chính xác số điện thoại. W7-MAS-16 giữ mã expected `1004` theo cột G dù sheet quyết định chung có thể diễn giải giới hạn số lượng request là `1009`.

Week 8 dùng template do `prepareWeek7Fixtures()` tạo; adapter chỉ tạo ảnh test-only cho các case upload, còn bệnh án, episode và location được tạo qua API và dọn theo ID suite ghi nhận. Bộ test cũng gọi một số GET của Week 9 để xác minh việc cascade xóa/giữ ảnh, nên backend cần có các route đọc đó để chạy Week 8. Với cascade delete, test kỳ vọng thao tác xóa trả `1000`, rồi GET tài nguyên con đã xóa trả `9992`.

Theo lựa chọn người dùng, W6-MCR-02 xác minh answers qua `GET /api/medical_records/{id}/answers` (API được lập lịch ở Week 7), nên Week 6 cần target có route đó. Với W6-MRL-14, suite giữ mã Expected `1003` ở cột G cho `patient_id` sai kiểu và đồng thời kiểm tra quyết định riêng `status` chứa SQL injection trả `1004`.

Response code được kiểm tra theo sheet `Quyết định spec`: thành công `1000`, thiếu field `1002`, sai kiểu/request `1003`, sai giá trị `1004`, cấm/khóa/rate limit `1009`, không tồn tại `9992`, OTP `9993`, sai mật khẩu `9995`, trùng `9996`, auth/token `9998`, OTP provider `9999`.

Test không thực hiện request nếu thiếu URL/host confirmation, test DB confirmation hoặc adapter. Không chạy suite này trên production.
