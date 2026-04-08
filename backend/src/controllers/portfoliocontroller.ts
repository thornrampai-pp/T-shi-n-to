// controllers/portfolio.controller.ts
import { Request, Response } from 'express';
import { PortfolioService } from '../serviece/portfolioservice';
import { AssetPriceService } from '../serviece/assetservice';

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
      const userId = (req as any).user.id;
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
        return res.status(401).json({ message: 'Unauthorized' });
      }
      // 1. ดึงข้อมูลพอร์ตเบื้องต้นเพื่อดูว่า User นี้ถือหุ้นตัวไหนบ้าง
      const portfolioRaw = await this.portfolioService.getPortfolioById(userId, id);
      if (!portfolioRaw) {
        return res.status(404).json({ success: false, message: "ไม่พบพอร์ตที่ระบุ" });
      }

      // 2. รวบรวม Symbol ทั้งหมดในพอร์ต (เช่น ["AAPL", "CPALL.BK"])
      const symbols = portfolioRaw.positions.map(p => p.asset.symbol);

      // 3. ดึงราคาปัจจุบันจาก AssetService
      // เราจะสร้าง Object เก็บราคา { "AAPL": 175.5, ... }
      const currentPrices: Record<string, number> = {};

      await Promise.all(
        symbols.map(async (s) => {
          try {
            const price = await this.assetService.getPrice(s);
            currentPrices[s] = price;
          } catch (err) {
            currentPrices[s] = 0; // กรณีดึงราคาไม่ได้ให้เป็น 0
          }
        })
      );

      // 4. จัดการ FX Rates (ดึงเรทแลกเปลี่ยน)
      // ในอนาคตคุณอาจจะสร้าง CurrencyService มาดึงเรทจริง เช่น "USDTHB=X" จาก Yahoo
      const fxRates: Record<string, number> = {
        "THB": 1,
        "USD": 36.5, // สมมติค่าคงที่ไว้ก่อน หรือดึงจาก Service
      };

      // 5. ส่งข้อมูลที่ได้จาก DB + ราคาสด ไปให้ PortfolioService คำนวณสรุป
      const result = await this.portfolioService.getPortfolioDetails(
        userId,
        id,
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
      // ในอนาคต Logic การรวบรวมตัวเลข NAV ควรทำใน Service ก่อนส่งมาที่นี่
      const snapshot = await this.portfolioService.createSnapshot(id, req.body);

      return res.status(201).json({
        success: true,
        data: snapshot
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'ไม่สามารถบันทึก Snapshot ได้' });
    }
  };
}