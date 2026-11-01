import { MedicalRecordAnswerInput } from '../types/medrec.types';

/**
 * Dữ liệu mẫu chuẩn hóa (Fixtures) bám sát 100% tên biến trong 2 file thiết kế UI:
 * 1. App Bệnh nhân: `b1_phan_loai_track`, `b2_phan_loai_track`, `b2_thoi_gian_tren_6_tuan`, `anh_san_phu`
 * 2. Bệnh án Phản vệ Bác sĩ: `muc_do_phan_ve`, `chan_doan_chinh_pv`, `trieu_chung_ho_hap_co_khong_pv`,
 *    `trieu_chung_ho_hap_hien_tai_pv`, `yeu_to_nghi_ngo_pv_thuc_an`, `thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an`,
 *    `dac_diem_san_phu_pv`, `bang_theo_doi_dau_hieu_sinh_ton`, `theo_doi_phan_ve_dieu_tri`
 */

export const UI_CLASSIFY_PAYLOADS = {
  /**
   * Kịch bản sàng lọc điều hướng sang Nhánh A: Mày đay cấp (< 6 tuần)
   * Biến điều hướng: b1_phan_loai_track = "MAY_DAY_CAP"
   */
  ACUTE_URTICARIA_TRACK: {
    answers: [
      { question_id: 'b2_loai_ton_thuong', option_value: 'MAY_DAY_CA_HAI' },
      { question_id: 'b2_thoi_gian_tren_6_tuan', option_value: 'NO' },
      { question_id: 'b2_thoi_gian_bien_mat_moi_not', option_value: '1_TO_24_HOURS' },
      { question_id: 'b1_phan_loai_track', option_value: 'MAY_DAY_CAP' },
    ],
  },

  /**
   * Kịch bản sàng lọc điều hướng sang Nhánh B: Mày đay mạn tính (>= 6 tuần)
   * Biến điều hướng: b1_phan_loai_track = "MAY_DAY_MAN_TINH"
   */
  CHRONIC_URTICARIA_TRACK: {
    answers: [
      { question_id: 'b2_loai_ton_thuong', option_value: 'MAY_DAY' },
      { question_id: 'b2_thoi_gian_tren_6_tuan', option_value: 'YES' },
      { question_id: 'b2_thoi_gian_bien_mat_moi_not', option_value: '1_TO_24_HOURS' },
      { question_id: 'b1_phan_loai_track', option_value: 'MAY_DAY_MAN_TINH' },
    ],
  },

  /**
   * Kịch bản sàng lọc Bước 0 "Báo động đỏ": Nghi ngờ Phản vệ / Sốc phản vệ
   * Biến điều hướng: b0_ket_qua_canh_bao -> b1_phan_loai_track = "PHAN_VE"
   */
  ANAPHYLAXIS_RED_FLAG_TRACK: {
    answers: [
      { question_id: 'trieu_chung_ho_hap_co_khong_pv', option_value: 'YES' },
      { question_id: 'trieu_chung_tuan_hoan_co_khong_pv', option_value: 'YES' },
      { question_id: 'b1_phan_loai_track', option_value: 'PHAN_VE' },
    ],
  },
};

/**
 * Bộ câu trả lời chi tiết cho Bệnh án Мày đay cấp (Nhánh A - App Bệnh nhân)
 * Có đính kèm mảng ảnh `anh_san_phu` và bóc tách dị nguyên thức ăn + thời gian tiếp xúc
 */
export const UI_PATIENT_ACUTE_ANSWERS: MedicalRecordAnswerInput[] = [
  {
    question_id: 'b1_phan_loai_track',
    answer_text: 'MAY_DAY_CAP',
  },
  {
    question_id: 'thoi_gian_khoi_phat_gio',
    answer_text: '12',
  },
  {
    question_id: 'trieu_chung_da_hien_tai',
    answer_value: {
      selected: ['Phù mạch', 'Sẩn phù lan rộng'],
    },
  },
  {
    question_id: 'anh_san_phu',
    answer_value: [
      'https://minio.drmayday.vn/lesions/patient_wheal_01.jpg',
      'https://minio.drmayday.vn/lesions/patient_wheal_02.png',
    ],
  },
  {
    question_id: 'yeu_to_nghi_ngo_thuc_an',
    answer_value: {
      status: 'Có',
      detail: 'Tôm biển nướng, hải sản',
      thoi_gian_tiep_xuc_khoi_phat_thuc_an: 30,
      unit: 'phút',
    },
  },
];

/**
 * Bộ câu trả lời chuẩn của Bác sĩ cho Bệnh án Phản vệ / Sốc phản vệ
 * Trường hợp 1: `trieu_chung_ho_hap_co_khong_pv` = "Không" -> Các trường hô hấp con KHÔNG được phép gửi dữ liệu
 */
export const UI_DOCTOR_ANAPHYLAXIS_ANSWERS_NO_RESPIRATORY: MedicalRecordAnswerInput[] = [
  {
    question_id: 'muc_do_phan_ve',
    answer_text: 'Phản vệ',
  },
  {
    question_id: 'chan_doan_chinh_pv',
    answer_text: 'Phản vệ',
  },
  {
    question_id: 'hien_tai_co_san_phu_pv',
    answer_text: 'Có',
  },
  {
    question_id: 'anh_san_phu_pv',
    answer_value: [
      'https://minio.drmayday.vn/anaphylaxis/san_phu_pv_01.jpg',
      'https://minio.drmayday.vn/anaphylaxis/san_phu_pv_02.jpg',
    ],
  },
  {
    // Logic ẩn/hiện trường (Conditional): Khi chọn "Không", các trường con hô hấp phải không gửi lên hoặc rỗng
    question_id: 'trieu_chung_ho_hap_co_khong_pv',
    answer_text: 'Không',
  },
  {
    // Mục 3: Định hướng căn nguyên - Yếu tố nghi ngờ thức ăn đi kèm thời gian tiếp xúc và tiền sử phản ứng
    question_id: 'yeu_to_nghi_ngo_pv_thuc_an',
    answer_value: {
      status: 'Có',
      ten_thuc_an: 'Đậu phộng (Lạc) và Tôm sú',
    },
  },
  {
    question_id: 'thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an',
    answer_text: '15',
    answer_value: { value: 15, unit: 'phút' },
  },
  {
    question_id: 'tien_su_phan_ung_yeu_to_pv_thuc_an',
    answer_value: {
      status: 'Có',
      so_lan: 2,
      bieu_hien: 'Nổi mẩn đỏ và ngứa quanh miệng sau ăn 20 phút',
    },
  },
];

/**
 * Bộ câu trả lời VI PHẠM logic ẩn/hiện UI:
 * `trieu_chung_ho_hap_co_khong_pv` = "Không" nhưng vẫn cố tình truyền `trieu_chung_ho_hap_hien_tai_pv` và `dien_bien_ho_hap_pv`
 * Dùng để kiểm thử Negative Case (kỳ vọng BE trả về mã lỗi 1004 - Parameter value is invalid).
 */
export const UI_DOCTOR_ANAPHYLAXIS_INVALID_CONDITIONAL_ANSWERS: MedicalRecordAnswerInput[] = [
  {
    question_id: 'trieu_chung_ho_hap_co_khong_pv',
    answer_text: 'Không',
  },
  {
    question_id: 'trieu_chung_ho_hap_hien_tai_pv',
    answer_value: ['Tiếng rít thanh quản', 'Khó thở', 'Thở khò khè'],
  },
  {
    question_id: 'tien_su_benh_nen_ho_hap_pv',
    answer_value: ['Hen phế quản'],
  },
  {
    question_id: 'dien_bien_ho_hap_pv',
    answer_text: 'Tăng nặng',
  },
];

/**
 * Các hàm Builder tạo Payload khởi tạo Bệnh án thực tế từ App Bệnh nhân
 * phục vụ các bộ kiểm thử Tuần 6, 7, 8, 9, 10.
 */
export function buildPatientAcuteUrticariaPayload() {
  return {
    template_code: 'MAY_DAY_CAP',
    type: 'MAY_DAY_CAP',
    b1_phan_loai_track: 'MAY_DAY_CAP',
    b1_thoi_gian_keo_dai: '< 6 tuần',
    chief_complaint: 'Nổi sẩn phù cấp tính vùng mặt và tay sau ăn tôm biển 30 phút',
    answers: UI_PATIENT_ACUTE_ANSWERS,
  };
}

export function buildPatientChronicUrticariaPayload() {
  return {
    template_code: 'MAY_DAY_MAN_TINH',
    type: 'MAY_DAY_MAN_TINH',
    b1_phan_loai_track: 'MAY_DAY_MAN_TINH',
    b1_thoi_gian_keo_dai: '>= 6 tuần',
    chief_complaint: 'Nổi sẩn phù tái diễn liên tục trên 8 tuần, cần theo dõi điểm UAS7',
    answers: [
      { question_id: 'b1_phan_loai_track', answer_text: 'MAY_DAY_MAN_TINH' },
      { question_id: 'b2_thoi_gian_tren_6_tuan', answer_text: 'YES' },
    ],
  };
}

export function buildPatientAnaphylaxisPayload() {
  return {
    template_code: 'PHAN_VE',
    type: 'PHAN_VE',
    b1_phan_loai_track: 'PHAN_VE',
    chief_complaint: 'Khó thở, thở rít, phù môi lưỡi và nổi sẩn phù toàn thân sau ăn tôm biển 15 phút',
    answers: UI_DOCTOR_ANAPHYLAXIS_ANSWERS_NO_RESPIRATORY,
  };
}
