import { apiClients } from '../clients/apiClient';
import { ENV } from '../config/env';
import { TeardownRegistry } from './teardownRegistry';

export interface TestActorSession {
  token: string;
  userId: number;
  phone: string;
  roleId?: number | string;
}

export interface MultiRoleSessions {
  admin: TestActorSession;
  doctor: TestActorSession;
  secondDoctor: TestActorSession;
  patient: TestActorSession;
  otherPatient: TestActorSession;
}

/**
 * Sinh số điện thoại hợp lệ chuẩn Việt Nam (đầu số 03, 05, 07, 08, 09 + 8 chữ số)
 * Đảm bảo tính duy nhất giữa các lần chạy test.
 */
export function generateValidVnPhone(prefix: '03' | '05' | '07' | '08' | '09' = '09'): string {
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${randomDigits}`;
}

/**
 * Thực hiện đăng nhập qua API thật của Tuần 1 (POST /api/auth/login) để lấy JWT Token động.
 */
export async function loginActor(phone: string, password: string): Promise<TestActorSession> {
  const res = await apiClients.auth.post('/api/auth/login', { phone, password });
  const data = res.body?.data;
  return {
    token: data?.token || '',
    userId: Number(data?.user_info?.user_id || 0),
    phone,
    roleId: data?.user_info?.role_id,
  };
}

/**
 * Tạo mới một tài khoản Bệnh nhân qua API thật Tuần 1 (POST /api/auth/signup),
 * sau đó gọi API Login để lấy Token và đăng ký vào TeardownRegistry để xóa khi kết thúc.
 */
export async function createAndLoginPatient(
  teardown: TeardownRegistry,
  adminTokenForCleanup?: string,
  customName = 'Bệnh Nhân Kiểm Thử Tự Động'
): Promise<TestActorSession> {
  const phone = generateValidVnPhone('09');
  const password = 'PatientTest@123';

  const signupRes = await apiClients.auth.post('/api/auth/signup', {
    full_name: customName,
    phone,
    password,
    gender: 'female',
  });

  const createdUserId = Number(signupRes.body?.data?.user_id || 0);
  if (createdUserId && adminTokenForCleanup) {
    teardown.registerUser(createdUserId, adminTokenForCleanup);
  }

  const session = await loginActor(phone, password);
  return {
    ...session,
    userId: session.userId || createdUserId,
  };
}

/**
 * Khởi tạo đầy đủ phiên đăng nhập cho các vai trò (Admin, Bác sĩ chính, Bác sĩ thứ 2, Bệnh nhân chính, Bệnh nhân phụ)
 * thông qua API thật ở Tuần 1 để truyền Token động cho các Tuần tiếp theo (Week 2 -> Week 10).
 */
export async function setupMultiRoleSessions(teardown: TeardownRegistry): Promise<MultiRoleSessions> {
  // 1. Đăng nhập tài khoản Admin gốc từ cấu hình .env
  const admin = await loginActor(ENV.CREDENTIALS.ADMIN.phone, ENV.CREDENTIALS.ADMIN.password);

  // 2. Đăng nhập Bác sĩ chính & Bác sĩ thứ 2 (để test kịch bản 1009 / 1010 bác sĩ khác tiếp nhận hoặc sửa bệnh án)
  const doctor = await loginActor(ENV.CREDENTIALS.DOCTOR.phone, ENV.CREDENTIALS.DOCTOR.password);
  const secondDoctor = await loginActor(
    ENV.CREDENTIALS.SECOND_DOCTOR.phone,
    ENV.CREDENTIALS.SECOND_DOCTOR.password
  );

  // 3. Tạo động 2 Bệnh nhân mới qua API Signup & Login để dữ liệu test hoàn toàn độc lập, sạch sẽ
  const patient = await createAndLoginPatient(teardown, admin.token, 'Nguyễn Văn A (BN Chính)');
  const otherPatient = await createAndLoginPatient(teardown, admin.token, 'Trần Thị B (BN Phụ)');

  return {
    admin,
    doctor,
    secondDoctor,
    patient,
    otherPatient,
  };
}
