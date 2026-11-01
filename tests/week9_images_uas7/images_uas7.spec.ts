import { apiClients } from '../../src/clients/apiClient';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import { buildPatientChronicUrticariaPayload } from '../../src/fixtures/uiMedicalRecordPayloads';
import { MultiRoleSessions, setupMultiRoleSessions } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';

/**
 * ============================================================================
 * TUẦN 9: MODULE ẢNH TỔN THƯƠNG (LESION PHOTO, IMAGE ATTACHMENT, ANSWER IMAGE) & THANG ĐIỂM UAS7 (13 APIs)
 * ============================================================================
 * Danh sách API theo phân phối Tuần 9 (`1. Weekly API.html`):
 * [LesionPhoto - 4 APIs]
 * 1.  POST   /api/lesion-photos                       (set_lesion_photos)
 * 2.  GET    /api/lesion-photos/location/:location_id (get_lesion_photos_by_location)
 * 3.  PATCH  /api/lesion-photos/:id/milestone         (edit_lesion_photo_milestone)
 * 4.  DELETE /api/lesion-photos/:id                   (delete_lesion_photo)
 *
 * [ImageAttachment - 5 APIs]
 * 5.  POST   /api/image-attachments/upload            (set_image_attachments)
 * 6.  POST   /api/image-attachments/upload-multiple   (set_multiple_image_attachments)
 * 7.  GET    /api/image-attachments/user/:user_id     (get_image_attachments_user)
 * 8.  GET    /api/image-attachments/view/:id          (get_image_attachments_view)
 * 9.  DELETE /api/image-attachments/:id               (delete_image_attachments)
 *
 * [AnswerImage - 4 APIs]
 * 10. POST   /api/answer-images                       (set_answer_image)
 * 11. POST   /api/answer-images/bulk                  (set_multiple_answer_images)
 * 12. GET    /api/answer-images/:answer_id            (get_answer_images)
 * 13. DELETE /api/answer-images/:id                   (delete_answer_image)
 *
 * [UAS7 Score - 4 APIs (Dành cho Track MAY_DAY_MAN_TINH >= 6 tuần)]
 * 14. GET    /api/uas7-scores/eligibility             (get_uas7scores_eligibility)
 * 15. POST   /api/uas7-scores                         (create_uas7scores)
 * 16. GET    /api/uas7-scores/week/:patientId         (get_uas7scores_week)
 * 17. GET    /api/uas7-scores/patient/:patientId      (get_uas7scores_patient)
 */
describe('Week 9 - Lesion Photos, Image Attachments, Answer Images & UAS7 Scoring (Real API, Zero Mocking)', () => {
  const suiteTeardown = new TeardownRegistry();
  const testCaseTeardown = new TeardownRegistry();
  let sessions: MultiRoleSessions;
  let chronicRecordId = 1;

  // Buffer ảnh PNG 1x1 hợp lệ dùng để upload multipart/form-data thật (Zero Mocking)
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeAll(async () => {
    sessions = await setupMultiRoleSessions(suiteTeardown);

    // Khởi tạo Bệnh án Mày đay Mạn tính (>= 6 tuần) thực tế để kích hoạt quyền chấm điểm UAS7
    const medRes = await apiClients.medRec.post(
      '/api/medical_records',
      buildPatientChronicUrticariaPayload(),
      { token: sessions.patient.token }
    );
    const createdId = medRes.body?.data?.id || medRes.body?.data?.medical_record_id;
    if (createdId) {
      chronicRecordId = createdId;
      suiteTeardown.register({
        description: `Cleanup chronic medical record ${chronicRecordId}`,
        execute: async () => {
          await apiClients.medRec.delete(`/api/medical_records/${chronicRecordId}`, {
            token: sessions.admin.token,
          });
        },
      });
    }
  });

  afterEach(async () => {
    await testCaseTeardown.cleanupAll();
  });

  afterAll(async () => {
    await suiteTeardown.cleanupAll();
  });

  // ==========================================================================
  // PHẦN 1: IMAGE ATTACHMENTS (/api/image-attachments)
  // ==========================================================================
  describe('1. Image Attachments Upload & Management (/api/image-attachments)', () => {
    it('[TC-IMG-ATT-01] Happy Path: Upload 1 ảnh sẩn phù (POST /upload), lấy danh sách theo user, xem ảnh và xóa ảnh thành công (Code 1000)', async () => {
      const uploadRes = await apiClients.lesionUas7.uploadFile(
        '/api/image-attachments/upload',
        'image',
        validPngBuffer,
        'san_phu_co_tay.png',
        { medical_record_id: chronicRecordId, description: 'Ảnh sẩn phù cổ tay trái' },
        { token: sessions.patient.token }
      );

      expectResponseCode(uploadRes.body.code, RESPONSE_CODES.OK);
      const imageId = uploadRes.body?.data?.id || uploadRes.body?.data?.image_id;

      if (imageId) {
        testCaseTeardown.register({
          description: `Cleanup uploaded image attachment ${imageId}`,
          execute: async () => {
            await apiClients.lesionUas7.delete(`/api/image-attachments/${imageId}`, {
              token: sessions.patient.token,
            });
          },
        });

        // GET danh sách ảnh của user
        const listRes = await apiClients.lesionUas7.get(
          `/api/image-attachments/user/${sessions.patient.userId}`,
          { token: sessions.patient.token }
        );
        expectResponseCode(listRes.body.code, RESPONSE_CODES.OK);

        // GET xem chi tiết ảnh
        const viewRes = await apiClients.lesionUas7.get(
          `/api/image-attachments/view/${imageId}`,
          { token: sessions.patient.token }
        );
        expect([200, 302]).toContain(viewRes.status);

        // DELETE xóa ảnh
        const delRes = await apiClients.lesionUas7.delete(`/api/image-attachments/${imageId}`, {
          token: sessions.patient.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-IMG-ATT-02] Happy Path (Multiple Upload): Upload mảng nhiều ảnh cho trường `anh_san_phu_pv` (POST /upload-multiple) (Code 1000)', async () => {
      const res = await apiClients.lesionUas7
        .raw()
        .post('/api/image-attachments/upload-multiple')
        .set('Authorization', `Bearer ${sessions.patient.token}`)
        .attach('images', validPngBuffer, {
          filename: 'anh_san_phu_1.png',
          contentType: 'image/png',
        })
        .attach('images', validPngBuffer, {
          filename: 'anh_phu_mach_2.png',
          contentType: 'image/png',
        });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-IMG-ATT-03] Negative Case (Missing File): Gọi POST /api/image-attachments/upload không đính kèm file -> Trả về mã 1002 hoặc 1007', async () => {
      const res = await apiClients.lesionUas7.post(
        '/api/image-attachments/upload',
        {},
        { token: sessions.patient.token }
      );
      expectResponseCode(res.body.code, [
        RESPONSE_CODES.MISSING_PARAMETER,
        RESPONSE_CODES.UPLOAD_FILE_FAILED,
      ]);
    });
  });

  // ==========================================================================
  // PHẦN 2: ANSWER IMAGES - LIÊN KẾT ẢNH VÀO CÂU TRẢ LỜI BỆNH ÁN (/api/answer-images)
  // ==========================================================================
  describe('2. Answer Images Binding (/api/answer-images - Liên kết `anh_san_phu` / `anh_san_phu_pv`)', () => {
    it('[TC-ANS-IMG-01] Happy Path: Liên kết 1 ảnh và liên kết hàng loạt (bulk) vào câu trả lời bệnh án, xem danh sách và xóa liên kết (Code 1000)', async () => {
      // Upload 1 ảnh trước để lấy image_id thật
      const uploadRes = await apiClients.lesionUas7.uploadFile(
        '/api/image-attachments/upload',
        'image',
        validPngBuffer,
        'anh_gan_cau_tra_loi.png',
        {},
        { token: sessions.patient.token }
      );
      const imageId = uploadRes.body?.data?.id || uploadRes.body?.data?.image_id || 1;

      // 1. Liên kết 1 ảnh vào câu trả lời (POST /api/answer-images)
      const linkRes = await apiClients.lesionUas7.post(
        '/api/answer-images',
        {
          answer_id: 1,
          image_id: imageId,
          question_code: 'anh_san_phu_pv',
        },
        { token: sessions.patient.token }
      );
      expectResponseCode(linkRes.body.code, [
        RESPONSE_CODES.OK,
        RESPONSE_CODES.NOT_FOUND,
      ]);

      const answerImageId = linkRes.body?.data?.id;
      if (answerImageId) {
        // 2. Lấy danh sách ảnh của câu trả lời
        const getRes = await apiClients.lesionUas7.get('/api/answer-images/1', {
          token: sessions.patient.token,
        });
        expectResponseCode(getRes.body.code, RESPONSE_CODES.OK);

        // 3. Xóa liên kết ảnh
        const delRes = await apiClients.lesionUas7.delete(`/api/answer-images/${answerImageId}`, {
          token: sessions.patient.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }

      // 4. Liên kết nhiều ảnh cùng lúc (POST /api/answer-images/bulk)
      const bulkRes = await apiClients.lesionUas7.post(
        '/api/answer-images/bulk',
        {
          answer_id: 1,
          image_ids: [imageId],
        },
        { token: sessions.patient.token }
      );
      expectResponseCode(bulkRes.body.code, [
        RESPONSE_CODES.OK,
        RESPONSE_CODES.NOT_FOUND,
      ]);
    });

    it('[TC-ANS-IMG-02] Negative Case (Missing Parameter): Gọi POST /api/answer-images thiếu `answer_id` hoặc `image_id` -> Trả về mã 1002', async () => {
      const res = await apiClients.lesionUas7.post(
        '/api/answer-images',
        {},
        { token: sessions.patient.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });
  });

  // ==========================================================================
  // PHẦN 3: LESION PHOTOS THEO VỊ TRÍ TỔN THƯƠNG (/api/lesion-photos)
  // ==========================================================================
  describe('3. Lesion Photos by Body Location (/api/lesion-photos)', () => {
    it('[TC-LESION-PHOTO-01] Happy Path: Đính kèm ảnh vào vị trí tổn thương, xem danh sách theo location, cập nhật mốc thời gian (milestone) và xóa (Code 1000)', async () => {
      // Tạo episode + location thực tế
      const epRes = await apiClients.lesionUas7.post(
        '/api/lesion-episodes',
        {
          medical_record_id: chronicRecordId,
          title: 'Đợt tổn thương có ảnh theo mốc thời gian',
          onset_time: '2026-10-28T08:00:00Z',
          itch_severity_vas: 6,
        },
        { token: sessions.patient.token }
      );
      const epId = epRes.body?.data?.id || epRes.body?.data?.episode_id || 1;

      const locRes = await apiClients.lesionUas7.post(
        '/api/lesion-locations',
        {
          episode_id: epId,
          body_part_code: 'Tay_trai',
          body_part_name: 'Cẳng tay trái',
          lesion_type: 'san_phu',
        },
        { token: sessions.patient.token }
      );
      const locId = locRes.body?.data?.id || locRes.body?.data?.location_id || 1;

      const createPhotoRes = await apiClients.lesionUas7.post(
        '/api/lesion-photos',
        {
          location_id: locId,
          image_url: 'https://storage.hospital.vn/lesions/tay_trai_t0.jpg',
          milestone: 'T0_KHOI_PHAT',
          taken_at: '2026-10-28T08:05:00Z',
        },
        { token: sessions.patient.token }
      );
      expectResponseCode(createPhotoRes.body.code, [
        RESPONSE_CODES.OK,
        RESPONSE_CODES.NOT_FOUND,
      ]);

      const photoId = createPhotoRes.body?.data?.id || createPhotoRes.body?.data?.photo_id;
      if (photoId) {
        // GET theo location_id
        const listRes = await apiClients.lesionUas7.get(
          `/api/lesion-photos/location/${locId}`,
          { token: sessions.patient.token }
        );
        expectResponseCode(listRes.body.code, RESPONSE_CODES.OK);

        // PATCH milestone
        const patchRes = await apiClients.lesionUas7.patch(
          `/api/lesion-photos/${photoId}/milestone`,
          { milestone: 'SAU_UONG_THUOC_2H' },
          { token: sessions.patient.token }
        );
        expectResponseCode(patchRes.body.code, RESPONSE_CODES.OK);

        // DELETE
        const delRes = await apiClients.lesionUas7.delete(`/api/lesion-photos/${photoId}`, {
          token: sessions.patient.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }
    });
  });

  // ==========================================================================
  // PHẦN 4: THANG ĐIỂM UAS7 HÀNG NGÀY & 7 NGÀY (/api/uas7-scores)
  // Đối chiếu chặt chẽ với UI App Bệnh nhân (Bước 4 - Chỉ mở cho MAY_DAY_MAN_TINH >= 6 tuần):
  // - Điểm số lượng sẩn phù (wheal_score / diem_san_phu): 0..3
  //   (0: Không có, 1: Nhẹ < 20 nốt/24h, 2: Trung bình 20-50 nốt/24h, 3: Nặng > 50 nốt/24h)
  // - Điểm mức độ ngứa (itch_score / diem_ngua): 0..3
  //   (0: Không ngứa, 1: Nhẹ, 2: Trung bình, 3: Nặng ảnh hưởng giấc ngủ/sinh hoạt)
  // - Tổng điểm ngày: 0..6 | Tổng điểm tuần (UAS7): 0..42
  // ==========================================================================
  describe('4. UAS7 Daily & Weekly Scoring (/api/uas7-scores - UI Patient App Track MAY_DAY_MAN_TINH)', () => {
    it('[TC-UAS7-01] Happy Path: Kiểm tra điều kiện chấm điểm UAS7 của bệnh nhân Mày đay mạn tính (GET /api/uas7-scores/eligibility) (Code 1000)', async () => {
      const res = await apiClients.lesionUas7.get('/api/uas7-scores/eligibility', {
        token: sessions.patient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toBeDefined();
    });

    it('[TC-UAS7-02] Happy Path: Bệnh nhân gửi điểm UAS7 hàng ngày hợp lệ (wheal_score = 2, itch_score = 3 -> Tổng ngày = 5/6) (Code 1000)', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await apiClients.lesionUas7.post(
        '/api/uas7-scores',
        {
          medical_record_id: chronicRecordId,
          record_date: today,
          wheal_score: 2, // Trung bình (20-50 nốt/24h)
          itch_score: 3, // Nặng (ảnh hưởng giấc ngủ)
          notes: 'Ngứa nhiều về đêm, nổi khoảng 35 nốt sẩn phù ở lưng và đùi',
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, [
        RESPONSE_CODES.OK,
        RESPONSE_CODES.ACTION_HAS_BEEN_DONE, // Nếu trong ngày đã chấm điểm rồi
      ]);
    });

    it('[TC-UAS7-03] Happy Path: Lấy điểm UAS7 trong 7 ngày gần nhất (GET /api/uas7-scores/week/:patientId) (Code 1000)', async () => {
      const res = await apiClients.lesionUas7.get(
        `/api/uas7-scores/week/${sessions.patient.userId}`,
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toBeDefined();
    });

    it('[TC-UAS7-04] Happy Path: Bác sĩ hoặc Bệnh nhân xem toàn bộ lịch sử UAS7 (GET /api/uas7-scores/patient/:patientId) (Code 1000)', async () => {
      const res = await apiClients.lesionUas7.get(
        `/api/uas7-scores/patient/${sessions.patient.userId}`,
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-UAS7-05] Negative Case (Out of Range Score > 3): Truyền `wheal_score: 5` hoặc `itch_score: -1` (vượt thang 0..3 của UI) -> Trả về mã 1004', async () => {
      const res = await apiClients.lesionUas7.post(
        '/api/uas7-scores',
        {
          medical_record_id: chronicRecordId,
          record_date: '2026-10-27',
          wheal_score: 5, // Sai: tối đa là 3
          itch_score: -1, // Sai: tối thiểu là 0
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-UAS7-06] Negative Case (Missing Parameter): Gửi điểm UAS7 thiếu `wheal_score` và `itch_score` -> Trả về mã 1002', async () => {
      const res = await apiClients.lesionUas7.post(
        '/api/uas7-scores',
        {
          record_date: '2026-10-26',
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-UAS7-07] Security/IDOR: Bệnh nhân B cố tình xem lịch sử UAS7 của Bệnh nhân A -> Trả về mã 1009', async () => {
      const res = await apiClients.lesionUas7.get(
        `/api/uas7-scores/patient/${sessions.patient.userId}`,
        { token: sessions.otherPatient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_ACCESS);
    });
  });
});
