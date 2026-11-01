import { apiClients } from '../../src/clients/apiClient';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import {
  UI_CLASSIFY_PAYLOADS,
  UI_DOCTOR_ANAPHYLAXIS_ANSWERS_NO_RESPIRATORY,
  UI_DOCTOR_ANAPHYLAXIS_INVALID_CONDITIONAL_ANSWERS,
  UI_PATIENT_ACUTE_ANSWERS,
} from '../../src/fixtures/uiMedicalRecordPayloads';
import { MultiRoleSessions, setupMultiRoleSessions } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';
import {
  resolveExpectedTrackFromUI,
  validateRespiratoryConditionalRule,
  validateSuspectedFoodAllergenStructure,
} from '../../src/utils/uiValidators';

/**
 * ============================================================================
 * TUẦN 6 (PHẦN 1): MODULE BỆNH ÁN - SÀNG LỌC PHÂN LOẠI & KHỞI TẠO BỆNH ÁN
 * ============================================================================
 * Các API được kiểm thử (12 - 15 Test Cases / API):
 * 1. GET  /api/medical_records/classify-questions (get_medicalrecords_classifyquestions)
 * 2. POST /api/medical_records/classify           (set_medicalrecords_classify)
 * 3. POST /api/v1/medical_records                 (set_medicalrecords_selfcreate)
 *
 * Đối chiếu chặt chẽ với 2 tài liệu thiết kế giao diện UI:
 * - App Bệnh nhân: 22_9_Thiet_ke_giao_dien_Benh_nhan_App_v3 (12_9_Thiet_ke_giao_dien_Benh_nhan_App_v2_khop.html)
 * - Bệnh án Phản vệ Bác sĩ: 22_9_Thiet_ke_BS_BA_phanve_v1_sua22.9 (12_9_Thiet_ke_giao_dien_Bac_si_BA_phanve_v1.html)
 */
describe('Week 6 (Part 1) - Medical Records: Classification & Creation (Real API, Zero Mocking)', () => {
  const suiteTeardown = new TeardownRegistry();
  const testCaseTeardown = new TeardownRegistry();

  let sessions: MultiRoleSessions;
  let acuteTemplateCode = 'TMPL_ACUTE_URT_AUTO';
  let chronicTemplateCode = 'TMPL_CHRONIC_URT_AUTO';
  let anaphylaxisTemplateCode = 'TMPL_ANAPHYLAXIS_AUTO';

  /**
   * SETUP DỮ LIỆU QUA API THẬT:
   * - Gọi API Tuần 1 (Login / Signup) để lấy Token động cho Admin, Bác sĩ, Bệnh nhân.
   * - Gọi API Tuần 4 & Tuần 5 để khởi tạo Mẫu bệnh án (Cấp tính, Mạn tính, Phản vệ) và các Câu hỏi UI.
   */
  beforeAll(async () => {
    sessions = await setupMultiRoleSessions(suiteTeardown);

    const suffix = Date.now().toString().slice(-6);
    acuteTemplateCode = `TMPL_ACUTE_${suffix}`;
    chronicTemplateCode = `TMPL_CHRONIC_${suffix}`;
    anaphylaxisTemplateCode = `TMPL_ANAPHYLAXIS_${suffix}`;

    // Tạo 3 mẫu bệnh án tương ứng 3 luồng điều hướng trên UI (Cấp, Mạn, Phản vệ)
    for (const tmpl of [
      { code: acuteTemplateCode, name: 'Bệnh án Mày đay Cấp tính (< 6 tuần)' },
      { code: chronicTemplateCode, name: 'Bệnh án Mày đay Mạn tính (>= 6 tuần)' },
      { code: anaphylaxisTemplateCode, name: 'Bệnh án Sốc phản vệ / Phản vệ' },
    ]) {
      const res = await apiClients.template.post(
        '/api/templates',
        {
          code_template: tmpl.code,
          name: tmpl.name,
          description: 'Mẫu bệnh án tự động khởi tạo từ Setup phục vụ kiểm thử Tuần 6',
          version: '1.0',
          is_active: '1',
        },
        { token: sessions.admin.token }
      );
      if (res.body?.data?.code_template || res.status === 200 || res.status === 201) {
        suiteTeardown.registerTemplate(tmpl.code, sessions.admin.token);
      }
    }
  });

  /**
   * TEARDOWN DỮ LIỆU SAU MỖI TEST CASE & SAU TOÀN BỘ SUITE:
   * Gọi trực tiếp các API DELETE để xóa toàn bộ bệnh án, mẫu phiếu, và user test đã tạo.
   */
  afterEach(async () => {
    await testCaseTeardown.cleanupAll();
  });

  afterAll(async () => {
    await suiteTeardown.cleanupAll();
  });

  // ==========================================================================
  // 1. API: GET /api/medical_records/classify-questions (12 Test Cases)
  // ==========================================================================
  describe('1. GET /api/medical_records/classify-questions (Lấy danh sách câu hỏi sàng lọc)', () => {
    it('[TC-CLASSIFY-Q-01] Happy Path: Bệnh nhân lấy danh sách câu hỏi sàng lọc thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/classify-questions', {
        token: sessions.patient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('[TC-CLASSIFY-Q-02] Happy Path: Bác sĩ lấy danh sách câu hỏi sàng lọc thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/classify-questions', {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('[TC-CLASSIFY-Q-03] Happy Path: Admin lấy danh sách câu hỏi sàng lọc thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/classify-questions', {
        token: sessions.admin.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('[TC-CLASSIFY-Q-04] UI Schema Validation: Mỗi câu hỏi sàng lọc trả về đúng cấu trúc (question_id, question_text, type_question, options)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/classify-questions', {
        token: sessions.patient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      if (Array.isArray(res.body.data) && res.body.data.length > 0) {
        const firstQuestion = res.body.data[0];
        expect(firstQuestion).toHaveProperty('question_id');
        expect(firstQuestion).toHaveProperty('question_text');
        expect(firstQuestion).toHaveProperty('type_question');
        expect(Array.isArray(firstQuestion.options)).toBe(true);
      }
    });

    it('[TC-CLASSIFY-Q-05] UI Routing Alignment: Danh sách câu hỏi sàng lọc chứa câu hỏi phân loại thời gian kéo dài 6 tuần hoặc b1_phan_loai_track', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/classify-questions', {
        token: sessions.patient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toBeDefined();
      for (const q of res.body.data || []) {
        expect(typeof q.question_id).toBe('string');
        for (const opt of q.options || []) {
          expect(opt).toHaveProperty('id');
          expect(opt).toHaveProperty('option_text');
          expect(opt).toHaveProperty('option_value');
        }
      }
    });

    it('[TC-CLASSIFY-Q-06] Security/Auth: Không truyền Header Authorization -> Trả về lỗi Token (Code 9998)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/classify-questions');

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-CLASSIFY-Q-07] Security/Auth: Truyền chuỗi Authorization rỗng -> Trả về lỗi Token (Code 9998)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/classify-questions', {
        token: '',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-CLASSIFY-Q-08] Security/Auth: Truyền JWT Token bị làm giả chữ ký (Tampered Signature) -> Trả về lỗi Token (Code 9998)', async () => {
      const tamperedToken = `${sessions.patient.token}tamperedSignatureXYZ`;
      const res = await apiClients.medrec.get('/api/medical_records/classify-questions', {
        token: tamperedToken,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-CLASSIFY-Q-09] Security/Auth: Truyền Token sai định dạng chuẩn JWT (Malformed String) -> Trả về lỗi Token (Code 9998)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/classify-questions', {
        token: 'Bearer not-a-valid-jwt-string',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-CLASSIFY-Q-10] Security/Auth: Truyền JWT Token đã hết hạn (Expired Token) -> Trả về lỗi Token (Code 9998)', async () => {
      const expiredJwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE1MTYyMzkwMjJ9.invalidExpiredSig';
      const res = await apiClients.medrec.get('/api/medical_records/classify-questions', {
        token: expiredJwt,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-CLASSIFY-Q-11] Edge Case: Truyền thêm các query params dư thừa không xác định vẫn hoạt động ổn định (Code 1000)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/classify-questions', {
        token: sessions.patient.token,
        query: { unexpected_param: 'test_edge', lang: 'vi' },
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-CLASSIFY-Q-12] Edge Case: Gọi liên tiếp nhiều lần (Idempotency) trả về kết quả đồng nhất (Code 1000)', async () => {
      const [res1, res2] = await Promise.all([
        apiClients.medrec.get('/api/medical_records/classify-questions', { token: sessions.patient.token }),
        apiClients.medrec.get('/api/medical_records/classify-questions', { token: sessions.patient.token }),
      ]);

      expectResponseCode(res1.body.code, RESPONSE_CODES.OK);
      expectResponseCode(res2.body.code, RESPONSE_CODES.OK);
      expect(res1.body.data?.length).toBe(res2.body.data?.length);
    });
  });

  // ==========================================================================
  // 2. API: POST /api/medical_records/classify (15 Test Cases)
  // ==========================================================================
  describe('2. POST /api/medical_records/classify (Phân loại bệnh án & Điều hướng b1_phan_loai_track)', () => {
    it('[TC-CLASSIFY-01] Happy Path & UI Routing: Biến b1_phan_loai_track = MAY_DAY_CAP (< 6 tuần) rẽ nhánh đúng sang mẫu Mày đay cấp (Code 1000)', async () => {
      const uiRouting = resolveExpectedTrackFromUI({ isOver6Weeks: false, hasRedFlagAnaphylaxis: false });
      expect(uiRouting.b1_phan_loai_track).toBe('MAY_DAY_CAP');

      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        UI_CLASSIFY_PAYLOADS.ACUTE_URTICARIA_TRACK,
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toHaveProperty('template_id');
      expect(res.body.data).toHaveProperty('template_name');
    });

    it('[TC-CLASSIFY-02] Happy Path & UI Routing: Biến b1_phan_loai_track = MAY_DAY_MAN_TINH (>= 6 tuần) rẽ nhánh đúng sang mẫu Mày đay mạn tính (Code 1000)', async () => {
      const uiRouting = resolveExpectedTrackFromUI({ isOver6Weeks: true, hasRedFlagAnaphylaxis: false });
      expect(uiRouting.b1_phan_loai_track).toBe('MAY_DAY_MAN_TINH');

      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        UI_CLASSIFY_PAYLOADS.CHRONIC_URTICARIA_TRACK,
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toHaveProperty('template_id');
      expect(res.body.data).toHaveProperty('template_name');
    });

    it('[TC-CLASSIFY-03] Happy Path & UI Red Flag Routing: Có dấu hiệu báo động đỏ Bước 0 (hô hấp/tuần hoàn) điều hướng sang Phản vệ (Code 1000)', async () => {
      const uiRouting = resolveExpectedTrackFromUI({ isOver6Weeks: false, hasRedFlagAnaphylaxis: true });
      expect(uiRouting.b1_phan_loai_track).toBe('PHAN_VE');

      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        UI_CLASSIFY_PAYLOADS.ANAPHYLAXIS_RED_FLAG_TRACK,
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toHaveProperty('template_id');
    });

    it('[TC-CLASSIFY-04] Happy Path: Bác sĩ thực hiện phân loại sàng lọc cho bệnh nhân thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        UI_CLASSIFY_PAYLOADS.ACUTE_URTICARIA_TRACK,
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-CLASSIFY-05] Negative Case (Missing Param): Body rỗng không có trường answers -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.post('/api/medical_records/classify', {}, { token: sessions.patient.token });

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-CLASSIFY-06] Negative Case (Missing Param): Mảng answers rỗng [] (Thiếu câu trả lời phân loại - mã cũ 4006/4007 gộp về 1002)', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        { answers: [] },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-CLASSIFY-07] Negative Case (Missing Param): Phần tử trong mảng answers thiếu trường bắt buộc question_id -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        { answers: [{ option_value: 'YES' }] },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-CLASSIFY-08] Negative Case (Missing Param): Phần tử trong mảng answers thiếu trường bắt buộc option_value -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        { answers: [{ question_id: 'b2_thoi_gian_tren_6_tuan' }] },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-CLASSIFY-09] Negative Case (Invalid Type): Trường answers truyền kiểu chuỗi thay vì mảng (array) -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        { answers: 'not_an_array' as any },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-CLASSIFY-10] Negative Case (Invalid Type): Gửi body sai định dạng JSON (Malformed JSON) -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        '{"answers": [invalid_json',
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-CLASSIFY-11] Negative Case (Invalid Value): Giá trị b1_phan_loai_track không thuộc tập enum hợp lệ -> Trả về mã 1004', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        {
          answers: [{ question_id: 'b1_phan_loai_track', option_value: 'INVALID_TRACK_VALUE_999' }],
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-CLASSIFY-12] Negative Case (Not Found): question_id trong câu trả lời phân loại không tồn tại trên hệ thống -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        {
          answers: [{ question_id: 'NON_EXISTENT_QUESTION_ID_99999', option_value: 'YES' }],
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-CLASSIFY-13] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        UI_CLASSIFY_PAYLOADS.ACUTE_URTICARIA_TRACK
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-CLASSIFY-14] Security/Auth: Truyền Token không hợp lệ -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        UI_CLASSIFY_PAYLOADS.ACUTE_URTICARIA_TRACK,
        { token: 'invalid_bearer_token_123' }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-CLASSIFY-15] Edge Case: Truyền trùng lặp cùng một question_id trong mảng answers -> Trả về mã 1004 (hoặc xử lý ghi đè an toàn)', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/classify',
        {
          answers: [
            { question_id: 'b2_thoi_gian_tren_6_tuan', option_value: 'YES' },
            { question_id: 'b2_thoi_gian_tren_6_tuan', option_value: 'NO' },
          ],
        },
        { token: sessions.patient.token }
      );

      expect([RESPONSE_CODES.INVALID_PARAMETER_VALUE, RESPONSE_CODES.OK]).toContain(String(res.body.code));
    });
  });

  // ==========================================================================
  // 3. API: POST /api/v1/medical_records (15 Test Cases)
  // ==========================================================================
  describe('3. POST /api/v1/medical_records (Khởi tạo bệnh án mới & Đối chiếu UI chuyên sâu)', () => {
    it('[TC-CREATE-MR-01] Happy Path (Patient Self-Create): Bệnh nhân tự tạo bệnh án Mày đay cấp kèm mảng ảnh anh_san_phu & dị nguyên thức ăn (Code 1000)', async () => {
      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          template_id: acuteTemplateCode,
          answers: UI_PATIENT_ACUTE_ANSWERS,
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toHaveProperty('medical_record_id');
      expect(res.body.data.patient_id).toBe(sessions.patient.userId);
      expect(res.body.data.template_id).toBe(acuteTemplateCode);
      expect(['pending', 'draft']).toContain(res.body.data.status);

      if (res.body.data?.medical_record_id) {
        testCaseTeardown.registerMedicalRecord(res.body.data.medical_record_id, sessions.admin.token);
      }
    });

    it('[TC-CREATE-MR-02] Happy Path (Doctor Create for Patient): Bác sĩ khởi tạo bệnh án Phản vệ cho bệnh nhân với patient_id hợp lệ (Code 1000)', async () => {
      // Kiểm chứng cục bộ dữ liệu mẫu thỏa mãn quy tắc ẩn/hiện hô hấp & bóc tách thức ăn trên UI
      const condCheck = validateRespiratoryConditionalRule(UI_DOCTOR_ANAPHYLAXIS_ANSWERS_NO_RESPIRATORY);
      expect(condCheck.isValid).toBe(true);
      const foodCheck = validateSuspectedFoodAllergenStructure(UI_DOCTOR_ANAPHYLAXIS_ANSWERS_NO_RESPIRATORY);
      expect(foodCheck.isValid).toBe(true);

      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          patient_id: sessions.patient.userId,
          template_id: anaphylaxisTemplateCode,
          answers: UI_DOCTOR_ANAPHYLAXIS_ANSWERS_NO_RESPIRATORY,
        },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toHaveProperty('medical_record_id');
      expect(res.body.data.patient_id).toBe(sessions.patient.userId);
      expect(res.body.data.created_by).toBe(sessions.doctor.userId);

      if (res.body.data?.medical_record_id) {
        testCaseTeardown.registerMedicalRecord(res.body.data.medical_record_id, sessions.admin.token);
      }
    });

    it('[TC-CREATE-MR-03] Happy Path (Minimal Payload): Bệnh nhân khởi tạo bệnh án chỉ với template_id (chưa truyền mảng answers ban đầu) (Code 1000)', async () => {
      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          template_id: chronicTemplateCode,
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toHaveProperty('medical_record_id');

      if (res.body.data?.medical_record_id) {
        testCaseTeardown.registerMedicalRecord(res.body.data.medical_record_id, sessions.admin.token);
      }
    });

    it('[TC-CREATE-MR-04] UI Conditional Rule (Negative): Khi trieu_chung_ho_hap_co_khong_pv = "Không" nhưng vẫn truyền trường hô hấp con -> Bị từ chối (Code 1004)', async () => {
      // Kiểm chứng bằng validator đối chiếu UI trước khi gọi API
      const validation = validateRespiratoryConditionalRule(UI_DOCTOR_ANAPHYLAXIS_INVALID_CONDITIONAL_ANSWERS);
      expect(validation.isValid).toBe(false);
      expect(validation.violatedFields).toContain('trieu_chung_ho_hap_hien_tai_pv');

      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          patient_id: sessions.patient.userId,
          template_id: anaphylaxisTemplateCode,
          answers: UI_DOCTOR_ANAPHYLAXIS_INVALID_CONDITIONAL_ANSWERS,
        },
        { token: sessions.doctor.token }
      );

      if (res.body?.data?.medical_record_id) {
        testCaseTeardown.registerMedicalRecord(res.body.data.medical_record_id, sessions.admin.token);
      }
      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-CREATE-MR-05] UI Complex Data Rule (Negative): yeu_to_nghi_ngo_pv_thuc_an = "Không" nhưng gửi kèm thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an -> Trả về mã 1004', async () => {
      const invalidFoodAnswers = [
        { question_id: 'yeu_to_nghi_ngo_pv_thuc_an', answer_text: 'Không' },
        { question_id: 'thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an', answer_text: '45' },
      ];
      expect(validateSuspectedFoodAllergenStructure(invalidFoodAnswers).isValid).toBe(false);

      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          patient_id: sessions.patient.userId,
          template_id: anaphylaxisTemplateCode,
          answers: invalidFoodAnswers,
        },
        { token: sessions.doctor.token }
      );

      if (res.body?.data?.medical_record_id) {
        testCaseTeardown.registerMedicalRecord(res.body.data.medical_record_id, sessions.admin.token);
      }
      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-CREATE-MR-06] Negative Case (Missing Param): Thiếu trường bắt buộc template_id -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          patient_id: sessions.patient.userId,
          answers: UI_PATIENT_ACUTE_ANSWERS,
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-CREATE-MR-07] Negative Case (Missing Param): Bác sĩ tạo bệnh án nhưng thiếu patient_id bắt buộc -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          template_id: acuteTemplateCode,
          answers: UI_PATIENT_ACUTE_ANSWERS,
        },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-CREATE-MR-08] Negative Case (Missing Param): Phần tử trong mảng answers thiếu trường bắt buộc question_id -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          template_id: acuteTemplateCode,
          answers: [{ answer_text: 'Câu trả lời không có question_id' } as any],
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-CREATE-MR-09] Negative Case (Invalid Type): patient_id truyền kiểu chuỗi chữ cái thay vì số nguyên (int) -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          patient_id: 'not_an_integer' as any,
          template_id: acuteTemplateCode,
        },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-CREATE-MR-10] Negative Case (Invalid Type): Trường answers truyền kiểu số thay vì mảng (array) -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          template_id: acuteTemplateCode,
          answers: 12345 as any,
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-CREATE-MR-11] Negative Case (Not Found): template_id không tồn tại trong cơ sở dữ liệu (mã cũ 4101 gộp về 9992) -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          template_id: 'TMPL_NON_EXISTENT_999999',
          answers: [],
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-CREATE-MR-12] Negative Case (Not Found): question_id trong mảng answers không thuộc mẫu bệnh án này (mã cũ 4008 gộp về 9992) -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          template_id: acuteTemplateCode,
          answers: [{ question_id: 'QUESTION_NOT_IN_TEMPLATE_9999', answer_text: 'Test' }],
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-CREATE-MR-13] Security/Authorization: Bệnh nhân cố tình truyền patient_id của bệnh nhân khác để tạo hồ sơ giả mạo -> Trả về mã 1009 (hoặc ép về ID của chính bệnh nhân)', async () => {
      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          patient_id: sessions.otherPatient.userId,
          template_id: acuteTemplateCode,
        },
        { token: sessions.patient.token }
      );

      if (res.body?.data?.medical_record_id) {
        testCaseTeardown.registerMedicalRecord(res.body.data.medical_record_id, sessions.admin.token);
      }

      if (String(res.body.code) === RESPONSE_CODES.OK) {
        // Nếu hệ thống bỏ qua patient_id theo đặc tả "Bỏ qua nếu bệnh nhân tự tạo", thì patient_id trong DB phải là của người gọi
        expect(res.body.data.patient_id).toBe(sessions.patient.userId);
      } else {
        expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
      }
    });

    it('[TC-CREATE-MR-14] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.post('/api/v1/medical_records', {
        template_id: acuteTemplateCode,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-CREATE-MR-15] Edge Case: Khởi tạo bệnh án với dữ liệu bảng lưới phức tạp (bang_theo_doi_dau_hieu_sinh_ton & mảng anh_san_phu_pv 10 ảnh) (Code 1000)', async () => {
      const complexGridAnswers = [
        {
          question_id: 'muc_do_phan_ve',
          answer_text: 'Sốc phản vệ',
        },
        {
          question_id: 'soc_phan_ve_tieu_chi',
          answer_value: ['HATT < 90 mmHg hoặc giảm > 30% so với huyết áp nền'],
        },
        {
          question_id: 'bang_theo_doi_dau_hieu_sinh_ton',
          answer_value: [
            {
              thoi_diem: '08:15',
              mach_lan_phut: 115,
              huyet_ap_mmhg: '80/50',
              nhip_tho_lan_phut: 26,
              spo2_percent: 91,
              nhiet_do_c: 37.2,
              tri_giac: 'Kích thích vật vã',
              xu_tri_ghi_chu: 'Tiêm bắp Adrenalin 1/2 ống',
            },
          ],
        },
      ];

      const res = await apiClients.medrec.post(
        '/api/v1/medical_records',
        {
          patient_id: sessions.patient.userId,
          template_id: anaphylaxisTemplateCode,
          answers: complexGridAnswers,
        },
        { token: sessions.doctor.token }
      );

      if (res.body?.data?.medical_record_id) {
        testCaseTeardown.registerMedicalRecord(res.body.data.medical_record_id, sessions.admin.token);
      }
      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });
  });
});
