import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export type ServiceModule =
  | 'DEFAULT'
  | 'AUTH'
  | 'USER_ROLE'
  | 'ORG_PERMISSION'
  | 'TEMPLATE'
  | 'MEDREC'
  | 'LESION'
  | 'IMAGE_UAS7'
  | 'PRESCRIPTION_LAB_NOTI'
  | 'AI_SERVICE';

const DEFAULT_BASE_URL = process.env.DEFAULT_API_BASE_URL || 'http://localhost:3000';

export const ENV = {
  DEFAULT_API_BASE_URL: DEFAULT_BASE_URL,
  BASE_URLS: {
    DEFAULT: DEFAULT_BASE_URL,
    AUTH: process.env.AUTH_BASE_URL || DEFAULT_BASE_URL,
    USER_ROLE: process.env.USER_ROLE_BASE_URL || DEFAULT_BASE_URL,
    ORG_PERMISSION: process.env.ORG_PERMISSION_BASE_URL || DEFAULT_BASE_URL,
    TEMPLATE: process.env.TEMPLATE_BASE_URL || DEFAULT_BASE_URL,
    MEDREC: process.env.MEDREC_BASE_URL || DEFAULT_BASE_URL,
    LESION: process.env.LESION_BASE_URL || DEFAULT_BASE_URL,
    IMAGE_UAS7: process.env.IMAGE_UAS7_BASE_URL || DEFAULT_BASE_URL,
    PRESCRIPTION_LAB_NOTI: process.env.PRESCRIPTION_LAB_NOTI_BASE_URL || DEFAULT_BASE_URL,
    AI_SERVICE: process.env.AI_SERVICE_BASE_URL || DEFAULT_BASE_URL,
  } as Record<ServiceModule, string>,

  CREDENTIALS: {
    ADMIN: {
      phone: process.env.ADMIN_PHONE || '0901000001',
      password: process.env.ADMIN_PASSWORD || 'Admin@123456',
    },
    DOCTOR: {
      phone: process.env.DOCTOR_PHONE || '0901000002',
      password: process.env.DOCTOR_PASSWORD || 'Doctor@123456',
    },
    SECOND_DOCTOR: {
      phone: process.env.SECOND_DOCTOR_PHONE || '0901000003',
      password: process.env.SECOND_DOCTOR_PASSWORD || 'Doctor2@123456',
    },
    PATIENT: {
      phone: process.env.PATIENT_PHONE || '0901000004',
      password: process.env.PATIENT_PASSWORD || 'Patient@123456',
    },
  },

  API_TIMEOUT_MS: Number(process.env.API_TIMEOUT_MS || 15000),
  ENABLE_HTTP_TRACE: process.env.ENABLE_HTTP_TRACE !== 'false',
};

/**
 * Trả về Base URL động tương ứng với từng phân hệ (Module/Week) của các nhóm Backend.
 */
export function getBaseUrl(service: ServiceModule = 'DEFAULT'): string {
  return (ENV.BASE_URLS[service] || ENV.DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}
