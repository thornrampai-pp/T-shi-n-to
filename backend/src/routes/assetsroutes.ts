import { Router } from 'express';
import { AssetController } from '../controllers/assetscontroller';
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();
const controller = new AssetController();



//  ดูรายการ Asset ทั้งหมดที่บันทึกไว้ในระบบ
router.get('/', controller.getAllAssets);

// 1. ค้นหาสินทรัพย์ (เช่น /api/assets/search?q=apple)
router.get('/search', controller.search);

// 2. ดึงราคาปัจจุบัน (เช่น /api/assets/price?symbol=AAPL หรือส่งเป็น Array ก็ได้ถ้าเราทำรองรับไว้)
router.get('/price', controller.getPrice);

router.post('/prices', controller.getMultiplePrices);

router.get('/:symbol/history', controller.getHistory);

router.get('/:symbol/dividends', controller.getDividends);



// 4. ดึงข้อมูลรายละเอียดของสินทรัพย์รายตัว (GET /api/assets/AAPL)
// ตัวนี้ต้องไว้ล่างสุด เพราะ :symbol จะดักจับทุกอย่างที่พิมพ์หลัง /assets/
router.get('/:symbol', controller.getAsset);


// 3. สร้างหรือดึงข้อมูลสินทรัพย์จาก Symbol (POST /api/assets)
// Body: { "symbol": "AAPL" } หรือ { "symbols": ["AAPL", "TSLA"] }
router.post('/', controller.createAsset);

export default router;