/**
 * Định nghĩa cấu trúc dữ liệu cho Module Bệnh án (Medical Records)
 * Đối chiếu chặt chẽ với 2 tài liệu thiết kế giao diện UI:
 * 1. App Bệnh nhân: 12_9_Thiet_ke_giao_dien_Benh_nhan_App_v2_khop.html (22_9_Thiet_ke_giao_dien_Benh_nhan_App_v3)
 * 2. Bệnh án Phản vệ Bác sĩ: 12_9_Thiet_ke_giao_dien_Bac_si_BA_phanve_v1.html (22_9_Thiet_ke_BS_BA_phanve_v1_sua22.9)
 */

export type MedicalRecordStatus =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type TrackClassification = 'MAY_DAY_CAP' | 'MAY_DAY_MAN_TINH' | 'PHAN_VE';

export interface ClassifyAnswerItem {
  question_id: string;
  option_value: string;
}

export interface ClassifyRequestPayload {
  answers: ClassifyAnswerItem[];
}

export interface ClassifyResponseData {
  template_id: string;
  template_name: string;
}

export interface MedicalRecordAnswerInput {
  question_id: string;
  question_option_id?: number | null;
  option_id?: string | number | null;
  answer_text?: string | null;
  answer_value?: Record<string, any> | any[] | null;
}

export interface CreateMedicalRecordPayload {
  patient_id?: number;
  template_id: string;
  answers?: MedicalRecordAnswerInput[];
}

export interface MedicalRecordData {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id?: number | null;
  created_by: number;
  template_id: string;
  status: MedicalRecordStatus;
  instructions?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MedicalRecordSummaryData {
  medical_record_id: number;
  status: MedicalRecordStatus;
  patient_name: string;
  created_at: string;
}

/**
 * Các biến chuẩn hóa từ Thiết kế UI Bệnh nhân App & Bệnh án Phản vệ Bác sĩ
 */
export interface UIMedicalRecordVariables {
  // Logic điều hướng (Routing) từ bước sàng lọc thời gian kéo dài (< 6 tuần vs >= 6 tuần)
  b1_phan_loai_track?: TrackClassification;
  b2_phan_loai_track?: TrackClassification;
  b2_thoi_gian_tren_6_tuan?: 'YES' | 'NO';

  // Mức độ phản vệ (Bắt buộc ở mục 1 BA Phản vệ Bác sĩ -> auto-fill sang chan_doan_chinh_pv ở A0)
  muc_do_phan_ve?: 'SOC_PHAN_VE' | 'PHAN_VE';
  chan_doan_chinh_pv?: 'SOC_PHAN_VE' | 'PHAN_VE';

  // Logic ẩn/hiện trường (Conditional) - Mục 2.2 Triệu chứng hô hấp
  trieu_chung_ho_hap_co_khong_pv: 'Có' | 'Không' | 'YES' | 'NO';
  trieu_chung_ho_hap_hien_tai_pv?: string[] | null;
  tien_su_benh_nen_ho_hap_pv?: string[] | null;
  dien_bien_ho_hap_pv?: string | null;

  // Dữ liệu mảng / phức tạp - Mục 3 Định hướng căn nguyên (Thức ăn + Thời gian tiếp xúc)
  yeu_to_nghi_ngo_pv_thuc_an: 'Có' | 'Không' | 'YES' | 'NO';
  thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an?: number | null;
  tien_su_phan_ung_yeu_to_pv_thuc_an?: {
    co_khong: 'Có' | 'Không' | 'Không rõ';
    so_lan?: number;
    bieu_hien?: string;
  } | null;

  // Dữ liệu mảng ảnh sẩn phù (Mục A.2 / B.3 / 2.1)
  hien_tai_co_san_phu_pv?: 'Có' | 'Không';
  anh_san_phu?: string[];
  anh_san_phu_pv?: string[];
}
