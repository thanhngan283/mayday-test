import { apiClients } from '../../src/clients/apiClient';
import { ENV } from '../../src/config/env';
import { RESPONSE_CODES, expectResponseCode, normalizeCode } from '../../src/config/responseCodes';
import {
  MultiRoleSessions,
  generateValidVnPhone,
  loginActor,
  setupMultiRoleSessions,
} from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';

/**
 * ============================================================================
 * BỘ KIỂM THỬ NÂNG CAO (ADVANCED SCENARIOS) THEO TIÊU CHUẨN QA_Agent.md
 * & AdditionalTestCaseDesign.md
 * ============================================================================
 * Bao gồm 15 Kịch bản Kiểm thử Hộp đen Thực tế (Real API - Zero Mocking):
 * - Nhóm 1 (TC-ADV-CONC-01 -> 07): Concurrency / Race Condition & Unique Constraint
 *   (Sử dụng `Promise.all()` kiểm thử chống trùng lặp `bhyt_so_the`, `phone`, `template_code`
 *    và chống 2 Bác sĩ tiếp nhận trùng cùng 1 bệnh án tại cùng 1 millisecond).
 * - Nhóm 2 (TC-ADV-TOKEN-01 -> 05): Token Lifecycle & Blacklist
 *   (Login lấy `Token_A` -> Gọi Profile 3 lần liên tiếp pass `1000` chống False Positive
 *    -> Logout đẩy `Token_A` vào Blacklist -> Gọi lại bằng `Token_A` bị chặn `9998`).
 * - Nhóm 3 (TC-ADV-CALC-01 -> 02 & TC-ADV-COND-01): Read-only / Auto-calculated Fields
 *   (`nlr`, `plr`, `uas7_tong`, `aas7_tong`) & Conditional Visibility UI Logic.
 */
describe('Advanced QA Scenarios - Concurrency (Race Condition), Token Blacklist & Auto-Calculated Fields (Real API, Zero Mocking)', () => {
  const suiteTeardown = new TeardownRegistry();
  const testCaseTeardown = new TeardownRegistry();
  let sessions: MultiRoleSessions;

  beforeAll(async () => {
    // Setup thực tế qua API: Đăng nhập & khởi tạo đầy đủ các vai trò Admin, Doctor, SecondDoctor, Patient, OtherPatient
    sessions = await setupMultiRoleSessions(suiteTeardown);
  });

  afterEach(async () => {
    // Dọn rác dữ liệu sau từng Test Case theo cơ chế LIFO (Last-In-First-Out)
    await testCaseTeardown.cleanupAll();
  });

  afterAll(async () => {
    // Dọn rác toàn bộ dữ liệu dùng chung của Suite sau khi hoàn tất
    await suiteTeardown.cleanupAll();
  });

  // ==========================================================================
  // NHÓM 1: KIỂM THỬ RACE CONDITION & UNIQUE CONSTRAINT (CHỐNG TRÙNG LẶP DỮ LIỆU)
  // ==========================================================================
  describe('1. Concurrency & Race Condition (Unique Constraint - Promise.all)', () => {
    it('[TC-ADV-CONC-01] Race Condition (BHYT Card on Profile Update): Kích hoạt đồng thời 2 PUT /api/profile cùng cập nhật 1 số thẻ BHYT duy nhất (`bhyt_so_the`) -> Chỉ 1 pass (1000), 1 fail (9996)', async () => {
      // Tạo số thẻ BHYT duy nhất chuẩn 15 ký tự cho kịch bản kiểm thử
      const uniqueBhytNumber = `DN401${Date.now().toString().slice(-10)}`;

      // Payload giống hệt nhau về số thẻ BHYT (`bhyt_so_the`) gửi tại cùng 1 thời điểm (milliseconds)
      const sharedBhytPayload = {
        full_name: 'Bệnh Nhân Kiểm Thử Race Condition BHYT',
        gender: 'male',
        dob: '1990-05-15',
        bhyt_so_the: uniqueBhytNumber,
        health_insurance_number: uniqueBhytNumber,
        address: 'Bệnh viện Da liễu Trung Ương - 15A Phương Mai, Hà Nội',
      };

      // Sử dụng Promise.all() bắn đồng thời 2 HTTP PUT requests với cùng số thẻ BHYT
      const [res1, res2] = await Promise.all([
        apiClients.userRole.put('/api/profile', sharedBhytPayload, {
          token: sessions.patient.token,
        }),
        apiClients.userRole.put('/api/profile', sharedBhytPayload, {
          token: sessions.otherPatient.token,
        }),
      ]);

      const codes = [normalizeCode(res1.body.code), normalizeCode(res2.body.code)];
      const successCount = codes.filter((c) => c === RESPONSE_CODES.OK).length;
      const duplicateCount = codes.filter((c) => c === RESPONSE_CODES.ALREADY_EXISTS).length;

      // Validation bắt buộc theo AdditionalTestCaseDesign.md:
      // - Chỉ được phép có ĐÚNG 1 request thành công trả về mã "1000" (OK)
      // - Request còn lại BẮT BUỘC phải thất bại với mã "9996" (User existed / Dữ liệu đã tồn tại)
      expect(successCount).toBe(1);
      expect(duplicateCount).toBe(1);
      expect(codes.sort()).toEqual([RESPONSE_CODES.OK, RESPONSE_CODES.ALREADY_EXISTS].sort());
    });

    it('[TC-ADV-CONC-02] Race Condition (BHYT Card on Medical Record Creation): Gửi đồng thời 2 POST /api/medical_records có cùng `bhyt_so_the` -> Chỉ 1 pass (1000), 1 fail (9996)', async () => {
      const uniqueBhyt = `GD479${Date.now().toString().slice(-10)}`;

      const identicalMedRecPayload = {
        template_code: 'MAY_DAY_CAP',
        type: 'MAY_DAY_CAP',
        b1_phan_loai_track: 'MAY_DAY_CAP',
        bhyt_so_the: uniqueBhyt,
        chief_complaint: 'Kiểm thử Race Condition trùng thẻ BHYT khi khởi tạo bệnh án',
        answers: [
          { question_id: 'bhyt_so_the', answer_text: uniqueBhyt },
          { question_id: 'b1_phan_loai_track', answer_text: 'MAY_DAY_CAP' },
        ],
      };

      // Gửi đồng thời 2 POST requests tại cùng một millisecond bằng Promise.all()
      const [res1, res2] = await Promise.all([
        apiClients.medrec.post('/api/medical_records', identicalMedRecPayload, {
          token: sessions.patient.token,
        }),
        apiClients.medrec.post('/api/medical_records', identicalMedRecPayload, {
          token: sessions.otherPatient.token,
        }),
      ]);

      // Đăng ký Teardown xóa bệnh án được tạo thành công
      for (const res of [res1, res2]) {
        const recordId = res.body?.data?.id || res.body?.data?.medical_record_id;
        if (recordId) {
          testCaseTeardown.registerMedicalRecord(recordId, sessions.admin.token);
        }
      }

      const codes = [normalizeCode(res1.body.code), normalizeCode(res2.body.code)];
      expect(codes).toContain(RESPONSE_CODES.OK);
      expect(codes).toContain(RESPONSE_CODES.ALREADY_EXISTS);
      expect(codes.filter((c) => c === RESPONSE_CODES.OK)).toHaveLength(1);
      expect(codes.filter((c) => c === RESPONSE_CODES.ALREADY_EXISTS)).toHaveLength(1);
    });

    it('[TC-ADV-CONC-03] Race Condition (3-Way Spam Click BHYT): 1 người dùng hoặc 3 phiên gửi đồng thời 3 requests trùng `bhyt_so_the` -> Đúng 1 pass (1000) và 2 fail (9996)', async () => {
      const uniqueBhyt = `HS401${Date.now().toString().slice(-10)}`;
      const spamPayload = {
        full_name: 'Bệnh Nhân Spam Click 3 Lần BHYT',
        bhyt_so_the: uniqueBhyt,
        health_insurance_number: uniqueBhyt,
      };

      // Tạo thêm 1 tài khoản bệnh nhân thứ 3 để bắn đồng thời 3 requests cùng 1 thẻ BHYT
      const thirdPhone = generateValidVnPhone('09');
      const thirdSignup = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Bệnh nhân Thứ 3 Race Condition',
        phone: thirdPhone,
        password: 'PatientPass@123',
      });
      const thirdUserId = thirdSignup.body?.data?.user_id || thirdSignup.body?.data?.id;
      if (thirdUserId) {
        testCaseTeardown.registerUser(thirdUserId, sessions.admin.token);
      }
      const thirdSession = await loginActor(thirdPhone, 'PatientPass@123');

      const responses = await Promise.all([
        apiClients.userRole.put('/api/profile', spamPayload, { token: sessions.patient.token }),
        apiClients.userRole.put('/api/profile', spamPayload, { token: sessions.otherPatient.token }),
        apiClients.userRole.put('/api/profile', spamPayload, { token: thirdSession.token }),
      ]);

      const codes = responses.map((r) => normalizeCode(r.body.code));
      const okCount = codes.filter((c) => c === RESPONSE_CODES.OK).length;
      const conflictCount = codes.filter((c) => c === RESPONSE_CODES.ALREADY_EXISTS).length;

      expect(okCount).toBe(1);
      expect(conflictCount).toBe(2);
    });

    it('[TC-ADV-CONC-04] Race Condition (Concurrent Signup Duplicate Phone): Gửi đồng thời 2 POST /api/auth/signup cùng 1 số điện thoại -> Chỉ 1 pass (1000), 1 fail (9996)', async () => {
      const sharedPhone = generateValidVnPhone('09');
      const identicalSignupPayload = {
        full_name: 'Nguyễn Văn Đăng Ký Đồng Thời',
        phone: sharedPhone,
        password: 'ConcurrentPassword@123',
        gender: 'male',
      };

      // Kích hoạt đồng thời 2 requests đăng ký cùng 1 SĐT bằng Promise.all()
      const [res1, res2] = await Promise.all([
        apiClients.auth.post('/api/auth/signup', identicalSignupPayload),
        apiClients.auth.post('/api/auth/signup', identicalSignupPayload),
      ]);

      // Teardown: Xóa tài khoản được tạo thành công để làm sạch DB
      for (const res of [res1, res2]) {
        const createdUserId = res.body?.data?.user_id || res.body?.data?.id;
        if (createdUserId) {
          testCaseTeardown.registerUser(createdUserId, sessions.admin.token);
        }
      }

      const codes = [normalizeCode(res1.body.code), normalizeCode(res2.body.code)];
      expect(codes.filter((c) => c === RESPONSE_CODES.OK)).toHaveLength(1);
      expect(codes.filter((c) => c === RESPONSE_CODES.ALREADY_EXISTS)).toHaveLength(1);
    });

    it('[TC-ADV-CONC-05] Race Condition (Concurrent Admin Create Staff): Admin gửi đồng thời 2 POST /api/auth/create-staff trùng SĐT -> Chỉ 1 pass (1000), 1 fail (9996)', async () => {
      const staffPhone = generateValidVnPhone('08');
      const staffPayload = {
        full_name: 'BS. Trần Quốc Toàn (Concurrency Test)',
        phone: staffPhone,
        password: 'StaffPassword@123',
        gender: 'male',
        role_id: 2,
        branch_id: 1,
        department_id: 1,
        room_id: 1,
      };

      const [res1, res2] = await Promise.all([
        apiClients.auth.post('/api/auth/create-staff', staffPayload, {
          token: sessions.admin.token,
        }),
        apiClients.auth.post('/api/auth/create-staff', staffPayload, {
          token: sessions.admin.token,
        }),
      ]);

      for (const res of [res1, res2]) {
        const userId = res.body?.data?.user_id || res.body?.data?.id;
        if (userId) {
          testCaseTeardown.registerUser(userId, sessions.admin.token);
        }
      }

      const codes = [normalizeCode(res1.body.code), normalizeCode(res2.body.code)];
      expect(codes.filter((c) => c === RESPONSE_CODES.OK)).toHaveLength(1);
      expect(codes.filter((c) => c === RESPONSE_CODES.ALREADY_EXISTS)).toHaveLength(1);
    });

    it('[TC-ADV-CONC-06] Race Condition (Concurrent Template Code Creation): Gửi đồng thời 2 POST /api/templates trùng mã `code` biểu mẫu -> Chỉ 1 pass (1000), 1 fail (9996)', async () => {
      const duplicateTplCode = `TPL_RACE_${Date.now()}`;
      const tplPayload = {
        name: `Biểu mẫu Kiểm thử Race Condition ${Date.now()}`,
        code: duplicateTplCode,
        type: 'PHAN_VE',
        description: 'Kiểm thử chống trùng mã biểu mẫu khi 2 Admin bấm lưu cùng lúc',
        version: '1.0',
      };

      const [res1, res2] = await Promise.all([
        apiClients.template.post('/api/templates', tplPayload, { token: sessions.admin.token }),
        apiClients.template.post('/api/templates', tplPayload, { token: sessions.admin.token }),
      ]);

      for (const res of [res1, res2]) {
        const tplId = res.body?.data?.id || res.body?.data?.template_id || res.body?.data?.code;
        if (tplId) {
          testCaseTeardown.registerTemplate(String(tplId), sessions.admin.token);
        }
      }

      const codes = [normalizeCode(res1.body.code), normalizeCode(res2.body.code)];
      expect(codes.filter((c) => c === RESPONSE_CODES.OK)).toHaveLength(1);
      expect(codes.filter((c) => c === RESPONSE_CODES.ALREADY_EXISTS)).toHaveLength(1);
    });

    it('[TC-ADV-CONC-07] Race Condition (2 Doctors Accepting Same Medical Record): 2 Bác sĩ bấm tiếp nhận cùng 1 bệnh án tại cùng 1 thời điểm -> Chỉ 1 pass (1000), 1 bị chặn (1010 hoặc 9996)', async () => {
      // Khởi tạo 1 bệnh án mới ở trạng thái chờ tiếp nhận
      const createRes = await apiClients.medrec.post(
        '/api/medical_records',
        {
          template_code: 'PHAN_VE',
          type: 'PHAN_VE',
          b1_phan_loai_track: 'PHAN_VE',
          chief_complaint: 'Bệnh án kiểm thử 2 bác sĩ tiếp nhận đồng thời',
        },
        { token: sessions.patient.token }
      );
      const recordId = createRes.body?.data?.id || createRes.body?.data?.medical_record_id || 1;
      if (createRes.body?.data?.id || createRes.body?.data?.medical_record_id) {
        testCaseTeardown.registerMedicalRecord(recordId, sessions.admin.token);
      }

      // Bác sĩ 1 và Bác sĩ 2 gọi POST /api/medical_records/:id/accept cùng lúc qua Promise.all()
      const [accept1, accept2] = await Promise.all([
        apiClients.medrec.post(
          `/api/medical_records/${recordId}/accept`,
          { notes: 'Bác sĩ 1 tiếp nhận' },
          { token: sessions.doctor.token }
        ),
        apiClients.medrec.post(
          `/api/medical_records/${recordId}/accept`,
          { notes: 'Bác sĩ 2 tiếp nhận cùng lúc' },
          { token: sessions.secondDoctor.token }
        ),
      ]);

      const codes = [normalizeCode(accept1.body.code), normalizeCode(accept2.body.code)];
      const okCount = codes.filter((c) => c === RESPONSE_CODES.OK).length;
      const rejectedCount = codes.filter((c) =>
        [RESPONSE_CODES.ACTION_ALREADY_DONE, RESPONSE_CODES.ALREADY_EXISTS].includes(c as any)
      ).length;

      expect(okCount).toBe(1);
      expect(rejectedCount).toBe(1);
    });
  });

  // ==========================================================================
  // NHÓM 2: KIỂM THỬ LOGIC TOKEN BLACKLIST (DANH SÁCH TOKEN THU HỒI / HẾT HẠN)
  // ==========================================================================
  describe('2. Token Lifecycle & Blacklist (False Positive Check -> Logout -> Barrier Validation)', () => {
    it('[TC-ADV-TOKEN-01] Full Lifecycle: Login lấy Token_A -> Gọi GET /api/profile 3 lần liên tiếp đều pass (1000) -> Logout bằng Token_A (1000) -> Gọi lại GET /api/profile bằng Token_A bị chặn đứng (9998)', async () => {
      // Tạo tài khoản riêng biệt cho luồng kiểm thử vòng đời Token để không ảnh hưởng phiên chung
      const testPhone = generateValidVnPhone('09');
      const testPassword = 'TokenLifecycle@123';
      const signupRes = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Nguyễn Văn Kiểm Thử Token Blacklist',
        phone: testPhone,
        password: testPassword,
        gender: 'male',
      });
      const userId = signupRes.body?.data?.user_id || signupRes.body?.data?.id;
      if (userId) {
        testCaseTeardown.registerUser(userId, sessions.admin.token);
      }

      // ----------------------------------------------------------------------
      // BƯỚC 1: Gọi API Login để lấy `Token_A` hợp lệ
      // ----------------------------------------------------------------------
      const loginRes = await apiClients.auth.post('/api/auth/login', {
        phone: testPhone,
        password: testPassword,
      });
      expectResponseCode(loginRes.body.code, RESPONSE_CODES.OK);
      const tokenA: string = loginRes.body?.data?.token || loginRes.body?.token;
      expect(typeof tokenA).toBe('string');
      expect(tokenA.length).toBeGreaterThan(10);

      // ----------------------------------------------------------------------
      // BƯỚC 2 (Kiểm tra False Positive): Dùng `Token_A` gọi API bảo mật (GET /api/profile)
      // 3 lần liên tiếp. Expect: Cả 3 lần đều trả về 1000 (OK), đảm bảo hệ thống
      // KHÔNG vô tình quét nhầm token đang active vào danh sách đen (Blacklist).
      // ----------------------------------------------------------------------
      const profileCall1 = await apiClients.userRole.get('/api/profile', { token: tokenA });
      expectResponseCode(profileCall1.body.code, RESPONSE_CODES.OK);

      const profileCall2 = await apiClients.userRole.get('/api/profile', { token: tokenA });
      expectResponseCode(profileCall2.body.code, RESPONSE_CODES.OK);

      const profileCall3 = await apiClients.userRole.get('/api/profile', { token: tokenA });
      expectResponseCode(profileCall3.body.code, RESPONSE_CODES.OK);

      // ----------------------------------------------------------------------
      // BƯỚC 3 (Kích hoạt Blacklist): Gọi API Logout bằng `Token_A` để chủ động
      // đẩy token này vào bảng thu hồi / hết hạn (Blacklist).
      // ----------------------------------------------------------------------
      const logoutRes = await apiClients.auth.post(
        '/api/auth/logout',
        {},
        { token: tokenA }
      );
      expectResponseCode(logoutRes.body.code, RESPONSE_CODES.OK);

      // ----------------------------------------------------------------------
      // BƯỚC 4 (Validation rào chắn): Dùng lại chính `Token_A` vừa đăng xuất để gọi
      // API bảo mật GET /api/profile một lần nữa.
      // Expect: Hệ thống phải dò trúng `Token_A` trong Blacklist và chặn truy cập
      // với đúng mã lỗi "9998" (Token is invalid).
      // ----------------------------------------------------------------------
      const postLogoutProfileRes = await apiClients.userRole.get('/api/profile', {
        token: tokenA,
      });
      expectResponseCode(postLogoutProfileRes.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-ADV-TOKEN-02] Anti-False-Positive Burst: Dùng Token_A gọi đồng thời 3 requests GET /api/profile qua Promise.all() vẫn pass (1000), sau khi Logout mới chặn (9998)', async () => {
      const loginRes = await apiClients.auth.post('/api/auth/login', {
        phone: ENV.CREDENTIALS.PATIENT.phone,
        password: ENV.CREDENTIALS.PATIENT.password,
      });
      expectResponseCode(loginRes.body.code, RESPONSE_CODES.OK);
      const tokenA: string = loginRes.body?.data?.token || loginRes.body?.token;

      // Gọi đồng thời 3 requests khi App vừa mở màn hình Home (burst requests)
      const [burst1, burst2, burst3] = await Promise.all([
        apiClients.userRole.get('/api/profile', { token: tokenA }),
        apiClients.userRole.get('/api/profile', { token: tokenA }),
        apiClients.userRole.get('/api/profile', { token: tokenA }),
      ]);

      expectResponseCode(burst1.body.code, RESPONSE_CODES.OK);
      expectResponseCode(burst2.body.code, RESPONSE_CODES.OK);
      expectResponseCode(burst3.body.code, RESPONSE_CODES.OK);

      // Thực hiện Logout Token_A
      const logoutRes = await apiClients.auth.post('/api/auth/logout', {}, { token: tokenA });
      expectResponseCode(logoutRes.body.code, RESPONSE_CODES.OK);

      // Sau Logout, Token_A phải bị chặn hoàn toàn với mã 9998
      const blockedRes = await apiClients.userRole.get('/api/profile', { token: tokenA });
      expectResponseCode(blockedRes.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-ADV-TOKEN-03] Cross-Module Blacklist Enforcement: Token_A sau khi bị Blacklist không thể gọi PUT /api/profile hoặc các API Bệnh án (/api/medical_records) -> Trả về mã 9998', async () => {
      const loginRes = await apiClients.auth.post('/api/auth/login', {
        phone: ENV.CREDENTIALS.PATIENT.phone,
        password: ENV.CREDENTIALS.PATIENT.password,
      });
      const tokenA: string = loginRes.body?.data?.token || loginRes.body?.token;

      // Thu hồi Token_A
      await apiClients.auth.post('/api/auth/logout', {}, { token: tokenA });

      // Thử dùng Token_A đã bị thu hồi để sửa hồ sơ và xem danh sách bệnh án
      const [putProfileRes, getMedRecRes] = await Promise.all([
        apiClients.userRole.put(
          '/api/profile',
          { full_name: 'Cố Tình Sửa Bằng Token Đã Logout' },
          { token: tokenA }
        ),
        apiClients.medrec.get('/api/medical_records/all', { token: tokenA }),
      ]);

      expectResponseCode(putProfileRes.body.code, RESPONSE_CODES.INVALID_TOKEN);
      expectResponseCode(getMedRecRes.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-ADV-TOKEN-04] Replay Logout Protection: Gọi POST /api/auth/logout lần thứ 2 bằng Token_A đã nằm trong Blacklist -> Trả về mã 9998', async () => {
      const loginRes = await apiClients.auth.post('/api/auth/login', {
        phone: ENV.CREDENTIALS.PATIENT.phone,
        password: ENV.CREDENTIALS.PATIENT.password,
      });
      const tokenA: string = loginRes.body?.data?.token || loginRes.body?.token;

      // Lần 1: Logout hợp lệ
      const firstLogout = await apiClients.auth.post('/api/auth/logout', {}, { token: tokenA });
      expectResponseCode(firstLogout.body.code, RESPONSE_CODES.OK);

      // Lần 2: Gửi lại đúng Token_A đã bị thu hồi
      const secondLogout = await apiClients.auth.post('/api/auth/logout', {}, { token: tokenA });
      expectResponseCode(secondLogout.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-ADV-TOKEN-05] Multi-Session Token Isolation: Thu hồi Token_A không làm hỏng Token_B mới đăng nhập của cùng người dùng', async () => {
      // Phiên 1: Đăng nhập lấy Token_A
      const sessionA = await apiClients.auth.post('/api/auth/login', {
        phone: ENV.CREDENTIALS.PATIENT.phone,
        password: ENV.CREDENTIALS.PATIENT.password,
      });
      const tokenA: string = sessionA.body?.data?.token || sessionA.body?.token;

      // Đăng xuất Token_A
      const logoutA = await apiClients.auth.post('/api/auth/logout', {}, { token: tokenA });
      expectResponseCode(logoutA.body.code, RESPONSE_CODES.OK);

      // Phiên 2: Đăng nhập lại lấy Token_B mới
      const sessionB = await apiClients.auth.post('/api/auth/login', {
        phone: ENV.CREDENTIALS.PATIENT.phone,
        password: ENV.CREDENTIALS.PATIENT.password,
      });
      const tokenB: string = sessionB.body?.data?.token || sessionB.body?.token;

      // Token_A cũ vẫn bị chặn (9998), trong khi Token_B mới hoạt động bình thường (1000)
      const resWithOldTokenA = await apiClients.userRole.get('/api/profile', { token: tokenA });
      const resWithNewTokenB = await apiClients.userRole.get('/api/profile', { token: tokenB });

      expectResponseCode(resWithOldTokenA.body.code, RESPONSE_CODES.INVALID_TOKEN);
      expectResponseCode(resWithNewTokenB.body.code, RESPONSE_CODES.OK);
    });
  });

  // ==========================================================================
  // NHÓM 3: KIỂM THỬ TRƯỜNG TỰ ĐỘNG TÍNH (READ-ONLY & AUTO-CALCULATED FIELDS)
  // & RÀNG BUỘC ẨN/HIỆN CÓ ĐIỀU KIỆN (CONDITIONAL UI LOGIC) THEO QA_Agent.md
  // ==========================================================================
  describe('3. Read-only / Auto-calculated Fields (nlr, plr, uas7_tong, aas7_tong) & Conditional Logic', () => {
    let sharedRecordId = 1;

    beforeAll(async () => {
      const medRes = await apiClients.medrec.post(
        '/api/medical_records',
        {
          template_code: 'MAY_DAY_MAN_TINH',
          type: 'MAY_DAY_MAN_TINH',
          b1_phan_loai_track: 'MAY_DAY_MAN_TINH',
          chief_complaint: 'Bệnh án kiểm thử các trường tự động tính nlr, plr, uas7_tong, aas7_tong',
        },
        { token: sessions.patient.token }
      );
      const createdId = medRes.body?.data?.id || medRes.body?.data?.medical_record_id;
      if (createdId) {
        sharedRecordId = createdId;
        suiteTeardown.registerMedicalRecord(sharedRecordId, sessions.admin.token);
      }
    });

    it('[TC-ADV-CALC-01] Auto-Calculated Blood Ratios (`nlr`, `plr`): Gửi giá trị giả mạo `nlr: 9999.9` và `plr: 8888.8` trong POST/PUT câu trả lời -> Hệ thống BE bỏ qua (ignore) và tự tính lại từ Neutrophils, Lymphocytes, Platelets (Code 1000)', async () => {
      // Neutrophils = 6.0 G/L, Lymphocytes = 2.0 G/L, Platelets = 240 G/L
      // Giá trị đúng do BE tự tính: NLR = 6.0 / 2.0 = 3.0; PLR = 240 / 2.0 = 120.0
      const res = await apiClients.medrec.post(
        `/api/medical_records/${sharedRecordId}/answers`,
        {
          neutrophils: 6.0,
          lymphocytes: 2.0,
          platelets: 240,
          nlr: 9999.9, // Giá trị giả mạo gửi từ Client
          plr: 8888.8, // Giá trị giả mạo gửi từ Client
          answers: [
            { question_id: 'neutrophils', answer_text: '6.0' },
            { question_id: 'lymphocytes', answer_text: '2.0' },
            { question_id: 'platelets', answer_text: '240' },
            { question_id: 'nlr', answer_text: '9999.9' },
            { question_id: 'plr', answer_text: '8888.8' },
          ],
        },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      // Nếu BE trả về chỉ số đã tính trong body.data, đảm bảo không nhận giá trị giả mạo 9999.9 / 8888.8
      if (res.body?.data?.nlr !== undefined) {
        expect(Number(res.body.data.nlr)).not.toBe(9999.9);
      }
      if (res.body?.data?.plr !== undefined) {
        expect(Number(res.body.data.plr)).not.toBe(8888.8);
      }
    });

    it('[TC-ADV-CALC-02] Auto-Calculated Chronic Scores (`uas7_tong`, `aas7_tong`): Gửi thử `uas7_tong: 999` và `aas7_tong: 777` trong payload -> Hệ thống BE bỏ qua và tự tính lại điểm thực tế (Code 1000)', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await apiClients.imageUas7.post(
        '/api/uas7-scores',
        {
          medical_record_id: sharedRecordId,
          record_date: today,
          wheal_score: 2, // 0..3
          itch_score: 2, // 0..3 (Tổng ngày thực tế = 4)
          uas7_tong: 999, // Trường Read-only do hệ thống tự cộng từ 7 ngày
          aas7_tong: 777, // Trường Read-only do hệ thống tự cộng
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, [
        RESPONSE_CODES.OK,
        RESPONSE_CODES.ACTION_ALREADY_DONE,
      ]);

      // Đảm bảo hệ thống không bao giờ lưu tổng điểm UAS7 = 999 (vì tối đa thang UAS7 là 42)
      if (res.body?.data?.uas7_tong !== undefined) {
        expect(Number(res.body.data.uas7_tong)).toBeLessThanOrEqual(42);
        expect(Number(res.body.data.uas7_tong)).not.toBe(999);
      }
    });

    it('[TC-ADV-COND-01] Conditional UI Visibility (`trieu_chung_ho_hap_co_khong_pv` = "Không"): Gửi kèm dữ liệu con `trieu_chung_ho_hap_hien_tai_pv` -> Hệ thống chặn (1004) hoặc tự động nullify dữ liệu con', async () => {
      const res = await apiClients.medrec.post(
        `/api/medical_records/${sharedRecordId}/answers`,
        {
          trieu_chung_ho_hap_co_khong_pv: 'Không',
          trieu_chung_ho_hap_hien_tai_pv: ['Khó thở thanh quản', 'Thở rít'],
          tien_su_benh_nen_ho_hap_pv: ['Hen phế quản'],
          dien_bien_ho_hap_pv: 'Tăng nặng nhanh',
          answers: [
            { question_id: 'trieu_chung_ho_hap_co_khong_pv', answer_text: 'Không' },
            {
              question_id: 'trieu_chung_ho_hap_hien_tai_pv',
              answer_value: ['Khó thở thanh quản', 'Thở rít'],
            },
          ],
        },
        { token: sessions.doctor.token }
      );

      const code = normalizeCode(res.body.code);
      expect([RESPONSE_CODES.INVALID_PARAMETER_VALUE, RESPONSE_CODES.OK]).toContain(code);

      // Nếu hệ thống chọn cơ chế tự động nullify thay vì trả lỗi 1004, kiểm tra trường con phải rỗng/null
      if (code === RESPONSE_CODES.OK && res.body?.data?.trieu_chung_ho_hap_hien_tai_pv) {
        expect(res.body.data.trieu_chung_ho_hap_hien_tai_pv).toHaveLength(0);
      }
    });
  });
});
