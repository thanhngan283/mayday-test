# Bảng Ánh Xạ 91 API Theo Lịch Trình 10 Tuần (`1. Weekly API.html`)

Tài liệu này ánh xạ chính xác toàn bộ **91 API** từ `D:\doAn\api\1. Weekly API.html` và `D:\doAn\api\2. API da có_DATN.html` sang các bộ kiểm thử tự động trong `D:\doAnWork\tests\`.

---

## Tổng Quan 10 Tuần

| Tuần | Thư Mục Test (`D:\doAnWork\tests\`) | Nhóm Công Việc | Số API | Lệnh Chạy Nhanh |
| :---: | :--- | :--- | :---: | :--- |
| **Tuần 1** | `week1_auth/` | Xác thực & Tài khoản | **6** | `npm run test:week1` |
| **Tuần 2** | `week2_users_roles/` | Người dùng & Phân quyền vai trò | **9** | `npm run test:week2` |
| **Tuần 3** | `week3_permissions_branches/` | Permission & Cơ cấu tổ chức (Branch) | **12** | `npm run test:week3` |
| **Tuần 4** | `week4_departments_rooms_templates/` | Ban, Phòng & Biểu mẫu bệnh án cơ bản | **15** | `npm run test:week4` |
| **Tuần 5** | `week5_template_details/` | Chi tiết biểu mẫu (Section & Question) | **6** | `npm run test:week5` |
| **Tuần 6** | `week6_medrec_create_read/` | Bệnh án – Tạo mới, Phân luồng & Đọc | **7** | `npm run test:week6` |
| **Tuần 7** | `week7_medrec_process_manage/` | Bệnh án – Xử lý câu trả lời & Quản lý vòng đời | **6** | `npm run test:week7` |
| **Tuần 8** | `week8_lesion_episodes_locations/` | Đợt tổn thương & Vị trí tổn thương | **9** | `npm run test:week8` |
| **Tuần 9** | `week9_images_uas7/` | Ảnh tổn thương, Ảnh câu trả lời & Điểm UAS7 | **13** | `npm run test:week9` |
| **Tuần 10** | `week10_prescriptions_lab_notifications/` | Đơn thuốc, Xét nghiệm Lab & Thông báo | **8** | `npm run test:week10` |
| **Tổng** | **10 Thư mục tuần** | **Toàn bộ hệ thống Backend** | **91** | `npm test` |

---

## Chi Tiết Từng Tuần

### Tuần 1: Xác thực & Tài khoản (`tests/week1_auth/auth.spec.ts`) — 6 APIs
1. `signup` (`POST /api/auth/signup`)
2. `login` (`POST /api/auth/login`)
3. `logout` (`POST /api/auth/logout`)
4. `forgot_password` (`POST /api/auth/forgot-password`)
5. `reset_password` (`POST /api/auth/reset-password` / `change-password`)
6. `create_staff` (`POST /api/auth/create-staff`)

### Tuần 2: Người dùng + Phân quyền (`tests/week2_users_roles/users_roles.spec.ts`) — 9 APIs
1. `get_user_info` (`GET /api/profile`)
2. `set_user_info` (`PUT /api/profile`)
3. `set_user` (`POST /api/admin/users`)
4. `get_list_users` (`GET /api/admin/users`)
5. `get_user_detail` (`GET /api/admin/users/:id`)
6. `edit_user` (`PUT /api/admin/users/:id` & `/assign`)
7. `delete_user` (`DELETE /api/admin/users/:id`)
8. `set_role` (`POST /api/roles`)
9. `get_list_roles` (`GET /api/roles`)

### Tuần 3: Permission & Cơ cấu tổ chức (`tests/week3_permissions_branches/permissions_branches.spec.ts`) — 12 APIs
1. `set_permission` (`POST /api/permissions`)
2. `get_list_permissions` (`GET /api/permissions`)
3. `edit_permission` (`PUT /api/permissions/:id`)
4. `delete_permission` (`DELETE /api/permissions/:id`)
5. `set_role_permissions` (`POST /api/roles/:roleId/permissions`)
6. `get_role_permissions` (`GET /api/roles/:roleId/permissions`)
7. `delete_role_permission` (`DELETE /api/roles/:roleId/permissions/:permissionId`)
8. `set_branch` (`POST /api/branches`)
9. `get_list_branches` (`GET /api/branches`)
10. `get_branch_detail` (`GET /api/branches/:id`)
11. `edit_branch` (`PUT /api/branches/:id`)
12. `delete_branch` (`DELETE /api/branches/:id`)

### Tuần 4: Ban, Phòng + Biểu mẫu cơ bản (`tests/week4_departments_rooms_templates/departments_rooms_templates.spec.ts`) — 15 APIs
1. `set_department` (`POST /api/departments`)
2. `get_list_departments` (`GET /api/departments`)
3. `get_department_detail` (`GET /api/departments/:id`)
4. `edit_department` (`PUT /api/departments/:id`)
5. `delete_department` (`DELETE /api/departments/:id`)
6. `set_room` (`POST /api/rooms`)
7. `get_list_rooms` (`GET /api/rooms`)
8. `get_room_detail` (`GET /api/rooms/:id`)
9. `edit_room` (`PUT /api/rooms/:id`)
10. `delete_room` (`DELETE /api/rooms/:id`)
11. `set_template` (`POST /api/templates`)
12. `get_list_templates` (`GET /api/templates`)
13. `get_template_detail` (`GET /api/templates/:id`)
14. `edit_template` (`PUT /api/templates/:id`)
15. `delete_template` (`DELETE /api/templates/:id`)

### Tuần 5: Chi tiết biểu mẫu (`tests/week5_template_details/template_details.spec.ts`) — 6 APIs
1. `set_template_section` (`POST /api/templates/:templateId/sections`)
2. `edit_template_section` (`PUT /api/sections/:id`)
3. `delete_template_section` (`DELETE /api/sections/:id`)
4. `set_template_question` (`POST /api/sections/:sectionId/questions`)
5. `edit_template_question` (`PUT /api/questions/:id`)
6. `delete_template_question` (`DELETE /api/questions/:id`)

### Tuần 6: Bệnh án – Tạo & Đọc (`tests/week6_medrec_create_read/*.spec.ts`) — 7 APIs (Chuyên sâu 12-15 TCs/API)
1. `get_medicalrecords_classifyquestions` (`GET /api/medical_records/classify-questions`)
2. `set_medicalrecords_classify` (`POST /api/medical_records/classify`)
3. `set_medicalrecords_selfcreate` (`POST /api/medical_records` & `POST /api/v1/medical_records`)
4. `get_medicalrecords_all` (`GET /api/medical_records/all`)
5. `get_medicalrecords_id` (`GET /api/medical_records/:id`)
6. `get_medicalrecords_summary` (`GET /api/medical_records/:id/summary`)
7. `set_accept_medicalrecords` (`POST /api/medical_records/:id/accept`)

### Tuần 7: Bệnh án – Xử lý & Quản lý (`tests/week7_medrec_process_manage/medrec_answers_and_lifecycle.spec.ts`) — 6 APIs (Chuyên sâu 12-15 TCs/API)
1. `get_medicalrecords_answers` (`GET /api/medical_records/:id/answers`)
2. `set_medicalrecords_answers` (`POST /api/medical_records/:id/answers` & `PUT /api/medical_records/:id/answers`)
3. `edit_medicalrecords` (`PUT /api/medical_records/:id`)
4. `edit_status_medicalrecords` (`PATCH /api/medical_records/:id/status`)
5. `get_history_medicalrecords` (`GET /api/medical_records/patients/:id/history`)
6. `delete_medicalrecords` (`DELETE /api/medical_records/:id`)

### Tuần 8: Đợt tổn thương & Vị trí (`tests/week8_lesion_episodes_locations/lesion_episodes_locations.spec.ts`) — 9 APIs
1. `create_lesion_episode` (`POST /api/lesion-episodes`)
2. `get_my_lesion_episodes` (`GET /api/lesion-episodes/my`)
3. `edit_lesion_episode` (`PATCH /api/lesion-episodes/:id`)
4. `delete_lesion_episode` (`DELETE /api/lesion-episodes/:id`)
5. `set_lesion_location` (`POST /api/lesion-locations`)
6. `create_lesion_location` (`POST /api/lesion-locations`)
7. `get_lesion_locations_by_episode` (`GET /api/lesion-locations/episode/:episode_id`)
8. `edit_lesion_location` (`PATCH /api/lesion-locations/:id`)
9. `delete_lesion_location` (`DELETE /api/lesion-locations/:id`)

### Tuần 9: Ảnh + UAS7 (`tests/week9_images_uas7/images_uas7.spec.ts`) — 13 APIs
1. `set_lesion_photos` (`POST /api/lesion-photos`)
2. `get_lesion_photos_by_location` (`GET /api/lesion-photos/location/:location_id`)
3. `edit_lesion_photo_milestone` (`PATCH /api/lesion-photos/:id/milestone`)
4. `delete_lesion_photo` (`DELETE /api/lesion-photos/:id`)
5. `set_image_attachments` (`POST /api/image-attachments/upload`)
6. `set_multiple_image_attachments` (`POST /api/image-attachments/upload-multiple`)
7. `get_image_attachments_user` (`GET /api/image-attachments/user/:user_id`)
8. `get_image_attachments_view` (`GET /api/image-attachments/view/:id`)
9. `delete_image_attachments` (`DELETE /api/image-attachments/:id`)
10. `set_answer_image` & `set_multiple_answer_images` (`POST /api/answer-images`, `/bulk`, `GET /:answer_id`, `DELETE /:id`)
11. `get_uas7scores_eligibility` (`GET /api/uas7-scores/eligibility`)
12. `create_uas7scores` (`POST /api/uas7-scores`)
13. `get_uas7scores_week` & `get_uas7scores_patient` (`GET /api/uas7-scores/week/:patientId`, `/patient/:patientId`)

### Tuần 10: Đơn thuốc, Lab, Thông báo (`tests/week10_prescriptions_lab_notifications/prescriptions_lab_notifications.spec.ts`) — 8 APIs
1. `set_prescription` (`POST /api/prescriptions`)
2. `set_lab_request` (`POST /api/lab-requests`)
3. `get_lab_results` (`GET /api/lab-results/:record_id`)
4. `set_devtoken` (`POST /api/notifications/register_token`)
5. `get_notification` (`GET /api/notifications`)
6. `set_read_notification` (`PUT /api/notifications/:id`)
7. `set_read_all_notifications` (`PUT /api/notifications/read-all`)
8. `delete_notification` (`DELETE /api/notifications/:id`)
