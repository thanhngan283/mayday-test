import { apiClients } from '../../src/clients/apiClient';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import {
  UI_DOCTOR_ANAPHYLAXIS_ANSWERS_NO_RESPIRATORY,
  UI_DOCTOR_ANAPHYLAXIS_INVALID_CONDITIONAL_ANSWERS,
  UI_PATIENT_ACUTE_ANSWERS,
} from '../../src/fixtures/uiMedicalRecordPayloads';
import { MultiRoleSessions, setupMultiRoleSessions } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';
import {
  validateRespiratoryConditionalRule,
  validateSuspectedFoodAllergenStructure,
} from '../../src/utils/uiValidators';

/**
 * ============================================================================
 * TUẦN 7: MODULE BỆNH ÁN - XỬ LÝ CÂU TRẢ LỜI, KẾT LUẬN, LỊCH SỬ & QUẢN LÝ
 * ============================================================================
 * Các API được kiểm thử (12 - 15 Test Cases / API):
 * 1. GET    /api/medical_records/:id/answers          (get_medicalrecords_answers)
 * 2. POST/PUT /api/medical_records/:id/answers        (set_medicalrecords_answers)
 * 3. PUT    /api/medical_records/:id                  (edit_medicalrecords)
 * 4. PATCH  /api/medical_records/:id/status           (edit_status_medicalrecords)
 * 5. GET    /api/medical_records/patients/:id/history (get_history_medicalrecords)
 * 6. DELETE /api/medical_records/:id                  (delete_medicalrecords)
 *
 * Đối chiếu chặt chẽ với Thiết kế Giao diện Bác sĩ - Bệnh án Sốc Phản vệ / Phản vệ:
 * - Biến `trieu_chung_ho_hap_co_khong_pv` = "Không" -> ẩn/cấm gửi các trường hô hấp con.
 * - Biến `yeu_to_nghi_ngo_pv_thuc_an` đi kèm `thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an` & `tien_su_phan_ung_yeu_to_pv_thuc_an`.
 * - Mảng ảnh `anh_san_phu` / `anh_san_phu_pv`.
 * - Ràng buộc DB: UNIQUE(medical_record_id, question_id) khi Upsert câu trả lời.
 */
describe('Week 7 - Medical Records: Answers Upsert, Doctor Conclusion, History & Deletion (Real API)', () => {
  const suiteTeardown = new TeardownRegistry();
  const testCaseTeardown = new TeardownRegistry();

  let sessions: MultiRoleSessions;
  let anaphylaxisTemplateCode = '';
  let activeRecordId = 0;

  beforeAll(async () => {
    sessions = await setupMultiRoleSessions(suiteTeardown);
    anaphylaxisTemplateCode = `TMPL_PV_W7_${Date.now().toString().slice(-6)}`;

    // 1. Tạo Template Bệnh án Phản vệ qua API Tuần 4
    await apiClients.template.post(
      '/api/templates',
      {
        code_template: anaphylaxisTemplateCode,
        name: 'Bệnh án Điều trị Sốc phản vệ / Phản vệ (11.9.2026)',
        description: 'Mẫu bệnh án chuyên môn phục vụ kiểm thử Tuần 7',
        version: '1.0',
        is_active: '1',
      },
      { token: sessions.admin.token }
    );
    suiteTeardown.registerTemplate(anaphylaxisTemplateCode, sessions.admin.token);

    // 2. Tạo 1 Bệnh án mẫu và Bác sĩ chính tiếp nhận (status = in_progress)
    const createRes = await apiClients.medrec.post(
      '/api/v1/medical_records',
      {
        template_id: anaphylaxisTemplateCode,
        answers: UI_PATIENT_ACUTE_ANSWERS,
      },
      { token: sessions.patient.token }
    );
    activeRecordId = Number(createRes.body?.data?.medical_record_id || 0);
    if (activeRecordId) {
      suiteTeardown.registerMedicalRecord(activeRecordId, sessions.admin.token);
      await apiClients.medrec.post(
        `/api/medical_records/${activeRecordId}/accept`,
        {},
        { token: sessions.doctor.token }
      );
    }
  });

  afterEach(async () => {
    await testCaseTeardown.cleanupAll();
  });

  afterAll(async () => {
    await suiteTeardown.cleanupAll();
  });

  // ==========================================================================
  // 1. API: GET /api/medical_records/:id/answers (12 Test Cases)
  // ==========================================================================
  describe('1. GET /api/medical_records/:id/answers (Xem danh sách câu trả lời của bệnh án)', () => {
    it('[TC-GET-ANS-01] Happy Path: Bác sĩ phụ trách lấy danh sách câu trả lời của bệnh án thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${activeRecordId}/answers`, {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('[TC-GET-ANS-02] Happy Path: Bệnh nhân sở hữu bệnh án xem danh sách câu trả lời của mình thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${activeRecordId}/answers`, {
        token: sessions.patient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('[TC-GET-ANS-03] Happy Path: Admin lấy danh sách câu trả lời của bệnh án thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${activeRecordId}/answers`, {
        token: sessions.admin.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-GET-ANS-04] Schema & UI Mapping Validation: Mỗi bản ghi trả lời có đầy đủ id, medical_record_id, question_id, answer_text/answer_value, answered_by', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${activeRecordId}/answers`, {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      for (const ans of res.body.data || []) {
        expect(ans).toHaveProperty('id');
        expect(Number(ans.medical_record_id)).toBe(activeRecordId);
        expect(ans).toHaveProperty('question_id');
        expect(ans).toHaveProperty('answered_by');
      }
    });

    it('[TC-GET-ANS-05] UI Complex Array Check: Kiểm tra câu trả lời anh_san_phu giữ nguyên mảng URL ảnh đã upload', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${activeRecordId}/answers`, {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      const imageAns = (res.body.data || []).find((a: any) => a.question_id === 'anh_san_phu');
      if (imageAns && imageAns.answer_value) {
        expect(Array.isArray(imageAns.answer_value)).toBe(true);
        expect(imageAns.answer_value.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('[TC-GET-ANS-06] Security/Authorization (IDOR): Bệnh nhân B cố tình xem câu trả lời bệnh án của Bệnh nhân A -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${activeRecordId}/answers`, {
        token: sessions.otherPatient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-GET-ANS-07] Negative Case (Not Found): Lấy câu trả lời của ID bệnh án không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/99999999/answers', {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-GET-ANS-08] Negative Case (Invalid Type): ID bệnh án trên URL không phải số nguyên -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/abc_not_int/answers', {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-GET-ANS-09] Negative Case (Invalid Value): ID bệnh án là số âm (-99) -> Trả về mã 1004 hoặc 9992', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/-99/answers', {
        token: sessions.doctor.token,
      });

      expect([RESPONSE_CODES.INVALID_PARAMETER_VALUE, RESPONSE_CODES.NOT_FOUND]).toContain(
        String(res.body.code)
      );
    });

    it('[TC-GET-ANS-10] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${activeRecordId}/answers`);

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-GET-ANS-11] Security/Auth: Truyền Token không hợp lệ -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${activeRecordId}/answers`, {
        token: 'Bearer malformed_token_xyz',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-GET-ANS-12] Edge Case: Bệnh án mới tạo chưa có câu trả lời nào trả về mảng rỗng [] (Code 1000)', async () => {
      const emptyRec = await apiClients.medrec.post(
        '/api/v1/medical_records',
        { template_id: anaphylaxisTemplateCode },
        { token: sessions.patient.token }
      );
      const emptyRecId = emptyRec.body?.data?.medical_record_id;
      if (emptyRecId) {
        testCaseTeardown.registerMedicalRecord(emptyRecId, sessions.admin.token);
      }

      const res = await apiClients.medrec.get(`/api/medical_records/${emptyRecId}/answers`, {
        token: sessions.patient.token,
      });
      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ==========================================================================
  // 2. API: POST & PUT /api/medical_records/:id/answers (15 Test Cases)
  // ==========================================================================
  describe('2. POST & PUT /api/medical_records/:id/answers (Bổ sung & Upsert câu trả lời đối chiếu UI)', () => {
    it('[TC-UPSERT-ANS-01] Happy Path (POST): Bác sĩ bổ sung bộ câu trả lời Phản vệ khi trieu_chung_ho_hap_co_khong_pv = "Không" (Code 1000)', async () => {
      expect(validateRespiratoryConditionalRule(UI_DOCTOR_ANAPHYLAXIS_ANSWERS_NO_RESPIRATORY).isValid).toBe(true);

      const res = await apiClients.medrec.post(
        `/api/medical_records/${activeRecordId}/answers`,
        {
          answers: UI_DOCTOR_ANAPHYLAXIS_ANSWERS_NO_RESPIRATORY,
        },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-UPSERT-ANS-02] Happy Path (PUT Upsert): Ghi đè câu trả lời theo ràng buộc UNIQUE(medical_record_id, question_id) thành công (Code 1000)', async () => {
      const upsertPayload = {
        answers: [
          {
            question_id: 'muc_do_phan_ve',
            answer_text: 'Sốc phản vệ',
          },
          {
            question_id: 'chan_doan_chinh_pv',
            answer_text: 'Sốc phản vệ',
          },
        ],
      };

      const res = await apiClients.medrec.put(
        `/api/medical_records/${activeRecordId}/answers`,
        upsertPayload,
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      const count = res.body?.data?.count ?? res.body?.count;
      expect(Number(count)).toBeGreaterThanOrEqual(1);
    });

    it('[TC-UPSERT-ANS-03] UI Conditional Rule (Positive): Khi trieu_chung_ho_hap_co_khong_pv = "Có", cho phép gửi đầy đủ 3 trường hô hấp con (Code 1000)', async () => {
      const respiratoryPositiveAnswers = [
        {
          question_id: 'trieu_chung_ho_hap_co_khong_pv',
          answer_text: 'Có',
        },
        {
          question_id: 'trieu_chung_ho_hap_hien_tai_pv',
          answer_value: ['Tiếng rít thanh quản', 'Khó thở', 'Nghẹn họng'],
        },
        {
          question_id: 'tien_su_benh_nen_ho_hap_pv',
          answer_value: ['Hen phế quản', 'Viêm mũi dị ứng'],
        },
        {
          question_id: 'dien_bien_ho_hap_pv',
          answer_text: 'Lần thứ 2, Tăng nặng',
        },
      ];

      expect(validateRespiratoryConditionalRule(respiratoryPositiveAnswers).isValid).toBe(true);

      const res = await apiClients.medrec.put(
        `/api/medical_records/${activeRecordId}/answers`,
        { answers: respiratoryPositiveAnswers },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-UPSERT-ANS-04] UI Conditional Rule (Negative): Khi trieu_chung_ho_hap_co_khong_pv = "Không" nhưng vẫn truyền trường hô hấp con -> Trả về mã 1004', async () => {
      const check = validateRespiratoryConditionalRule(UI_DOCTOR_ANAPHYLAXIS_INVALID_CONDITIONAL_ANSWERS);
      expect(check.isValid).toBe(false);

      const res = await apiClients.medrec.put(
        `/api/medical_records/${activeRecordId}/answers`,
        { answers: UI_DOCTOR_ANAPHYLAXIS_INVALID_CONDITIONAL_ANSWERS },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-UPSERT-ANS-05] UI Complex Data Rule (Positive): Cập nhật yeu_to_nghi_ngo_pv_thuc_an = "Có" đi kèm thời gian tiếp xúc (phút) và số lần phản ứng (Code 1000)', async () => {
      const foodAllergenAnswers = [
        {
          question_id: 'yeu_to_nghi_ngo_pv_thuc_an',
          answer_text: 'Có: Tôm hùm và Cua biển',
          answer_value: { status: 'Có', detail: 'Tôm hùm và Cua biển' },
        },
        {
          question_id: 'thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an',
          answer_text: '20',
          answer_value: { value: 20, unit: 'phút' },
        },
        {
          question_id: 'tien_su_phan_ung_yeu_to_pv_thuc_an',
          answer_value: { status: 'Có', so_lan: 3, bieu_hien: 'Phù mạch môi và khó thở nhẹ' },
        },
      ];

      expect(validateSuspectedFoodAllergenStructure(foodAllergenAnswers).isValid).toBe(true);

      const res = await apiClients.medrec.put(
        `/api/medical_records/${activeRecordId}/answers`,
        { answers: foodAllergenAnswers },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-UPSERT-ANS-06] UI Complex Data Rule (Negative): thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an nhận giá trị âm (-15 phút) -> Trả về mã 1004', async () => {
      const negativeTimeAnswers = [
        { question_id: 'yeu_to_nghi_ngo_pv_thuc_an', answer_text: 'Có: Nhộng tằm' },
        { question_id: 'thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an', answer_text: '-15' },
      ];
      expect(validateSuspectedFoodAllergenStructure(negativeTimeAnswers).isValid).toBe(false);

      const res = await apiClients.medrec.put(
        `/api/medical_records/${activeRecordId}/answers`,
        { answers: negativeTimeAnswers },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-UPSERT-ANS-07] Negative Case (Missing Param): Không truyền trường answers trong body -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${activeRecordId}/answers`,
        {},
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-UPSERT-ANS-08] Negative Case (Missing Param): Mảng answers rỗng [] (mã cũ 4007 gộp về 1002) -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${activeRecordId}/answers`,
        { answers: [] },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-UPSERT-ANS-09] Negative Case (Missing Param): Phần tử trong mảng answers thiếu question_id -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${activeRecordId}/answers`,
        { answers: [{ answer_text: 'Thiếu question_id' }] },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-UPSERT-ANS-10] Negative Case (Invalid Type): Trường answers truyền kiểu object thay vì array -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${activeRecordId}/answers`,
        { answers: { question_id: 'muc_do_phan_ve' } as any },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-UPSERT-ANS-11] Negative Case (Not Found): ID bệnh án trên URL không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.put(
        '/api/medical_records/99999999/answers',
        { answers: UI_PATIENT_ACUTE_ANSWERS },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-UPSERT-ANS-12] Negative Case (Not Found): question_id không thuộc mẫu bệnh án này (mã cũ 4008 gộp về 9992) -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${activeRecordId}/answers`,
        { answers: [{ question_id: 'UNKNOWN_QUESTION_99999', answer_text: 'Invalid' }] },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-UPSERT-ANS-13] Security/Authorization: Bác sĩ không phụ trách bệnh án này cố tình sửa câu trả lời (mã cũ 3105 gộp về 1009) -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${activeRecordId}/answers`,
        { answers: [{ question_id: 'muc_do_phan_ve', answer_text: 'Phản vệ' }] },
        { token: sessions.secondDoctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-UPSERT-ANS-14] Business Rule (Completed Record): Không cho phép sửa câu trả lời khi bệnh án đã hoàn thành (mã cũ 4003 gộp về 1010) -> Trả về mã 1010', async () => {
      // Tạo 1 bệnh án riêng, bác sĩ tiếp nhận và hoàn thành
      const tempCreate = await apiClients.medrec.post(
        '/api/v1/medical_records',
        { template_id: anaphylaxisTemplateCode },
        { token: sessions.patient.token }
      );
      const completedRecId = tempCreate.body?.data?.medical_record_id;
      if (completedRecId) {
        testCaseTeardown.registerMedicalRecord(completedRecId, sessions.admin.token);
      }

      await apiClients.medrec.post(
        `/api/medical_records/${completedRecId}/accept`,
        {},
        { token: sessions.doctor.token }
      );
      await apiClients.medrec.put(
        `/api/medical_records/${completedRecId}`,
        { status: 'completed', instructions: 'Đã kết thúc điều trị' },
        { token: sessions.doctor.token }
      );

      const updateAfterComplete = await apiClients.medrec.put(
        `/api/medical_records/${completedRecId}/answers`,
        { answers: [{ question_id: 'muc_do_phan_ve', answer_text: 'Sốc phản vệ' }] },
        { token: sessions.doctor.token }
      );

      expectResponseCode(updateAfterComplete.body.code, RESPONSE_CODES.ACTION_ALREADY_DONE);
    });

    it('[TC-UPSERT-ANS-15] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.put(`/api/medical_records/${activeRecordId}/answers`, {
        answers: UI_PATIENT_ACUTE_ANSWERS,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });
  });

  // ==========================================================================
  // 3. API: PUT /api/medical_records/:id (12 Test Cases)
  // ==========================================================================
  describe('3. PUT /api/medical_records/:id (Bác sĩ đưa ra kết luận instructions & hoàn tất bệnh án)', () => {
    let inProgressRecordId = 0;

    beforeEach(async () => {
      const createRes = await apiClients.medrec.post(
        '/api/v1/medical_records',
        { template_id: anaphylaxisTemplateCode },
        { token: sessions.patient.token }
      );
      inProgressRecordId = Number(createRes.body?.data?.medical_record_id || 0);
      if (inProgressRecordId) {
        testCaseTeardown.registerMedicalRecord(inProgressRecordId, sessions.admin.token);
        await apiClients.medrec.post(
          `/api/medical_records/${inProgressRecordId}/accept`,
          {},
          { token: sessions.doctor.token }
        );
      }
    });

    it('[TC-EDIT-MR-01] Happy Path: Bác sĩ phụ trách cập nhật kết luận (instructions) và chuyển status="completed", tự động gán completed_at (Code 1000)', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${inProgressRecordId}`,
        {
          status: 'completed',
          instructions: 'Theo dõi sát huyết áp, mang sẵn bút tiêm Adrenalin, tái khám sau 7 ngày.',
        },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.instructions).toContain('Adrenalin');
      expect(res.body.data.completed_at).toBeTruthy();
    });

    it('[TC-EDIT-MR-02] Happy Path: Bác sĩ cập nhật ghi chú chỉ dẫn khi bệnh án vẫn đang in_progress (Code 1000)', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${inProgressRecordId}`,
        {
          status: 'in_progress',
          instructions: 'Đang theo dõi sinh tồn mỗi 15 phút tại phòng cấp cứu.',
        },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data.status).toBe('in_progress');
    });

    it('[TC-EDIT-MR-03] Business Rule (Already Completed): Bệnh án đã completed không thể chỉnh sửa lại lần nữa (mã cũ 4003 gộp về 1010) -> Trả về mã 1010', async () => {
      await apiClients.medrec.put(
        `/api/medical_records/${inProgressRecordId}`,
        { status: 'completed', instructions: 'Kết luận lần 1' },
        { token: sessions.doctor.token }
      );

      const secondEdit = await apiClients.medrec.put(
        `/api/medical_records/${inProgressRecordId}`,
        { status: 'in_progress', instructions: 'Cố tình mở lại bệnh án đã hoàn thành' },
        { token: sessions.doctor.token }
      );

      expectResponseCode(secondEdit.body.code, RESPONSE_CODES.ACTION_ALREADY_DONE);
    });

    it('[TC-EDIT-MR-04] Security/Authorization: Bác sĩ không phụ trách bệnh án cố tình cập nhật kết luận (mã cũ 3105 gộp về 1009) -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${inProgressRecordId}`,
        { status: 'completed', instructions: 'Bác sĩ khác can thiệp trái phép' },
        { token: sessions.secondDoctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-EDIT-MR-05] Security/Authorization: Bệnh nhân cố tình gọi API kết luận bệnh án của Bác sĩ (mã cũ 3103 gộp về 1009) -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${inProgressRecordId}`,
        { status: 'completed', instructions: 'Bệnh nhân tự kết luận' },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-EDIT-MR-06] Negative Case (Missing Param): Thiếu trường bắt buộc status trong body -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${inProgressRecordId}`,
        { instructions: 'Chỉ truyền instructions mà thiếu status' },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-EDIT-MR-07] Negative Case (Invalid Value): Truyền status không hợp lệ (mã cũ 4009 gộp về 1004) -> Trả về mã 1004', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${inProgressRecordId}`,
        { status: 'unknown_status_value', instructions: 'Test' },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-EDIT-MR-08] Negative Case (Invalid Type): Trường instructions truyền kiểu mảng/số thay vì string -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${inProgressRecordId}`,
        { status: 'completed', instructions: ['not', 'a', 'string'] as any },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-EDIT-MR-09] Negative Case (Not Found): Cập nhật bệnh án có ID không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.put(
        '/api/medical_records/99999999',
        { status: 'completed', instructions: 'Không tồn tại' },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-EDIT-MR-10] Negative Case (Invalid Type): ID bệnh án trên URL không phải số nguyên -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.put(
        '/api/medical_records/invalid_id',
        { status: 'completed', instructions: 'Test' },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-EDIT-MR-11] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.put(`/api/medical_records/${inProgressRecordId}`, {
        status: 'completed',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-EDIT-MR-12] Security/Auth: Truyền Token hết hạn hoặc sai chữ ký -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.put(
        `/api/medical_records/${inProgressRecordId}`,
        { status: 'completed' },
        { token: 'Bearer invalid.token.signature' }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });
  });

  // ==========================================================================
  // 4. API: PATCH /api/medical_records/:id/status (12 Test Cases)
  // ==========================================================================
  describe('4. PATCH /api/medical_records/:id/status (Thay đổi trạng thái / Hủy bệnh án)', () => {
    let patchRecordId = 0;

    beforeEach(async () => {
      const createRes = await apiClients.medrec.post(
        '/api/v1/medical_records',
        { template_id: anaphylaxisTemplateCode },
        { token: sessions.patient.token }
      );
      patchRecordId = Number(createRes.body?.data?.medical_record_id || 0);
      if (patchRecordId) {
        testCaseTeardown.registerMedicalRecord(patchRecordId, sessions.admin.token);
      }
    });

    it('[TC-STATUS-MR-01] Happy Path: Bệnh nhân hủy bệnh án đang ở trạng thái pending (status="cancelled") thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.patch(
        `/api/medical_records/${patchRecordId}/status`,
        { status: 'cancelled' },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('[TC-STATUS-MR-02] Happy Path: Bác sĩ hoặc Admin cập nhật trạng thái bệnh án thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.patch(
        `/api/medical_records/${patchRecordId}/status`,
        { status: 'cancelled' },
        { token: sessions.admin.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-STATUS-MR-03] Negative Case (Missing Param): Body rỗng không truyền trường status -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.patch(
        `/api/medical_records/${patchRecordId}/status`,
        {},
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-STATUS-MR-04] Negative Case (Invalid Value): Truyền status ngoài danh sách enum cho phép (mã cũ 4009 gộp về 1004) -> Trả về mã 1004', async () => {
      const res = await apiClients.medrec.patch(
        `/api/medical_records/${patchRecordId}/status`,
        { status: 'archived_invalid' },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-STATUS-MR-05] Negative Case (Invalid Type): Trường status truyền kiểu số/boolean thay vì string -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.patch(
        `/api/medical_records/${patchRecordId}/status`,
        { status: 999 as any },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-STATUS-MR-06] Business Rule (Completed Record): Không thể đổi trạng thái bệnh án đã hoàn thành (completed - mã cũ 4003 gộp về 1010) -> Trả về mã 1010', async () => {
      await apiClients.medrec.post(
        `/api/medical_records/${patchRecordId}/accept`,
        {},
        { token: sessions.doctor.token }
      );
      await apiClients.medrec.put(
        `/api/medical_records/${patchRecordId}`,
        { status: 'completed', instructions: 'Hoàn tất' },
        { token: sessions.doctor.token }
      );

      const res = await apiClients.medrec.patch(
        `/api/medical_records/${patchRecordId}/status`,
        { status: 'cancelled' },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.ACTION_ALREADY_DONE);
    });

    it('[TC-STATUS-MR-07] Security/Authorization (IDOR): Bệnh nhân B cố tình hủy bệnh án của Bệnh nhân A -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.patch(
        `/api/medical_records/${patchRecordId}/status`,
        { status: 'cancelled' },
        { token: sessions.otherPatient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-STATUS-MR-08] Negative Case (Not Found): Đổi trạng thái của ID bệnh án không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.patch(
        '/api/medical_records/99999999/status',
        { status: 'cancelled' },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-STATUS-MR-09] Negative Case (Invalid Type): ID bệnh án trên URL không phải số -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.patch(
        '/api/medical_records/not_int/status',
        { status: 'cancelled' },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-STATUS-MR-10] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.patch(`/api/medical_records/${patchRecordId}/status`, {
        status: 'cancelled',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-STATUS-MR-11] Security/Auth: Truyền Token không hợp lệ -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.patch(
        `/api/medical_records/${patchRecordId}/status`,
        { status: 'cancelled' },
        { token: 'Bearer bad_token_value' }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-STATUS-MR-12] Edge Case: Hủy bệnh án đã ở trạng thái cancelled lần 2 -> Trả về mã 1010 (Action has been done previously)', async () => {
      await apiClients.medrec.patch(
        `/api/medical_records/${patchRecordId}/status`,
        { status: 'cancelled' },
        { token: sessions.patient.token }
      );

      const secondCancel = await apiClients.medrec.patch(
        `/api/medical_records/${patchRecordId}/status`,
        { status: 'cancelled' },
        { token: sessions.patient.token }
      );

      expect([RESPONSE_CODES.ACTION_ALREADY_DONE, RESPONSE_CODES.OK]).toContain(
        String(secondCancel.body.code)
      );
    });
  });

  // ==========================================================================
  // 5. API: GET /api/medical_records/patients/:id/history (12 Test Cases)
  // ==========================================================================
  describe('5. GET /api/medical_records/patients/:id/history (Xem lịch sử khám của bệnh nhân)', () => {
    it('[TC-HISTORY-MR-01] Happy Path: Bác sĩ xem lịch sử các phiên khám của bệnh nhân thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(
        `/api/medical_records/patients/${sessions.patient.userId}/history`,
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('[TC-HISTORY-MR-02] Happy Path: Chính bệnh nhân xem lịch sử khám bệnh của bản thân thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(
        `/api/medical_records/patients/${sessions.patient.userId}/history`,
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('[TC-HISTORY-MR-03] Happy Path: Admin xem lịch sử khám của bệnh nhân thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(
        `/api/medical_records/patients/${sessions.patient.userId}/history`,
        { token: sessions.admin.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-HISTORY-MR-04] Schema Validation: Mỗi bản ghi lịch sử chứa medical_record_id, status, instructions, created_at', async () => {
      const res = await apiClients.medrec.get(
        `/api/medical_records/patients/${sessions.patient.userId}/history`,
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      const firstItem = res.body.data?.[0];
      if (firstItem) {
        expect(firstItem).toHaveProperty('medical_record_id');
        expect(firstItem).toHaveProperty('status');
        expect(firstItem).toHaveProperty('created_at');
      }
    });

    it('[TC-HISTORY-MR-05] Security/Authorization (IDOR): Bệnh nhân B xem lịch sử bệnh án của Bệnh nhân A (mã cũ 3106 gộp về 1009) -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.get(
        `/api/medical_records/patients/${sessions.patient.userId}/history`,
        { token: sessions.otherPatient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-HISTORY-MR-06] Negative Case (Not Found): ID bệnh nhân không tồn tại trong hệ thống -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/patients/99999999/history', {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-HISTORY-MR-07] Negative Case (Invalid Type): ID bệnh nhân trên URL không phải kiểu int -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/patients/abc_patient/history', {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-HISTORY-MR-08] Negative Case (Invalid Value): ID bệnh nhân là số âm (-10) -> Trả về mã 1004 hoặc 9992', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/patients/-10/history', {
        token: sessions.doctor.token,
      });

      expect([RESPONSE_CODES.INVALID_PARAMETER_VALUE, RESPONSE_CODES.NOT_FOUND]).toContain(
        String(res.body.code)
      );
    });

    it('[TC-HISTORY-MR-09] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get(
        `/api/medical_records/patients/${sessions.patient.userId}/history`
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-HISTORY-MR-10] Security/Auth: Truyền Token rỗng -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get(
        `/api/medical_records/patients/${sessions.patient.userId}/history`,
        { token: '' }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-HISTORY-MR-11] Security/Auth: Truyền Token giả mạo -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get(
        `/api/medical_records/patients/${sessions.patient.userId}/history`,
        { token: 'Bearer fake.jwt.token' }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-HISTORY-MR-12] Edge Case: Bệnh nhân mới đăng ký chưa từng tạo bệnh án nào trả về mảng rỗng [] hoặc 9994 (No Data)', async () => {
      const res = await apiClients.medrec.get(
        `/api/medical_records/patients/${sessions.otherPatient.userId}/history`,
        { token: sessions.doctor.token }
      );

      expect([RESPONSE_CODES.OK, RESPONSE_CODES.NO_DATA]).toContain(String(res.body.code));
    });
  });

  // ==========================================================================
  // 6. API: DELETE /api/medical_records/:id (12 Test Cases)
  // ==========================================================================
  describe('6. DELETE /api/medical_records/:id (Admin xóa hồ sơ bệnh án)', () => {
    let deletableRecordId = 0;

    beforeEach(async () => {
      const createRes = await apiClients.medrec.post(
        '/api/v1/medical_records',
        { template_id: anaphylaxisTemplateCode },
        { token: sessions.patient.token }
      );
      deletableRecordId = Number(createRes.body?.data?.medical_record_id || 0);
      if (deletableRecordId) {
        testCaseTeardown.registerMedicalRecord(deletableRecordId, sessions.admin.token);
      }
    });

    it('[TC-DELETE-MR-01] Happy Path: Admin xóa hồ sơ bệnh án thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.delete(`/api/medical_records/${deletableRecordId}`, {
        token: sessions.admin.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-DELETE-MR-02] DB State Verification: Sau khi xóa thành công, gọi GET /api/medical_records/:id trả về mã 9992 (Not Found)', async () => {
      await apiClients.medrec.delete(`/api/medical_records/${deletableRecordId}`, {
        token: sessions.admin.token,
      });

      const getRes = await apiClients.medrec.get(`/api/medical_records/${deletableRecordId}`, {
        token: sessions.admin.token,
      });

      expectResponseCode(getRes.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-DELETE-MR-03] Negative Case (Double Delete): Xóa lại chính bệnh án vừa xóa -> Trả về mã 9992 (Not Found)', async () => {
      await apiClients.medrec.delete(`/api/medical_records/${deletableRecordId}`, {
        token: sessions.admin.token,
      });

      const secondDelete = await apiClients.medrec.delete(`/api/medical_records/${deletableRecordId}`, {
        token: sessions.admin.token,
      });

      expectResponseCode(secondDelete.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-DELETE-MR-04] Security/Authorization: Bệnh nhân cố tình gọi API DELETE bệnh án (Chỉ dành cho Admin - mã cũ 3102 gộp về 1009) -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.delete(`/api/medical_records/${deletableRecordId}`, {
        token: sessions.patient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-DELETE-MR-05] Security/Authorization: Bác sĩ cố tình gọi API DELETE bệnh án (Chỉ dành cho Admin - mã cũ 3102 gộp về 1009) -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.delete(`/api/medical_records/${deletableRecordId}`, {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-DELETE-MR-06] Negative Case (Not Found): Xóa bệnh án có ID không tồn tại (99999999) -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.delete('/api/medical_records/99999999', {
        token: sessions.admin.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-DELETE-MR-07] Negative Case (Invalid Type): ID bệnh án trên URL truyền chuỗi không phải số -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.delete('/api/medical_records/invalid_id_xyz', {
        token: sessions.admin.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-DELETE-MR-08] Negative Case (Invalid Value): ID bệnh án là số âm (-100) -> Trả về mã 1004 hoặc 9992', async () => {
      const res = await apiClients.medrec.delete('/api/medical_records/-100', {
        token: sessions.admin.token,
      });

      expect([RESPONSE_CODES.INVALID_PARAMETER_VALUE, RESPONSE_CODES.NOT_FOUND]).toContain(
        String(res.body.code)
      );
    });

    it('[TC-DELETE-MR-09] Negative Case (Invalid Value): ID bệnh án bằng 0 -> Trả về mã 1004 hoặc 9992', async () => {
      const res = await apiClients.medrec.delete('/api/medical_records/0', {
        token: sessions.admin.token,
      });

      expect([RESPONSE_CODES.INVALID_PARAMETER_VALUE, RESPONSE_CODES.NOT_FOUND]).toContain(
        String(res.body.code)
      );
    });

    it('[TC-DELETE-MR-10] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.delete(`/api/medical_records/${deletableRecordId}`);

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-DELETE-MR-11] Security/Auth: Truyền Token giả mạo -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.delete(`/api/medical_records/${deletableRecordId}`, {
        token: 'Bearer forged_admin_token',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-DELETE-MR-12] Edge Case (Foreign Key / Cascade): Xóa bệnh án đã có dữ liệu answers trong bảng answers (Kiểm tra CASCADE hoặc RESTRICT 1010/1000)', async () => {
      await apiClients.medrec.put(
        `/api/medical_records/${deletableRecordId}/answers`,
        { answers: UI_PATIENT_ACUTE_ANSWERS },
        { token: sessions.patient.token }
      );

      const res = await apiClients.medrec.delete(`/api/medical_records/${deletableRecordId}`, {
        token: sessions.admin.token,
      });

      expect([RESPONSE_CODES.OK, RESPONSE_CODES.ACTION_ALREADY_DONE]).toContain(String(res.body.code));
    });
  });
});
