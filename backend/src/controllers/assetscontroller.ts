import { Request, Response } from 'express';
import { AssetPriceService } from '../serviece/assetservice';

export class AssetController {
  private assetService = new AssetPriceService();

  getPrice = async (req: Request, res: Response) => {
    try {
      const symbol = (req.query.symbol || req.params.symbol) as string;
      if (!symbol || typeof symbol !== 'string') return res.status(400).json({ message: 'Symbol required' });

      const price = await this.assetService.getPrice(symbol);
      return res.json({ symbol: symbol.toUpperCase(), price });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch price' });
    }
  };

  getMultiplePrices = async (req: Request, res: Response) => {
    try {
      const { symbols } = req.body;
      if (!Array.isArray(symbols)) return res.status(400).json({ message: 'Symbols must be array' });

      const prices = await Promise.all(
        symbols.map(async (s: string) => ({
          symbol: s.toUpperCase(),
          price: await this.assetService.getPrice(s).catch(() => null)
        }))
      );
      return res.json({ data: prices });
    } catch (error) { return res.status(500).json({ message: 'Failed' }); }
  };

  createAsset = async (req: Request, res: Response) => {
    try {
      const { symbol, symbols } = req.body;
      const result = Array.isArray(symbols)
        ? await this.assetService.getOrCreateAssets(symbols)
        : await this.assetService.getOrCreateAsset(symbol as string);
      return res.status(201).json({ data: result });
    } catch (error) { return res.status(500).json({ message: 'Error' }); }
  };

  getAsset = async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      if (!symbol || typeof symbol !== 'string') return res.status(400).json({ message: 'Invalid symbol' });
      const asset = await this.assetService.getOrCreateAsset(symbol);
      return res.json({ data: asset });
    } catch (error) { return res.status(500).json({ message: 'Error' }); }
  };

  getAllAssets = async (req: Request, res: Response) => {
    const assets = await this.assetService.getAllAssets();
    return res.json({ data: assets });
  };

  // AssetController.ts
  getHistory = async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      // ดึงค่าจาก Body แทน
      const { period, interval } = req.body;

      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ message: 'Symbol is required' });
      }

      // ส่งค่าไปยัง Service (ถ้าไม่ได้ส่งมาใน Body จะใช้ค่า Default ที่ตั้งไว้ใน Service)
      const history = await this.assetService.getHistory(symbol, period, interval);

      return res.json({ data: history });
    } catch (error: any) {
      return res.status(500).json({ message: 'Error', error: error.message });
    }
  };

  search = async (req: Request, res: Response) => {
    const { q } = req.query;
    const results = await this.assetService.search(q as string);
    return res.json({ data: results });
  };

  getDividends = async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;

      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({
          message: 'Symbol is required'
        });
      }

      // เรียกใช้งาน Service ที่เราเพิ่งเขียนเพิ่มไป
      const dividends = await this.assetService.getDividends(symbol);

      return res.json({
        success: true,
        data: dividends
      });
    } catch (error: any) {
      console.error(`[AssetController] getDividends Error for ${req.params.symbol}:`, error);

      // กรณีหา Symbol ไม่เจอหรือ Yahoo Error
      return res.status(500).json({
        message: 'Failed to fetch dividend data',
        error: error.message
      });
    }
  };

  
}