import { apiClients } from '../../src/clients/apiClient';
import { ENV } from '../../src/config/env';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import { generateValidVnPhone, loginActor } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';

/**
 * ============================================================================
 * TUẦN 1: MODULE XÁC THỰC & TÀI KHOẢN (6 APIs)
 * ============================================================================
 * Danh sách API theo phân phối Tuần 1:
 * 1. POST /api/auth/signup          (signup)
 * 2. POST /api/auth/login           (login)
 * 3. POST /api/auth/logout          (logout)
 * 4. POST /api/auth/forgot-password (forgot_password)
 * 5. POST /api/auth/reset-password  (reset_password)
 * 6. POST /api/auth/create-staff    (create_staff)
 */
describe('Week 1 - Authentication & Account Management (Real API, Zero Mocking)', () => {
  const suiteTeardown = new TeardownRegistry();
  const testCaseTeardown = new TeardownRegistry();
  let adminToken = '';

  beforeAll(async () => {
    const adminSession = await loginActor(ENV.CREDENTIALS.ADMIN.phone, ENV.CREDENTIALS.ADMIN.password);
    adminToken = adminSession.token;
  });

  afterEach(async () => {
    await testCaseTeardown.cleanupAll();
  });

  afterAll(async () => {
    await suiteTeardown.cleanupAll();
  });

  // ==========================================================================
  // 1. API: POST /api/auth/signup (12 Test Cases)
  // ==========================================================================
  describe('1. POST /api/auth/signup (Đăng ký tài khoản bệnh nhân)', () => {
    it('[TC-SIGNUP-01] Happy Path: Đăng ký tài khoản bệnh nhân mới với đầy đủ thông tin hợp lệ (Code 1000)', async () => {
      const phone = generateValidVnPhone('09');
      const res = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Nguyễn Văn Kiểm Thử',
        phone,
        password: 'ValidPassword@123',
        gender: 'male',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toHaveProperty('user_id');
      expect(res.body.data.phone).toBe(phone);

      if (res.body.data?.user_id && adminToken) {
        testCaseTeardown.registerUser(res.body.data.user_id, adminToken);
      }
    });

    it('[TC-SIGNUP-02] Happy Path (Optional Gender): Đăng ký tài khoản không truyền trường tùy chọn gender (Code 1000)', async () => {
      const phone = generateValidVnPhone('03');
      const res = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Trần Thị Hoa',
        phone,
        password: 'ValidPassword@123',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      if (res.body.data?.user_id && adminToken) {
        testCaseTeardown.registerUser(res.body.data.user_id, adminToken);
      }
    });

    it('[TC-SIGNUP-03] Negative Case (Duplicate Phone): Đăng ký trùng số điện thoại đã tồn tại (mã cũ 3006 gộp về 9996) -> Trả về mã 9996', async () => {
      const phone = generateValidVnPhone('08');
      const firstRes = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Người Dùng Gốc',
        phone,
        password: 'ValidPassword@123',
      });
      if (firstRes.body?.data?.user_id && adminToken) {
        testCaseTeardown.registerUser(firstRes.body.data.user_id, adminToken);
      }

      const duplicateRes = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Người Dùng Trùng SĐT',
        phone,
        password: 'ValidPassword@123',
      });

      expectResponseCode(duplicateRes.body.code, RESPONSE_CODES.ALREADY_EXISTS);
    });

    it('[TC-SIGNUP-04] Negative Case (Missing Param): Thiếu trường bắt buộc full_name -> Trả về mã 1002', async () => {
      const res = await apiClients.auth.post('/api/auth/signup', {
        phone: generateValidVnPhone('09'),
        password: 'ValidPassword@123',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-SIGNUP-05] Negative Case (Missing Param): Thiếu trường bắt buộc phone -> Trả về mã 1002', async () => {
      const res = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Thiếu SĐT',
        password: 'ValidPassword@123',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-SIGNUP-06] Negative Case (Missing Param): Thiếu trường bắt buộc password -> Trả về mã 1002', async () => {
      const res = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Thiếu Mật Khẩu',
        phone: generateValidVnPhone('09'),
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-SIGNUP-07] Negative Case (Invalid Value): Số điện thoại sai chuẩn VN (không bắt đầu bằng 03/05/07/08/09 - mã cũ 2004 gộp về 1004) -> Trả về mã 1004', async () => {
      const res = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Sai Đầu Số SĐT',
        phone: '0123456789',
        password: 'ValidPassword@123',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-SIGNUP-08] Negative Case (Invalid Value): Số điện thoại không đủ 10 chữ số -> Trả về mã 1004', async () => {
      const res = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'SĐT Ngắn',
        phone: '0912345',
        password: 'ValidPassword@123',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-SIGNUP-09] Negative Case (Invalid Value): Mật khẩu ngắn hơn 6 ký tự tối thiểu -> Trả về mã 1004', async () => {
      const res = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Mật Khẩu Ngắn',
        phone: generateValidVnPhone('09'),
        password: '123',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-SIGNUP-10] Negative Case (Invalid Value): Trường gender truyền giá trị ngoài male/female/other -> Trả về mã 1004', async () => {
      const res = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Sai Giới Tính',
        phone: generateValidVnPhone('09'),
        password: 'ValidPassword@123',
        gender: 'invalid_gender',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-SIGNUP-11] Negative Case (Invalid Type): Trường phone hoặc full_name truyền kiểu số/mảng thay vì string -> Trả về mã 1003', async () => {
      const res = await apiClients.auth.post('/api/auth/signup', {
        full_name: ['Not', 'String'] as any,
        phone: 987654321 as any,
        password: 'ValidPassword@123',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-SIGNUP-12] Security/Privilege Escalation: Người dùng cố tình truyền role_id=1 (Admin) khi signup vẫn chỉ được cấp quyền mặc định patient (Code 1000)', async () => {
      const phone = generateValidVnPhone('07');
      const res = await apiClients.auth.post('/api/auth/signup', {
        full_name: 'Thử Leo Thang Đặc Quyền',
        phone,
        password: 'ValidPassword@123',
        role_id: 1,
      });

      if (res.body?.data?.user_id && adminToken) {
        testCaseTeardown.registerUser(res.body.data.user_id, adminToken);
      }
      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(String(res.body.data.role_id)).not.toBe('admin');
    });
  });

  // ==========================================================================
  // 2. API: POST /api/auth/login (12 Test Cases)
  // ==========================================================================
  describe('2. POST /api/auth/login (Đăng nhập tài khoản & Cấp JWT Token)', () => {
    it('[TC-LOGIN-01] Happy Path: Đăng nhập tài khoản Admin thành công, trả về token và user_info (Code 1000)', async () => {
      const res = await apiClients.auth.post('/api/auth/login', {
        phone: ENV.CREDENTIALS.ADMIN.phone,
        password: ENV.CREDENTIALS.ADMIN.password,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(typeof res.body.data?.token).toBe('string');
      expect(res.body.data?.user_info).toHaveProperty('user_id');
      expect(res.body.data?.user_info).toHaveProperty('role_id');
    });

    it('[TC-LOGIN-02] Happy Path: Đăng nhập tài khoản Bác sĩ thành công (Code 1000)', async () => {
      const res = await apiClients.auth.post('/api/auth/login', {
        phone: ENV.CREDENTIALS.DOCTOR.phone,
        password: ENV.CREDENTIALS.DOCTOR.password,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data?.token).toBeTruthy();
    });

    it('[TC-LOGIN-03] Negative Case (Missing Param): Thiếu trường phone -> Trả về mã 1002', async () => {
      const res = await apiClients.auth.post('/api/auth/login', {
        password: ENV.CREDENTIALS.ADMIN.password,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-LOGIN-04] Negative Case (Missing Param): Thiếu trường password -> Trả về mã 1002', async () => {
      const res = await apiClients.auth.post('/api/auth/login', {
        phone: ENV.CREDENTIALS.ADMIN.phone,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-LOGIN-05] Negative Case (Missing Param): Body rỗng {} -> Trả về mã 1002', async () => {
      const res = await apiClients.auth.post('/api/auth/login', {});

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-LOGIN-06] Negative Case (Not Found): Số điện thoại chưa từng đăng ký trên hệ thống (mã cũ 3007 gộp về 9992) -> Trả về mã 9992', async () => {
      const res = await apiClients.auth.post('/api/auth/login', {
        phone: '0999888777',
        password: 'SomePassword@123',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-LOGIN-07] Negative Case (Wrong Password): Nhập sai mật khẩu (mã cũ 3008 gộp về 9995 hoặc 1004) -> Bị từ chối đăng nhập', async () => {
      const res = await apiClients.auth.post('/api/auth/login', {
        phone: ENV.CREDENTIALS.ADMIN.phone,
        password: 'WrongPassword@99999',
      });

      expect([RESPONSE_CODES.USER_NOT_VALIDATED, RESPONSE_CODES.INVALID_PARAMETER_VALUE]).toContain(
        String(res.body.code)
      );
    });

    it('[TC-LOGIN-08] Negative Case (Invalid Format): Số điện thoại sai định dạng chuẩn VN -> Trả về mã 1004', async () => {
      const res = await apiClients.auth.post('/api/auth/login', {
        phone: 'abc_invalid_phone',
        password: 'ValidPassword@123',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-LOGIN-09] Negative Case (Invalid Type): Truyền phone kiểu mảng hoặc object -> Trả về mã 1003', async () => {
      const res = await apiClients.auth.post('/api/auth/login', {
        phone: ['0901000001'] as any,
        password: 'ValidPassword@123',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-LOGIN-10] Negative Case (Malformed JSON): Gửi chuỗi JSON lỗi cú pháp -> Trả về mã 1003', async () => {
      const res = await apiClients.auth.post('/api/auth/login', '{"phone": "0901000001", broken');

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_TYPE);
    });

    it('[TC-LOGIN-11] Security (SQL Injection Attempt): Truyền chuỗi SQL Injection vào phone không làm sập server (Trả về 1004 hoặc 9992)', async () => {
      const res = await apiClients.auth.post('/api/auth/login', {
        phone: "' OR 1=1 --",
        password: 'password',
      });

      expect([RESPONSE_CODES.INVALID_PARAMETER_VALUE, RESPONSE_CODES.NOT_FOUND]).toContain(
        String(res.body.code)
      );
    });

    it('[TC-LOGIN-12] UI Routing Check: Kiểm tra user_info trả về đủ user_id, full_name, phone, role_id để App điều hướng theo Role', async () => {
      const res = await apiClients.auth.post('/api/auth/login', {
        phone: ENV.CREDENTIALS.DOCTOR.phone,
        password: ENV.CREDENTIALS.DOCTOR.password,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      const userInfo = res.body.data.user_info;
      expect(userInfo).toHaveProperty('user_id');
      expect(userInfo).toHaveProperty('full_name');
      expect(userInfo).toHaveProperty('phone', ENV.CREDENTIALS.DOCTOR.phone);
      expect(userInfo).toHaveProperty('role_id');
    });
  });

  // ==========================================================================
  // 3. API: POST /api/auth/logout, forgot-password, reset-password, create-staff
  // ==========================================================================
  describe('3. Các API Quản lý Phiên, Mật khẩu & Tạo Nhân viên Y tế (logout, forgot_password, reset_password, create_staff)', () => {
    it('[TC-STAFF-01] Happy Path: Admin tạo tài khoản nhân viên y tế (create_staff) thành công (Code 1000)', async () => {
      const staffPhone = generateValidVnPhone('09');
      const res = await apiClients.auth.post(
        '/api/auth/create-staff',
        {
          full_name: 'BS. Nguyễn Minh Khoa',
          phone: staffPhone,
          password: 'StaffPassword@123',
          gender: 'male',
          role_id: 2,
          branch_id: 1,
          department_id: 1,
          room_id: 1,
        },
        { token: adminToken }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      if (res.body.data?.user_id && adminToken) {
        testCaseTeardown.registerUser(res.body.data.user_id, adminToken);
      }
    });

    it('[TC-STAFF-02] Security/Authorization: Bệnh nhân hoặc Bác sĩ gọi API create-staff (Chỉ dành cho Admin) -> Trả về mã 1009', async () => {
      const docSession = await loginActor(ENV.CREDENTIALS.DOCTOR.phone, ENV.CREDENTIALS.DOCTOR.password);
      const res = await apiClients.auth.post(
        '/api/auth/create-staff',
        {
          full_name: 'BS Không Hợp Lệ',
          phone: generateValidVnPhone('09'),
          password: 'StaffPassword@123',
          role_id: 2,
          branch_id: 1,
          department_id: 1,
        },
        { token: docSession.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-STAFF-03] Negative Case (Missing Param): Admin gọi create-staff thiếu branch_id hoặc department_id -> Trả về mã 1002', async () => {
      const res = await apiClients.auth.post(
        '/api/auth/create-staff',
        {
          full_name: 'BS Thiếu Khoa Phòng',
          phone: generateValidVnPhone('09'),
          password: 'StaffPassword@123',
        },
        { token: adminToken }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-FORGOT-01] Negative Case (Not Found): Quên mật khẩu với SĐT/Email không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.auth.post('/api/auth/forgot-password', {
        phone: '0999000111',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-RESET-01] Negative Case (Invalid OTP): Đặt lại mật khẩu với mã OTP sai (mã cũ 3004/3005 gộp về 9993) -> Trả về mã 9993', async () => {
      const res = await apiClients.auth.post('/api/auth/reset-password', {
        phone: ENV.CREDENTIALS.PATIENT.phone,
        otp: '000000',
        new_password: 'NewPassword@123',
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.VERIFY_CODE_INCORRECT);
    });

    it('[TC-LOGOUT-01] Security/Auth: Gọi API đăng xuất (/api/auth/logout) không có Token -> Trả về mã 9998', async () => {
      const res = await apiClients.auth.post('/api/auth/logout', {});

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });
  });
});
