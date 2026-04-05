import { AuthService } from "../serviece/authservice";
import { Request, Response } from "express";


const authService = new AuthService();

export const AuthController = {

  async register(req: Request, res: Response) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async login(req: Request, res: Response) {

    try {
      const result = await authService.login(req.body);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  },

  async refresh(req: Request, res: Response) {

    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
      }
      const newTokens = await authService.refreshToken(refreshToken);
      res.status(200).json(newTokens);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  },

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const result = await authService.forgotPassword(email);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  },

  async logout(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const result = await authService.logout(userId);
      // ฝั่ง React: อย่าลืมสั่งลบ Token ใน LocalStorage/Cookie ด้วยนะครับ
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

 
}