import { Router } from 'express';
import { PortfolioController } from '../controllers/portfoliocontroller';
import { PortfolioService } from '../services/portfolioservices';
import { AssetPriceService } from '../services/assetservices';
// import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * 🛠️ การประกอบร่าง (Manual Dependency Injection)
 * เราต้องสร้างก้อน Service ขึ้นมาก่อน แล้วค่อย "ฉีด" เข้าไปใน Controller
 */
const portfolioService = new PortfolioService();
const assetService = new AssetPriceService();

// ส่ง service ทั้งสองตัวเข้าไปใน constructor ตามที่เขียนไว้ใน Class
const portfolioController = new PortfolioController(portfolioService, assetService);

// router.use(authMiddleware); 

/**
 * @route   GET /api/portfolios
 */
router.get('/',(req,res)=> portfolioController.getAll);

/**
 * @route   POST /api/portfolios
 */
router.post('/',(req,res)=> portfolioController.create);

/**
 * @route   GET /api/portfolios/:id
 */
router.get('/:id', (req, res) => portfolioController.getDetails);

/**
 * @route   PATCH /api/portfolios/:id
 */
router.patch('/:id', (req, res) => portfolioController.update);

/**
 * @route   DELETE /api/portfolios/:id
 */
router.delete('/:id', (req, res) => portfolioController.delete);

/**
 * @route   POST /api/portfolios/:id/dividend
 */
router.post('/:id/dividend', (req, res) => portfolioController.recordDividend);

/**
 * @route   POST /api/portfolios/:id/snapshot
 */
router.post('/:id/snapshot', (req, res) => portfolioController.takeSnapshot);

export default router;