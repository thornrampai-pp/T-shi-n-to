
import { UserRole } from "@prisma/client";
import { Request } from "express";

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

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  imageUrl?: string | null;
  taxResidency?: string; // ถ้าแอปให้แก้ที่อยู่ทางภาษีได้เอง
}

export interface UpdateUserResponse {
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  taxResidency: string;
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: UserRole;
    version: number;
  };
}

 // กำหนด Interface ของ Payload ภายในไฟล์นี้เพื่อให้จัดการ Type ง่ายขึ้น
export  interface TokenPayload {
  userId: string;
  role: UserRole;
  version?: number;
}
