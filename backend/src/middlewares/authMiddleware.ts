import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { ENV } from "../config/env";
import { AuthRequest, TokenPayload } from "../interface/auth/auth.types";


export const authMiddleware = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. ดึง token จาก header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // 2. Verify token 
    // ใช้ 'as any' หรือ 'as unknown' ก่อนเพื่อแก้ปัญหา Type overlap ที่คุณเจอ
    const decoded = jwt.verify(token!, ENV.ACCESS_TOKEN_SECRET) as unknown as TokenPayload;

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // 3. Check user ใน DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        tokenVersion: true,
      }
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // 4. Check tokenVersion (Security: ใช้สำหรับ Logout ทุกเครื่อง หรือ Force Reset)
    if (user.tokenVersion !== decoded.version) {
      return res.status(401).json({ message: "Token has been revoked" });
    }

    // 5. Attach user เข้า request object
    req.user = {
      userId: user.id,
      role: user.role,
      version: user.tokenVersion
    };

    next();

  } catch (err) {
    // แยก Error กรณี Token Expired หรือ Invalid
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};