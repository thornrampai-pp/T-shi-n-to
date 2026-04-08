import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { ENV } from '../config/env.js';
import { RegisterRequest, LoginRequest, AuthResponseDto, UserProfileDto } from '../interface/auth/auth.types';


export class AuthService {

  generateTokens(user: { id: string, role: string, tokenVersion: number }) {

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, version: user.tokenVersion },
      ENV.ACCESS_TOKEN_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, version: user.tokenVersion },
      ENV.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    )

    return { accessToken, refreshToken };
  }


  // register

  async register(data: RegisterRequest): Promise<AuthResponseDto> {
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (existing) {
      throw new Error('Email already registered');
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const newUser = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        imageUrl: data.imageUrl || null
      }
    });

    const tokens = this.generateTokens({ id: newUser.id, role: newUser.role, tokenVersion: newUser.tokenVersion });

    return {
      ...tokens,
      user: {
        id: newUser.id,
        email: newUser.email,
        imageUrl: newUser.imageUrl || '',
        firstName: newUser.firstName || '',
        lastName: newUser.lastName || '',
        role: newUser.role,
      }
    };
  }

  async login(data: LoginRequest): Promise<AuthResponseDto> {
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const tokens = this.generateTokens({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        imageUrl: user.imageUrl || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role,
        taxResidency: user.taxResidency
      }
    }
  }

  async refreshToken(token: string) {
    try {
    
      const payload = jwt.verify(token, ENV.REFRESH_TOKEN_SECRET!) as { userId: string, version: number };

      const user = await prisma.user.findUnique({
        where: { id: payload.userId }
      });

      if (!user) throw new Error('User not found');

      //  ตรวจสอบ Version: ถ้า User เปลี่ยนรหัสผ่านไปแล้ว เลขจะไม่ตรงกัน
      if (user.tokenVersion !== payload.version) {
        throw new Error('Refresh token expired due to security change');
      }

      //  ส่ง user เข้าไป (ซึ่งมี id, role, tokenVersion ครบตามที่ Prisma ดึงมา)
      return this.generateTokens(user);
    } catch (err) {
      throw new Error('Invalid refresh token');
    }
  }

  async forgotPassword(email: string) {
    
    const user = await prisma.user.findUnique({ where: { email } });

    // 💡 Security Tip: ไม่ควรบอกว่า "ไม่พบ Email" เพื่อป้องกันการสุ่มเดา Email ในระบบ
    if (!user) {
      return { message: "If this email is registered, you will receive a reset link shortly." };
    }

    // 2. สร้าง Reset Token (ใช้ RESET_PASSWORD_SECRET และอายุสั้นๆ เช่น 15 นาที)
    const resetToken = jwt.sign(
      { userId: user.id, type: 'FORGOT_PASSWORD' },
      ENV.RESET_PASSWORD_SECRET!,
      { expiresIn: '15m' }
    );

    // // 3. ส่ง Email (สมมติว่าคุณมี Mail Service)
    // const resetLink = `${ENV.FRONTEND_URL}/reset-password?token=${resetToken}`;
    // console.log(`[MAIL] Sending to ${email}: ${resetLink}`);

    return { message: "Reset link has been sent to your email." };
  }


  async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: { increment: 1 }
      }
    });

    return { message: "Logged out successfully" };
  }


}
