// controllers/portfolio.controller.ts
import { Request, Response } from 'express';
import { PortfolioService } from '../services/portfolioservices';
import { AssetPriceService } from '../services/assetservices';

export class PortfolioController {
  private portfolioService = new PortfolioService();
  private assetService = new AssetPriceService();
  /**
   * POST /portfolios
   * สร้างพอร์ตใหม่
   */
  
  create = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id; // ดึงจาก Auth Middleware
      const portfolio = await this.portfolioService.createPortfolio(userId, req.body);

      return res.status(201).json({
        success: true,
        data: portfolio
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /portfolios
   * ดึงรายการพอร์ตทั้งหมดของ User (แบบย่อ)
   */
  getAll = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, message: "Portfolio ID is required" });
      }

      const portfolios = await this.portfolioService.getAllPortfolios(userId);

      return res.json({
        success: true,
        data: portfolios
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'ไม่สามารถดึงข้อมูลพอร์ตได้' });
    }
  };

  /**
   * GET /portfolios/:id
   * ดึงรายละเอียดพอร์ตแบบเจาะลึก พร้อมคำนวณกำไร/ขาดทุน และสัดส่วนหุ้น
   */

  
  getDetails = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Portfolio ID is required and must be a string"
        });
      }

      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Portfolio ID is required" });
      }
      // 1. ดึงข้อมูลพอร์ตครั้งเดียว พร้อมข้อมูลที่เกี่ยวข้องทั้งหมด
      const portfolioRaw = await this.portfolioService.getPortfolioById(userId, id);

      if (!portfolioRaw) {
        return res.status(404).json({ success: false, message: "ไม่พบพอร์ตที่ระบุ" });
      }

      // 2. รวบรวม Symbol และดึงราคา (ยิง API ครั้งเดียว)
      const symbols = portfolioRaw.positions.map(p => p.asset.symbol);
      const currentPrices = await this.assetService.getPrices(symbols);

      // 3. FX Rates (Mock data: ในอนาคตดึงจาก Service)
      const fxRates: Record<string, number> = {
        THB: 1,
        USD: 36.5,
      };

      // 4. คำนวณรายละเอียดทางการเงินโดยส่งข้อมูลที่มีอยู่เข้าไป
      const result = this.portfolioService.calculatePortfolioDetails(
        portfolioRaw,
        currentPrices,
        fxRates
      );

      return res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error("Portfolio Detail Error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * PATCH /portfolios/:id
   * แก้ไขชื่อหรือกลยุทธ์ของพอร์ต
   */
  update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Portfolio ID is required and must be a string"
        });
      }

      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const updated = await this.portfolioService.updatePortfolio(userId, id, req.body);

      return res.json({
        success: true,
        data: updated
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'แก้ไขพอร์ตไม่สำเร็จ' });
    }
  };

  /**
   * DELETE /portfolios/:id
   * ลบพอร์ต (Soft Delete)
   */
  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Portfolio ID is required and must be a string"
        });
      }

      const userId = (req as any).user.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      await this.portfolioService.softDelete(userId, id);

      return res.json({
        success: true,
        message: 'ลบพอร์ตเรียบร้อยแล้ว'
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'ลบพอร์ตไม่สำเร็จ' });
    }
  };

  /**
   * POST /portfolios/:id/transactions/dividend
   * บันทึกรายการเงินปันผล
   */
  recordDividend = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Portfolio ID is required and must be a string"
        });
      }
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const transaction = await this.portfolioService.recordDividend(userId, id, req.body);

      return res.status(201).json({
        success: true,
        data: transaction
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /portfolios/:id/snapshots
   * บันทึก Snapshot (มักจะถูกเรียกโดย Cron Job หรือ Manual Trigger)
   */
  takeSnapshot = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Portfolio ID is required and must be a string"
        });
      }
      
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const portfolioRaw = await this.portfolioService.getPortfolioById(userId, id);
      if (!portfolioRaw) {
        return res.status(404).json({ message: 'Portfolio not found' });
      }

      const symbols = portfolioRaw.positions.map(p => p.asset.symbol);
      const currentPrices = await this.assetService.getPrices(symbols);
      const fxRates = { THB: 1, USD: 36.5 };

      // ส่ง Data Object เข้าไปบันทึก snapshot
      const snapshot = await this.portfolioService.createSnapshot(
        portfolioRaw,
        currentPrices,
        fxRates
      );

      return res.status(201).json({ success: true, data: snapshot });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };
}