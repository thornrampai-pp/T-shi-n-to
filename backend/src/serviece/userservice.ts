import { ChangePasswordRequest, UpdateUserRequest, UpdateUserResponse, UserProfileDto } from "../interface/auth/auth.types";
import prisma from "../lib/prisma";
import bcrypt from 'bcrypt';


export class UserService  {

  async getProfile(userId: string): Promise<UserProfileDto>{
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      imageUrl: user.imageUrl || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role,
      taxResidency: user.taxResidency ?? undefined,
    };
  }
  

  async updateProfile(userId: string, data: Partial<UpdateUserRequest>): Promise<UpdateUserResponse> {
    const updateUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.taxResidency !== undefined && { taxResidency: data.taxResidency }),
      }
    });

    return {
      firstName: updateUser.firstName || '',
      lastName: updateUser.lastName || '',
      imageUrl: updateUser.imageUrl || null,
      taxResidency: updateUser.taxResidency,
    };
  }

  async changePassword(userId: string, data: ChangePasswordRequest) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // เช็ครหัสผ่านเดิม
    const isMatch = await bcrypt.compare(data.oldPassword, user.passwordHash);
    if (!isMatch) throw new Error('Current password is incorrect');

    // Hash รหัสผ่านใหม่
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(data.newPassword, salt);

    // อัปเดต และ "ดีด" Version (สำคัญ!) เพื่อให้เครื่องอื่นหลุด Logout ทันที
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        tokenVersion: { increment: 1 },
      },
    });

    return { message: 'Password updated successfully' };
  }


  async deleteAccount(userId: string) {
    // แนะนำให้ทำ Soft Delete โดยการเซ็ต isActive เป็น false หรือบันทึกวันที่ลบ
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        tokenVersion: { increment: 1 }, // ดีดคนใช้งานอยู่ปัจจุบันออกด้วย
      },
    });

    return { message: 'Account has been deactivated' };
  }

}