# Ma Trận Thiết Kế Test Case & Đối Chiếu Giao Diện (UI Cross-Referencing Matrix)

Tài liệu này tổng hợp các quy tắc thiết kế kịch bản kiểm thử chuyên sâu trong `D:\doAnWork` dựa trên việc đối chiếu 3 nguồn tài liệu gốc tại `D:\doAn`:
1. Giao diện Bác sĩ Bệnh án Phản vệ (`12_9_Thiet_ke_giao_dien_Bac_si_BA_phanve_v1.html`)
2. Giao diện App Bệnh nhân v2 (`12_9_Thiet_ke_giao_dien_Benh_nhan_App_v2_khop.html`)
3. Bảng gộp mã phản hồi (`3. response code.html`)

---

## 1. Đối Chiếu Logic Phân Luồng Bệnh Án (Routing / Classification Logic)

| Điều Kiện Đầu Vào Trên Giao Diện (`b1_trieu_chung`, `b1_thoi_gian_keo_dai`) | Giá Trị Kỳ Vọng (`b1_phan_loai_track` / `b2_phan_loai_track`) | Mã Test Case Điển Hình |
| :--- | :---: | :--- |
| Có bất kỳ triệu chứng cờ đỏ (Red Flag): Khó thở, thở rít, khàn tiếng, phù lưỡi/họng, tụt huyết áp, choáng/ngất, đau quặn bụng/nôn liên tục sau tiếp xúc dị nguyên | **`PHAN_VE`** | `[TC-MEDREC-CLS-03]`, `[TC-MEDREC-CLS-04]`, `[TC-MEDREC-CREATE-03]` |
| Chỉ có sẩn phù / phù mạch đơn thuần, thời gian kéo dài **$< 6$ tuần** (`"< 6 tuần"`) | **`MAY_DAY_CAP`** | `[TC-MEDREC-CLS-01]`, `[TC-MEDREC-CREATE-01]` |
| Chỉ có sẩn phù / phù mạch đơn thuần, thời gian kéo dài **$\ge 6$ tuần** (`">= 6 tuần"`) | **`MAY_DAY_MAN_TINH`** (kích hoạt bảng điểm **UAS7**) | `[TC-MEDREC-CLS-02]`, `[TC-MEDREC-CREATE-02]`, `[TC-UAS7-01..07]` |
| Bệnh nhân khai báo `< 6 tuần` nhưng cố tình ép `b1_phan_loai_track = "MAY_DAY_MAN_TINH"` (Mâu thuẫn logic phân luồng) | Mã lỗi **`1004`** (hoặc Backend tự động ghi đè về `MAY_DAY_CAP`) | `[TC-MEDREC-CLS-08]`, `[TC-MEDREC-CREATE-08]` |

---

## 2. Đối Chiếu Ràng Buộc Ẩn/Hiện Có Điều Kiện (Conditional Visibility Logic)

Trên giao diện Bệnh án Phản vệ của Bác sĩ (`Phần 3.2 — Hô hấp`), nhóm câu hỏi hô hấp tuân thủ quan hệ Cha - Con:

| Trường Cha (`trieu_chung_ho_hap_co_khong_pv`) | Trạng Thái Các Trường Con (`trieu_chung_ho_hap_hien_tai_pv`, `tien_su_benh_nen_ho_hap_pv`, `dien_bien_ho_hap_pv`) | Kịch Bản Kiểm Thử Tự Động |
| :---: | :--- | :--- |
| **`"Có"`** | Hiển thị trên UI. Cho phép chọn mảng triệu chứng (`["Khó thở", "Thở rít", "Khò khè"]`), tiền sử bệnh nền (`["Hen phế quản"]`) và diễn biến. | `[TC-MEDREC-CREATE-04]`, `[TC-MEDREC-ANS-04]` (Trả về mã **`1000`**) |
| **`"Không"`** | **Ẩn hoàn toàn trên UI**. Payload chuẩn bắt buộc để trống/không gửi các trường con này. | `[TC-MEDREC-CREATE-05]`, `[TC-MEDREC-ANS-05]` (Trả về mã **`1000`**) |
| **`"Không"`** *(Cố tình gửi kèm dữ liệu trường con)* | Vi phạm ràng buộc Conditional Visibility giữa trường cha và trường con. | `[TC-MEDREC-CREATE-09]`, `[TC-MEDREC-ANS-10]` (Trả về mã **`1004`** hoặc Backend tự động làm sạch trường con) |

---

## 3. Đối Chiếu Trường Phức Hợp & Mảng Đính Kèm (Complex Fields & Arrays)

| Nhóm Dữ Liệu Trên Giao Diện | Các Trường Liên Kết Trong Payload | Kịch Bản Kiểm Thử Tự Động |
| :--- | :--- | :--- |
| **Phần II — Dị nguyên nghi ngờ (Thức ăn)** | - `yeu_to_nghi_ngo_pv_thuc_an` (Array/String)<br>- `thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an` (`15` phút)<br>- `tien_su_phan_ung_yeu_to_pv_thuc_an` | `[TC-MEDREC-CREATE-03]`, `[TC-MEDREC-ANS-04]`, `[TC-MEDREC-ANS-06]` |
| **Phần 3.1 / Bước 3 — Ảnh chụp tổn thương thực tế** | - `anh_san_phu` (Mảng URL ảnh cho Bệnh nhân)<br>- `anh_san_phu_pv` (Mảng URL ảnh cho Bệnh án Phản vệ) | `[TC-MEDREC-CREATE-04]`, `[TC-MEDREC-ANS-07]`, `[TC-IMG-ATT-02]`, `[TC-ANS-IMG-01]` |
| **Phần IV — Sinh hiệu & Chỉ số nhân trắc** | - `can_nang_pv` ($0 < W \le 300\text{ kg}$), `chieu_cao_pv` ($0 < H \le 250\text{ cm}$), `bmi_pv`<br>- `mach_pv`, `huyet_ap_tam_thu_pv`, `huyet_ap_tam_truong_pv`, `nhip_tho_pv`, `spo2_pv` ($0 \le \text{SpO}_2 \le 100\%$) | `[TC-MEDREC-ANS-09]`, `[TC-MEDREC-ANS-11]`, `[TC-MEDREC-ANS-15]` |
| **Phần V — Phân độ Phản vệ Sampson** | - `do_nang_phan_ve_pv` $\in \{\text{"Độ I"}, \text{"Độ II"}, \text{"Độ III"}, \text{"Độ IV"}\}$ | `[TC-MEDREC-ANS-12]`, `[TC-MEDREC-EDIT-01]` |

---

## 4. Phân Bổ 4 Nhóm Kịch Bản Trên Mỗi API Chính (10–15 Test Cases / API)

Mỗi API trọng tâm trong hệ thống đều được bao phủ đầy đủ 4 nhóm kịch bản:
1. **Happy Path (`Code 1000`)**: Dữ liệu hợp lệ theo đúng luồng nghiệp vụ Bác sĩ / Bệnh nhân / Điều dưỡng / Admin.
2. **Negative Cases (`Code 1002, 1003, 1004, 9992, 1010, 9996`)**:
   - Bỏ trống các trường bắt buộc (`1002`).
   - Truyền sai kiểu dữ liệu như chuỗi vào số/mảng (`1003`).
   - Truyền giá trị ngoài miền hợp lệ hoặc vi phạm điều kiện ẩn/hiện UI (`1004`).
   - Truy vấn ID không tồn tại (`9992`) hoặc lặp lại hành động một chiều (`1010`).
3. **Security / Authorization (`Code 9998, 1009`)**:
   - Không truyền Token, truyền Token sai định dạng hoặc đã đăng xuất (`9998`).
   - Kiểm thử phân quyền chéo (RBAC): Bệnh nhân gọi API của Bác sĩ/Admin (`1009`).
   - Kiểm thử IDOR (Insecure Direct Object Reference): Bệnh nhân B truy cập/sửa bệnh án của Bệnh nhân A (`1009` / `9992`).
4. **Edge Cases (`Code 1000` / `1004`)**:
   - Giá trị biên số học (SpO2 = 100%, thời gian khởi phát = 1 phút, UAS7 = 0 hoặc 42).
   - Chuỗi ký tự tiếng Việt dài, ký hiệu y khoa đặc biệt (`≥`, `≤`, `°C`, `µg/min`, `IU/mL`).
   - Kiểm thử khả năng chống SQL Injection / XSS payload trên các trường tìm kiếm và ghi chú lâm sàng.
