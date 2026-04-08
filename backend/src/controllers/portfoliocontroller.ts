import { Request, Response } from 'express';
import { PortfolioService } from '../services/portfolioservices';
import { AssetPriceService } from '../services/assetservices';
import { AuthRequest } from '../interface/auth/auth.types';



export class PortfolioController {
  // Constructor Injection: รับ Service เข้ามาผ่าน Constructor
  constructor(
    private portfolioService: PortfolioService,
    private assetService: AssetPriceService
  ) { }

  create = async (req: AuthRequest, res: Response) => {
    try {
      const userId =  req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const portfolio = await this.portfolioService.createPortfolio(userId, req.body);
      return res.status(201).json({ success: true, data: portfolio });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  getAll = async (req: AuthRequest, res: Response) => {
    try {
      const userId =  req.user?.userId;

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const portfolios = await this.portfolioService.getAllPortfolios(userId);
      return res.json({ success: true, data: portfolios });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'ไม่สามารถดึงข้อมูลพอร์ตได้' });
    }
  };

  getDetails = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;


      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Portfolio ID is required and must be a string"
        });
      }
      
      const userId =  req.user?.userId;

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const portfolioRaw = await this.portfolioService.getPortfolioById(userId, id);
      if (!portfolioRaw) return res.status(404).json({ success: false, message: "ไม่พบพอร์ต" });

      const symbols = portfolioRaw.positions.map(p => p.asset.symbol);
      const currentPrices = await this.assetService.getPrices(symbols);

      const fxRates: Record<string, number> = { THB: 1, USD: 36.5 };

      const result = this.portfolioService.calculatePortfolioDetails(portfolioRaw, currentPrices, fxRates);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  update = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Portfolio ID is required and must be a string"
        });
      }

      const userId =  req.user?.userId;

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const updated = await this.portfolioService.updatePortfolio(userId, id, req.body);
      return res.json({ success: true, data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'แก้ไขพอร์ตไม่สำเร็จ' });
    }
  };

  delete = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Portfolio ID is required and must be a string"
        });
      }

      const userId =  req.user?.userId;

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      await this.portfolioService.softDelete(userId, id);
      return res.json({ success: true, message: 'ลบพอร์ตเรียบร้อยแล้ว' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'ลบพอร์ตไม่สำเร็จ' });
    }
  };

  recordDividend = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Portfolio ID is required and must be a string"
        });
      }

      const userId =  req.user?.userId;

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const transaction = await this.portfolioService.recordDividend(userId, id, req.body);
      return res.status(201).json({ success: true, data: transaction });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  takeSnapshot = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Portfolio ID is required and must be a string"
        });
      }

      const userId =  req.user?.userId;

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const portfolioRaw = await this.portfolioService.getPortfolioById(userId, id);
      if (!portfolioRaw) return res.status(404).json({ message: 'Portfolio not found' });

      const symbols = portfolioRaw.positions.map(p => p.asset.symbol);
      const currentPrices = await this.assetService.getPrices(symbols);
      const fxRates = { THB: 1, USD: 36.5 };

      const snapshot = await this.portfolioService.createSnapshot(portfolioRaw, currentPrices, fxRates);
      return res.status(201).json({ success: true, data: snapshot });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };
}