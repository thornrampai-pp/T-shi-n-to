import { ChangePasswordRequest, UpdateUserRequest, UpdateUserResponse, UserProfileDto } from "../interface/auth/auth.types";
import prisma from "../lib/prisma";
import { UserService } from "../serviece/userservice";
import { Request, Response } from "express";

const userService = new UserService();


export const UserController = {
  async getProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const profile = await userService.getProfile(userId);
      res.status(200).json(profile);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  },


  async updateProfile(req: Request, res: Response) {
    try {

      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const updated = await userService.updateProfile(userId, req.body);
      res.status(200).json(updated);

    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  },

  async changeMyPassword(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await userService.changePassword(userId, req.body);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  },

  async deleteMe(req: Request, res: Response) {
    try {
      //  ดึง ID จาก Token เท่านั้น (ปลอดภัย 100% เพราะ Token ปลอมไม่ได้)
      const userId = (req as any).user.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // สั่งลบผ่าน Service
      const result = await userService.deleteAccount(userId);

      // ฝั่ง React: อย่าลืมสั่งลบ Token ในเครื่องทิ้งด้วยหลังจากได้รับ Success
      res.status(200).json(result);

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }









}

