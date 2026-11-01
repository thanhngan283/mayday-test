export interface StandardApiResponse<T = any> {
  code: string | number;
  message: string;
  data?: T;
  count?: number | string;
}

export interface LoginResponseData {
  token: string;
  user_info: {
    user_id: number | string;
    full_name: string;
    display_name?: string;
    phone: string;
    role_id: number | string;
  };
}

export interface SignupResponseData {
  user_id: number;
  full_name: string;
  phone: string;
  gender?: 'male' | 'female' | 'other';
  role_id: number | string;
  is_active: number;
  created_at: string;
}

export interface StaffResponseData {
  user_id: number;
  full_name: string;
  role_id: number;
  branch_id: number;
  department_id: number;
  room_id?: number | null;
}
