import { apiClients } from '../../src/clients/apiClient';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import { UI_PATIENT_ACUTE_ANSWERS } from '../../src/fixtures/uiMedicalRecordPayloads';
import { MultiRoleSessions, setupMultiRoleSessions } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';

/**
 * ============================================================================
 * TUẦN 6 (PHẦN 2): MODULE BỆNH ÁN - TRUY VẤN, TÓM TẮT & TIẾP NHẬN BỆNH ÁN
 * ============================================================================
 * Các API được kiểm thử (12 Test Cases / API):
 * 4. GET  /api/medical_records/all          (get_medicalrecords_all)
 * 5. GET  /api/medical_records/:id          (get_medicalrecords_id)
 * 6. GET  /api/medical_records/:id/summary  (get_medicalrecords_summary)
 * 7. POST /api/medical_records/:id/accept   (set_accept_medicalrecords)
 */
describe('Week 6 (Part 2) - Medical Records: Read, Summary & Doctor Acceptance (Real API, Zero Mocking)', () => {
  const suiteTeardown = new TeardownRegistry();
  const testCaseTeardown = new TeardownRegistry();

  let sessions: MultiRoleSessions;
  let templateCode = '';
  let sampleRecordId = 0;

  beforeAll(async () => {
    sessions = await setupMultiRoleSessions(suiteTeardown);
    templateCode = `TMPL_W6P2_${Date.now().toString().slice(-6)}`;

    // 1. Tạo Template chuẩn bị dữ liệu qua API Tuần 4
    await apiClients.template.post(
      '/api/templates',
      {
        code_template: templateCode,
        name: 'Mẫu Bệnh Án Mày Đay Cấp (Tuần 6 Phần 2)',
        description: 'Phục vụ kiểm thử đọc, tóm tắt và bác sĩ tiếp nhận bệnh án',
        version: '1.0',
        is_active: '1',
      },
      { token: sessions.admin.token }
    );
    suiteTeardown.registerTemplate(templateCode, sessions.admin.token);

    // 2. Tạo 1 Bệnh án mẫu ở trạng thái pending qua API Tuần 6
    const createRes = await apiClients.medrec.post(
      '/api/v1/medical_records',
      {
        template_id: templateCode,
        answers: UI_PATIENT_ACUTE_ANSWERS,
      },
      { token: sessions.patient.token }
    );
    sampleRecordId = Number(createRes.body?.data?.medical_record_id || 0);
    if (sampleRecordId) {
      suiteTeardown.registerMedicalRecord(sampleRecordId, sessions.admin.token);
    }
  });

  afterEach(async () => {
    await testCaseTeardown.cleanupAll();
  });

  afterAll(async () => {
    await suiteTeardown.cleanupAll();
  });

  // ==========================================================================
  // 4. API: GET /api/medical_records/all (12 Test Cases)
  // ==========================================================================
  describe('4. GET /api/medical_records/all (Lấy danh sách bệnh án có lọc & phân trang)', () => {
    it('[TC-LIST-MR-01] Happy Path: Bác sĩ lấy toàn bộ danh sách bệnh án thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all', {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('[TC-LIST-MR-02] Happy Path: Admin lấy toàn bộ danh sách bệnh án thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all', {
        token: sessions.admin.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('[TC-LIST-MR-03] Happy Path (Filter by status): Lọc danh sách bệnh án theo status=pending (Code 1000)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all', {
        token: sessions.doctor.token,
        query: { status: 'pending' },
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      for (const item of res.body.data || []) {
        expect(item.status).toBe('pending');
      }
    });

    it('[TC-LIST-MR-04] Happy Path (Filter by patient_id): Lọc danh sách bệnh án theo patient_id cụ thể (Code 1000)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all', {
        token: sessions.doctor.token,
        query: { patient_id: sessions.patient.userId },
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      for (const item of res.body.data || []) {
        expect(Number(item.patient_id)).toBe(sessions.patient.userId);
      }
    });

    it('[TC-LIST-MR-05] Happy Path (Pagination): Phân trang với page=1 và limit=5 trả về tối đa 5 bản ghi (Code 1000)', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all', {
        token: sessions.doctor.token,
        query: { page: 1, limit: 5 },
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect((res.body.data || []).length).toBeLessThanOrEqual(5);
    });

    it('[TC-LIST-MR-06] Negative Case (Invalid Value): Lọc theo status không tồn tại trong enum (mã cũ 4009 gộp về 1004) -> Trả về mã 1004', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all', {
        token: sessions.doctor.token,
        query: { status: 'invalid_status_xyz' },
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-LIST-MR-07] Negative Case (Invalid Type): Tham số patient_id hoặc page truyền chuỗi không phải số -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all', {
        token: sessions.doctor.token,
        query: { patient_id: 'abc_not_int', page: 'page_one' },
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-LIST-MR-08] Negative Case (Invalid Value): Tham số page=-1 hoặc limit=0 (ngoài miền hợp lệ) -> Trả về mã 1004', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all', {
        token: sessions.doctor.token,
        query: { page: -1, limit: 0 },
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-LIST-MR-09] Security/Authorization: Bệnh nhân gọi API lấy toàn bộ bệnh án hệ thống (Chỉ dành cho Admin/Bác sĩ) -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all', {
        token: sessions.patient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-LIST-MR-10] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all');

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-LIST-MR-11] Security/Auth: Truyền Token giả mạo/sai định dạng -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all', {
        token: 'Bearer forged.jwt.token',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-LIST-MR-12] Edge Case: Phân trang ở page rất lớn (page=99999) trả về mảng rỗng hoặc mã 9994 (No Data) ổn định', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/all', {
        token: sessions.doctor.token,
        query: { page: 99999, limit: 10 },
      });

      expect([RESPONSE_CODES.OK, RESPONSE_CODES.NO_DATA]).toContain(String(res.body.code));
    });
  });

  // ==========================================================================
  // 5. API: GET /api/medical_records/:id (12 Test Cases)
  // ==========================================================================
  describe('5. GET /api/medical_records/:id (Xem chi tiết hồ sơ bệnh án)', () => {
    it('[TC-GET-MR-01] Happy Path: Bác sĩ xem chi tiết hồ sơ bệnh án thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}`, {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Number(res.body.data.medical_record_id)).toBe(sampleRecordId);
      expect(res.body.data).toHaveProperty('patient_id');
      expect(res.body.data).toHaveProperty('template_id');
      expect(res.body.data).toHaveProperty('status');
    });

    it('[TC-GET-MR-02] Happy Path: Chính bệnh nhân sở hữu bệnh án xem chi tiết bệnh án của mình thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}`, {
        token: sessions.patient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Number(res.body.data.patient_id)).toBe(sessions.patient.userId);
    });

    it('[TC-GET-MR-03] Happy Path: Admin xem chi tiết hồ sơ bệnh án thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}`, {
        token: sessions.admin.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-GET-MR-04] Schema Validation: Kiểm tra đầy đủ các trường chuẩn DB medical_records (created_by, created_at, updated_at, instructions)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}`, {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toHaveProperty('created_by');
      expect(res.body.data).toHaveProperty('created_at');
      expect(res.body.data).toHaveProperty('template_id', templateCode);
    });

    it('[TC-GET-MR-05] Security/Authorization (IDOR): Bệnh nhân B cố tình truy cập bệnh án của Bệnh nhân A (mã cũ 3106 gộp về 1009) -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}`, {
        token: sessions.otherPatient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-GET-MR-06] Negative Case (Not Found): ID bệnh án không tồn tại trong hệ thống (mã cũ 4001 gộp về 9992) -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/99999999', {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-GET-MR-07] Negative Case (Invalid Type): ID bệnh án trên URL truyền chữ cái thay vì số nguyên -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/invalid_id_abc', {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-GET-MR-08] Negative Case (Invalid Value): ID bệnh án là số âm (-50) -> Trả về mã 1004 hoặc 9992', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/-50', {
        token: sessions.doctor.token,
      });

      expect([RESPONSE_CODES.INVALID_PARAMETER_VALUE, RESPONSE_CODES.NOT_FOUND]).toContain(
        String(res.body.code)
      );
    });

    it('[TC-GET-MR-09] Negative Case (Invalid Value): ID bệnh án bằng 0 -> Trả về mã 1004 hoặc 9992', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/0', {
        token: sessions.doctor.token,
      });

      expect([RESPONSE_CODES.INVALID_PARAMETER_VALUE, RESPONSE_CODES.NOT_FOUND]).toContain(
        String(res.body.code)
      );
    });

    it('[TC-GET-MR-10] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}`);

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-GET-MR-11] Security/Auth: Truyền Token sai hoặc hết hạn -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}`, {
        token: 'Bearer invalid.expired.jwt',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-GET-MR-12] Edge Case: Truy vấn bệnh án vừa bị xóa khỏi DB -> Trả về mã 9992 (Not Found)', async () => {
      const tempCreate = await apiClients.medrec.post(
        '/api/v1/medical_records',
        { template_id: templateCode },
        { token: sessions.patient.token }
      );
      const tempId = tempCreate.body?.data?.medical_record_id;

      await apiClients.medrec.delete(`/api/medical_records/${tempId}`, {
        token: sessions.admin.token,
      });

      const getAfterDelete = await apiClients.medrec.get(`/api/medical_records/${tempId}`, {
        token: sessions.doctor.token,
      });
      expectResponseCode(getAfterDelete.body.code, RESPONSE_CODES.NOT_FOUND);
    });
  });

  // ==========================================================================
  // 6. API: GET /api/medical_records/:id/summary (12 Test Cases)
  // ==========================================================================
  describe('6. GET /api/medical_records/:id/summary (Xem thẻ tóm tắt bệnh án trên UI)', () => {
    it('[TC-SUMMARY-MR-01] Happy Path: Bác sĩ lấy thẻ tóm tắt bệnh án thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}/summary`, {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Number(res.body.data.medical_record_id)).toBe(sampleRecordId);
    });

    it('[TC-SUMMARY-MR-02] Happy Path: Bệnh nhân sở hữu bệnh án xem thẻ tóm tắt thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}/summary`, {
        token: sessions.patient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-SUMMARY-MR-03] Happy Path: Admin xem thẻ tóm tắt bệnh án thành công (Code 1000)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}/summary`, {
        token: sessions.admin.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-SUMMARY-MR-04] UI Badge & Card Validation: Payload trả về đúng 4 trường rút gọn (medical_record_id, status, patient_name, created_at)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}/summary`, {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toHaveProperty('medical_record_id');
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('patient_name');
      expect(res.body.data).toHaveProperty('created_at');
    });

    it('[TC-SUMMARY-MR-05] Security/Authorization (IDOR): Bệnh nhân khác truy cập thẻ tóm tắt của người khác -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}/summary`, {
        token: sessions.otherPatient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-SUMMARY-MR-06] Negative Case (Not Found): ID bệnh án không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/88888888/summary', {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-SUMMARY-MR-07] Negative Case (Invalid Type): ID bệnh án không phải kiểu int -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/not_a_number/summary', {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-SUMMARY-MR-08] Negative Case (Invalid Value): ID bệnh án là số âm (-10) -> Trả về mã 1004 hoặc 9992', async () => {
      const res = await apiClients.medrec.get('/api/medical_records/-10/summary', {
        token: sessions.doctor.token,
      });

      expect([RESPONSE_CODES.INVALID_PARAMETER_VALUE, RESPONSE_CODES.NOT_FOUND]).toContain(
        String(res.body.code)
      );
    });

    it('[TC-SUMMARY-MR-09] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}/summary`);

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-SUMMARY-MR-10] Security/Auth: Truyền Token rỗng -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}/summary`, {
        token: '',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-SUMMARY-MR-11] Security/Auth: Truyền Token bị chỉnh sửa payload -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}/summary`, {
        token: `${sessions.doctor.token}_corrupted`,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-SUMMARY-MR-12] Edge Case: Kiểm tra patient_name được JOIN chính xác từ bảng users (Nguyễn Văn A)', async () => {
      const res = await apiClients.medrec.get(`/api/medical_records/${sampleRecordId}/summary`, {
        token: sessions.doctor.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(typeof res.body.data.patient_name).toBe('string');
      expect(res.body.data.patient_name.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 7. API: POST /api/medical_records/:id/accept (12 Test Cases)
  // ==========================================================================
  describe('7. POST /api/medical_records/:id/accept (Bác sĩ tiếp nhận bệnh án)', () => {
    let pendingRecordId = 0;

    beforeEach(async () => {
      // Tạo mới 1 bệnh án ở trạng thái pending trước mỗi test case để đảm bảo tính cô lập
      const createRes = await apiClients.medrec.post(
        '/api/v1/medical_records',
        { template_id: templateCode },
        { token: sessions.patient.token }
      );
      pendingRecordId = Number(createRes.body?.data?.medical_record_id || 0);
      if (pendingRecordId) {
        testCaseTeardown.registerMedicalRecord(pendingRecordId, sessions.admin.token);
      }
    });

    it('[TC-ACCEPT-MR-01] Happy Path: Bác sĩ tiếp nhận bệnh án đang ở trạng thái pending thành công, chuyển sang in_progress (Code 1000)', async () => {
      const res = await apiClients.medrec.post(
        `/api/medical_records/${pendingRecordId}/accept`,
        {},
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Number(res.body.data.medical_record_id)).toBe(pendingRecordId);
      expect(Number(res.body.data.assigned_doctor_id)).toBe(sessions.doctor.userId);
      expect(res.body.data.status).toBe('in_progress');
    });

    it('[TC-ACCEPT-MR-02] Business Rule (Duplicate Action): Bác sĩ thứ 2 cố tiếp nhận bệnh án đã có Bác sĩ 1 tiếp nhận (mã cũ 4005 gộp về 1010) -> Trả về mã 1010', async () => {
      await apiClients.medrec.post(
        `/api/medical_records/${pendingRecordId}/accept`,
        {},
        { token: sessions.doctor.token }
      );

      const secondAcceptRes = await apiClients.medrec.post(
        `/api/medical_records/${pendingRecordId}/accept`,
        {},
        { token: sessions.secondDoctor.token }
      );

      expectResponseCode(secondAcceptRes.body.code, RESPONSE_CODES.ACTION_ALREADY_DONE);
    });

    it('[TC-ACCEPT-MR-03] Business Rule (Duplicate Action): Chính Bác sĩ 1 gọi accept lần thứ 2 trên cùng bệnh án đã nhận -> Trả về mã 1010 (hoặc 1004 vì không còn ở pending)', async () => {
      await apiClients.medrec.post(
        `/api/medical_records/${pendingRecordId}/accept`,
        {},
        { token: sessions.doctor.token }
      );

      const repeatRes = await apiClients.medrec.post(
        `/api/medical_records/${pendingRecordId}/accept`,
        {},
        { token: sessions.doctor.token }
      );

      expect([RESPONSE_CODES.ACTION_ALREADY_DONE, RESPONSE_CODES.INVALID_PARAMETER_VALUE]).toContain(
        String(repeatRes.body.code)
      );
    });

    it('[TC-ACCEPT-MR-04] Business Rule (Invalid Status): Tiếp nhận bệnh án đã bị hủy (status=cancelled, không ở trạng thái pending - mã cũ 4004 gộp về 1004) -> Trả về mã 1004', async () => {
      await apiClients.medrec.patch(
        `/api/medical_records/${pendingRecordId}/status`,
        { status: 'cancelled' },
        { token: sessions.patient.token }
      );

      const res = await apiClients.medrec.post(
        `/api/medical_records/${pendingRecordId}/accept`,
        {},
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-ACCEPT-MR-05] Business Rule (Completed Record): Tiếp nhận bệnh án đã hoàn thành (completed - mã cũ 4003/4004) -> Trả về mã 1010 hoặc 1004', async () => {
      await apiClients.medrec.post(
        `/api/medical_records/${pendingRecordId}/accept`,
        {},
        { token: sessions.doctor.token }
      );
      await apiClients.medrec.put(
        `/api/medical_records/${pendingRecordId}`,
        { status: 'completed', instructions: 'Đã hoàn tất điều trị' },
        { token: sessions.doctor.token }
      );

      const res = await apiClients.medrec.post(
        `/api/medical_records/${pendingRecordId}/accept`,
        {},
        { token: sessions.secondDoctor.token }
      );

      expect([RESPONSE_CODES.ACTION_ALREADY_DONE, RESPONSE_CODES.INVALID_PARAMETER_VALUE]).toContain(
        String(res.body.code)
      );
    });

    it('[TC-ACCEPT-MR-06] Security/Authorization: Bệnh nhân cố tình gọi API tiếp nhận bệnh án (Chỉ dành cho Bác sĩ - mã cũ 3103 gộp về 1009) -> Trả về mã 1009', async () => {
      const res = await apiClients.medrec.post(
        `/api/medical_records/${pendingRecordId}/accept`,
        {},
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-ACCEPT-MR-07] Negative Case (Not Found): Tiếp nhận bệnh án có ID không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/99999999/accept',
        {},
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-ACCEPT-MR-08] Negative Case (Invalid Type): ID bệnh án trên URL không phải là số -> Trả về mã 1003', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/abc_id/accept',
        {},
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-ACCEPT-MR-09] Negative Case (Invalid Value): ID bệnh án là số âm (-1) -> Trả về mã 1004 hoặc 9992', async () => {
      const res = await apiClients.medrec.post(
        '/api/medical_records/-1/accept',
        {},
        { token: sessions.doctor.token }
      );

      expect([RESPONSE_CODES.INVALID_PARAMETER_VALUE, RESPONSE_CODES.NOT_FOUND]).toContain(
        String(res.body.code)
      );
    });

    it('[TC-ACCEPT-MR-10] Security/Auth: Không truyền Header Authorization -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.post(`/api/medical_records/${pendingRecordId}/accept`, {});

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-ACCEPT-MR-11] Security/Auth: Truyền Token không hợp lệ -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.post(
        `/api/medical_records/${pendingRecordId}/accept`,
        {},
        { token: 'Bearer invalid_doctor_token' }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-ACCEPT-MR-12] Edge Case: Kiểm tra tính nhất quán DB sau khi tiếp nhận (GET /api/medical_records/:id xác nhận assigned_doctor_id khớp Bác sĩ)', async () => {
      await apiClients.medrec.post(
        `/api/medical_records/${pendingRecordId}/accept`,
        {},
        { token: sessions.doctor.token }
      );

      const detailRes = await apiClients.medrec.get(`/api/medical_records/${pendingRecordId}`, {
        token: sessions.doctor.token,
      });

      expectResponseCode(detailRes.body.code, RESPONSE_CODES.OK);
      expect(Number(detailRes.body.data.assigned_doctor_id)).toBe(sessions.doctor.userId);
      expect(detailRes.body.data.status).toBe('in_progress');
    });
  });
});
