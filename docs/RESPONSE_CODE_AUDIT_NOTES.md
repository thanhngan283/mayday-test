# Báo Cáo Đối Chiếu Mã Phản Hồi (Response Code Audit Notes)

**Nguồn đối chiếu:**
* Bộ mã chuẩn: `D:\doAn\response_code\Bảng mã lỗi.html`
* Bộ Test Cases hiện tại: Toàn bộ **12 file `.spec.ts`** trong `D:\doAnWork\tests\` (tổng **398 lệnh kiểm tra mã phản hồi**).

---

## 1. Kết Luận Nhanh (Executive Summary)

* **100% các mã số đang dùng trong bộ Test là mã hợp lệ** theo `Bảng mã lỗi.html` (**13 mã phân biệt**).
* **0 mã sai / mã tự chế**, **0 mã cũ chưa gộp** (`2xxx`, `3xxx`, `4xxx`, `5xxx`, `6xxx`, `7xxx`, `8xxx`, `90xx`, `91xx`, `990x`).
* **0 mã hardcode dạng chuỗi/số** trong các dòng `expect(...)` (tất cả đều đi qua hằng số `RESPONSE_CODES.*` trong `src/config/responseCodes.ts`).
* **Điểm cần lưu ý sau khi đối chiếu cột H (`Dùng cho tình huống trong test`) của `Bảng mã lỗi.html`:**
  * **1 điểm có khả năng lệch kịch bản** (`1009` vs `1010` khi xóa bản ghi còn khóa ngoại phụ thuộc).
  * **3 điểm đang cho phép mã dự phòng hơi rộng** (không gây fail oan cho BE làm đúng chuẩn, nhưng nên biết để siết nếu cần).
  * **2 mã có tình huống trong `Bảng mã lỗi.html` nhưng chưa có test case** (`1006`, `1008`).

---

## 2. Bảng Đối Chiếu Đầy Đủ 19 Mã (`Bảng mã lỗi.html` vs Bộ Test Hiện Tại)

| Mã Code | Hằng số dùng trong Test (`src/config/responseCodes.ts`) | Số lần dùng | Ý nghĩa theo Cột H (`Bảng mã lỗi.html`) | HTTP gợi ý | Trạng thái đối chiếu |
| :---: | :--- | :---: | :--- | :---: | :--- |
| **`1000`** | `OK` | 172 | Thành công: đọc, tạo mới, sửa, xoá | 200 | ✅ Khớp hoàn toàn |
| **`9992`** | `NOT_FOUND` | 39 | Không tìm thấy user, bệnh án, template, section, question, option, ảnh, thông báo, role, permission, branch, khoa, phòng | 404 | ✅ Khớp hoàn toàn |
| **`9993`** | `VERIFY_CODE_INCORRECT` | 1 | OTP sai hoặc hết hạn (`[TC-RESET-01]`) | 400 | ✅ Khớp hoàn toàn |
| **`9994`** | `NO_DATA` | 2 | Chưa đủ điều kiện hoặc chưa có dữ liệu cần thiết (bệnh án chưa active, chưa đủ điều kiện chấm UAS7) | 409 | ℹ️ Xem Ghi chú #2 |
| **`9995`** | `USER_NOT_VALIDATED` | 1 | Sai mật khẩu, sai mật khẩu cũ (`[TC-LOGIN-07]`) | 401 | ℹ️ Xem Ghi chú #2 |
| **`9996`** | `ALREADY_EXISTS` (12) / `USER_EXISTED` (1) | 13 | `phone` đã đăng ký; trùng tên role, permission, branch, khoa, phòng; trùng mã template, `question_id` *(+ `bhyt_so_the` theo `AdditionalTestCaseDesign.md`)* | 409 | ✅ Khớp |
| **`9997`** | `INVALID_METHOD` | 0 | Gọi sai phương thức HTTP *(chưa có case)* | 405 | ✅ Khớp `(chưa có case)` |
| **`9998`** | `INVALID_TOKEN` | 41 | Thiếu token, token sai, hết hạn, đã logout | 401 | ✅ Khớp hoàn toàn |
| **`9999`** | `INTERNAL_ERROR` / `EXCEPTION_ERROR` | 0 | Lỗi hệ thống *(chưa có case)* | 500 | ✅ Khớp `(chưa có case)` |
| **`1001`** | `DB_CONNECTION_ERROR` | 0 | Lỗi DB *(chưa có case)*. Không dùng cho thành công | 500 | ✅ Khớp `(chưa có case)` |
| **`1002`** | `MISSING_PARAMETER` | 34 | Thiếu tham số bắt buộc, danh sách rỗng, **thiếu file**, thiếu tên | 400 | ✅ Khớp hoàn toàn |
| **`1003`** | `INVALID_PARAMETER_TYPE` | 20 | Sai kiểu dữ liệu, JSON sai cú pháp, định dạng file không hỗ trợ | 400 | ✅ Khớp hoàn toàn |
| **`1004`** | `INVALID_PARAMETER_VALUE` | 37 | Sai độ dài, enum, định dạng ngày / phone, ngoài khoảng cho phép, trạng thái không hợp lệ | 400 | ✅ Khớp hoàn toàn |
| **`1005`** | `UNKNOWN_ERROR` | 0 | Lỗi không xác định *(chưa có case)* | 500 | ✅ Khớp `(chưa có case)` |
| **`1006`** | `FILE_TOO_BIG` | **0** | File ảnh vượt 10 MB | 413 | ⚠️ Chưa có test case (Xem Ghi chú #3) |
| **`1007`** | `UPLOAD_FAILED` / `UPLOAD_FILE_FAILED` | 1 | Lỗi kho lưu trữ khi upload | 502 | ℹ️ Xem Ghi chú #2 |
| **`1008`** | `MAX_IMAGES_EXCEEDED` | **0** | Vượt số ảnh tối đa mỗi lần / mỗi câu trả lời | 400 | ⚠️ Chưa có test case (Xem Ghi chú #3) |
| **`1009`** | `PERMISSION_DENIED` (16) / `NOT_ACCESS` (10) | 26 | Sai role, xem dữ liệu người khác, tài khoản bị khoá, vượt giới hạn yêu cầu, **không xoá được do còn phụ thuộc** | 403 | ⚠️ Có 1 case lệch (Xem Ghi chú #1) |
| **`1010`** | `ACTION_ALREADY_DONE` (10) / `ACTION_HAS_BEEN_DONE` (1) | 11 | Đã nhận, đã đóng, đã chấm điểm, ảnh đã gắn / đang được dùng, đã có đơn thuốc | 409 | ✅ Khớp hoàn toàn |

---

## 3. Chi Tiết Các Ghi Chú Cần Lưu Ý

### Ghi chú #1 — ⚠️ 1 Điểm Có Khả Năng Lệch Kịch Bản (`1009` vs `1010` khi Xóa bản ghi còn phụ thuộc)
* **Theo `Bảng mã lỗi.html` (Hàng 19 — Mã `1009`):** Tình huống *"không xoá được do còn phụ thuộc"* được quy định trả về mã **`1009`** (`Not access`, HTTP 403).
* **Trong Test Case hiện tại:**
  * File: `tests/week7_medrec_process_manage/medrec_answers_and_lifecycle.spec.ts` (dòng **1016**)
  * Test Case: `[TC-DELETE-MR-12] Edge Case (Foreign Key / Cascade): Xóa bệnh án đã có dữ liệu answers`
  * Code hiện tại đang kiểm tra: `expect([RESPONSE_CODES.OK, RESPONSE_CODES.ACTION_ALREADY_DONE]).toContain(...)` (tức chỉ nhận **`1000`** hoặc **`1010`**, **chưa chấp nhận `1009`**).
* **Ảnh hưởng:** Nếu nhóm BE làm đúng `Bảng mã lỗi.html` và trả về `1009` khi chặn xóa bệnh án còn dữ liệu con, test `[TC-DELETE-MR-12]` sẽ báo Fail oan.

---

### Ghi chú #2 — ℹ️ 3 Điểm Test Đang Chấp Nhận Mã Dự Phòng Hơi Rộng (Không gây Fail oan)
Các test dưới đây đều **chấp nhận đúng mã chuẩn** theo `Bảng mã lỗi.html`, nhưng có cho thêm 1 mã dự phòng lỏng hơn quy định:

1. **Thiếu file khi upload ảnh (`[TC-IMG-ATT-03]`):**
   * File: `tests/week9_images_uas7/images_uas7.spec.ts` (dòng **152–155**)
   * Hiện tại chấp nhận: `[1002, 1007]`.
   * Theo `Bảng mã lỗi.html`: *"thiếu file"* thuộc chuẩn **`1002`**, còn **`1007`** chỉ dùng cho *"Lỗi kho lưu trữ khi upload (HTTP 502)"*.
2. **Đăng nhập sai mật khẩu (`[TC-LOGIN-07]`):**
   * File: `tests/week1_auth/auth.spec.ts` (dòng **251**)
   * Hiện tại chấp nhận: `[9995, 1004]`.
   * Theo `Bảng mã lỗi.html`: *"Sai mật khẩu"* chuẩn là **`9995`** (HTTP 401).
3. **Danh sách rỗng khi phân trang / lịch sử trống (`[TC-LIST-MR-12]` & `[TC-HISTORY-MR-12]`):**
   * File:
     * `tests/week6_medrec_create_read/medrec_read_and_accept.spec.ts` (dòng **177**)
     * `tests/week7_medrec_process_manage/medrec_answers_and_lifecycle.spec.ts` (dòng **885**)
   * Hiện tại chấp nhận: `[1000, 9994]`.
   * Theo `Bảng mã lỗi.html`: **`9994`** dùng cho tình huống *"Chưa đủ điều kiện hoặc chưa có dữ liệu cần thiết (bệnh án chưa active, chưa đủ điều kiện chấm UAS7)"* (HTTP 409). Nếu BE trả `1000` kèm mảng rỗng `[]` thì test vẫn Pass bình thường.

---

### Ghi chú #3 — ⚠️ 2 Mã Có Trong `Bảng mã lỗi.html` Nhưng Chưa Có Test Case
Trong `Bảng mã lỗi.html`, ngoài 4 mã được đánh dấu sẵn `(chưa có case)` là `9997`, `9999`, `1001`, `1005`, có **2 mã ảnh/upload** chưa có test case kiểm thử trong Tuần 9 (`tests/week9_images_uas7/images_uas7.spec.ts`):
* **`1006` (`File size is too big`, HTTP 413):** Upload file ảnh vượt quá 10 MB.
* **`1008` (`Maximum number of images`, HTTP 400):** Vượt quá số lượng ảnh tối đa trong 1 lần upload (`upload-multiple`) hoặc gắn vào 1 câu trả lời (`answer-images/bulk`).

---

### Ghi chú #4 — Thông Tin Bổ Sung Về Các Tên Hằng Số & HTTP Status
* **Các cặp alias trong `src/config/responseCodes.ts` đều trỏ về đúng cùng 1 mã chuẩn:**
  * `PERMISSION_DENIED` và `NOT_ACCESS` $\rightarrow$ đều là **`"1009"`**
  * `ACTION_ALREADY_DONE` và `ACTION_HAS_BEEN_DONE` $\rightarrow$ đều là **`"1010"`**
  * `ALREADY_EXISTS` và `USER_EXISTED` $\rightarrow$ đều là **`"9996"`**
* **1 chỗ duy nhất kiểm tra HTTP Status thay vì JSON `body.code`:**
  * `tests/week9_images_uas7/images_uas7.spec.ts` (dòng **116**, `[TC-IMG-ATT-01]`): `expect([200, 302]).toContain(viewRes.status)` vì API `GET /api/image-attachments/view/:id` trả về dữ liệu nhị phân ảnh hoặc redirect thay vì gói tin JSON `{ code }`.

---

## 4. Bảng Phân Bố Mã Phản Hồi Theo Từng File Test

| File Test (`D:\doAnWork\tests\`) | Các mã `body.code` đang kiểm tra (kèm số lần) |
| :--- | :--- |
| `week1_auth/auth.spec.ts` | `1000` (11), `1002` (7), `1003` (3), `1004` (7), `1009` (1), `9992` (3), `9993` (1), `9995` (1), `9996` (2), `9998` (2) |
| `week2_users_roles/users_roles.spec.ts` | `1000` (7), `1002` (1), `1004` (1), `1009` (2), `9992` (1), `9996` (1), `9998` (1) |
| `week3_permissions_branches/permissions_branches.spec.ts` | `1000` (12), `1002` (2), `1004` (2), `1009` (2), `9992` (2), `9996` (1) |
| `week4_departments_rooms_templates/departments_rooms_templates.spec.ts` | `1000` (18), `1002` (2), `1003` (1), `1004` (2), `1009` (2), `9992` (2), `9998` (1) |
| `week5_template_details/template_details.spec.ts` | `1000` (8), `1002` (2), `1009` (2), `9992` (2) |
| `week6_medrec_create_read/medrec_classify_and_create.spec.ts` | `1000` (18), `1002` (7), `1003` (4), `1004` (4), `1009` (1), `9992` (3), `9998` (8) |
| `week6_medrec_create_read/medrec_read_and_accept.spec.ts` | `1000` (17), `1003` (4), `1004` (9), `1009` (4), `1010` (3), `9992` (8), `9994` (1), `9998` (9) |
| `week7_medrec_process_manage/medrec_answers_and_lifecycle.spec.ts` | `1000` (22), `1002` (5), `1003` (8), `1004` (8), `1009` (8), `1010` (5), `9992` (13), `9994` (1), `9998` (12) |
| `week8_lesion_episodes_locations/lesion_episodes_locations.spec.ts` | `1000` (9), `1002` (2), `1004` (1), `1009` (1), `9992` (2), `9998` (1) |
| `week9_images_uas7/images_uas7.spec.ts` | `1000` (16), `1002` (3), `1004` (1), `1007` (1), `1009` (1), `1010` (1), `9992` (3) |
| `week10_prescriptions_lab_notifications/prescriptions_lab_notifications.spec.ts` | `1000` (8), `1002` (3), `1004` (1), `1009` (2), `9998` (1) |
| `advanced_scenarios/concurrency_and_token_blacklist.spec.ts` | `1000` (26), `1004` (1), `1010` (2), `9996` (9), `9998` (6) |
