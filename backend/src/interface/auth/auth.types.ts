export interface RegisterRequest {
  email: string;
  imageUrl?: string;
  password: string; // ในเครื่อง Client (Flutter) อาจจะส่งมาเป็น password ปกติ
  firstName: string;
  lastName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  accessToken: string; // บัตรผ่าน
  refreshToken: string
  user: UserProfileDto; // ข้อมูลคนถือบัตร
}

// 2. ตัวที่ใช้สำหรับ GET /me หรือดึงข้อมูลส่วนตัว (ไม่มีบัตรผ่าน เพราะหน้าบ้านมีแล้ว)
export interface UserProfileDto {
  id: string;
  imageUrl: string | null;
  email: string;
  firstName: string
  lastName: string 
  role: string;
  taxResidency?: string; // สำหรับแอปลงทุน ตัวนี้สำคัญนะ!
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  token: string;       // Token จาก Email
  newPassword: string;
}