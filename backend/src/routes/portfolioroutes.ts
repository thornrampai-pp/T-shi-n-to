import { Router } from 'express';
import { PortfolioController } from '../controllers/portfoliocontroller';
// import { authMiddleware } from '../middlewares/auth.middleware'; // สมมติว่าคุณมี middleware นี้

const router = Router();
const portfolioController = new PortfolioController();

// ทุก Route ในนี้ควรผ่านการตรวจสอบสิทธิ์ (Authentication)
// router.use(authMiddleware); 

/**
 * @route   GET /api/portfolios
 * @desc    ดึงรายการพอร์ตทั้งหมดของผู้ใช้
 */
router.get('/', portfolioController.getAll);

/**
 * @route   POST /api/portfolios
 * @desc    สร้างพอร์ตการลงทุนใหม่
 */
router.post('/', portfolioController.create);

/**
 * @route   GET /api/portfolios/:id
 * @desc    ดึงข้อมูลพอร์ตแบบละเอียด (พร้อมราคาสดและกำไร)
 */
router.get('/:id', portfolioController.getDetails);

/**
 * @route   PATCH /api/portfolios/:id
 * @desc    แก้ไขข้อมูลพอร์ต (เช่น เปลี่ยนชื่อ)
 */
router.patch('/:id', portfolioController.update);

/**
 * @route   DELETE /api/portfolios/:id
 * @desc    ลบพอร์ต (Soft Delete)
 */
router.delete('/:id', portfolioController.delete);

/**
 * @route   POST /api/portfolios/:id/dividend
 * @desc    บันทึกเงินปันผลเข้าพอร์ต
 */
router.post('/:id/dividend', portfolioController.recordDividend);

/**
 * @route   POST /api/portfolios/:id/snapshot
 * @desc    บันทึกมูลค่าพอร์ตประจำวัน (NAV Snapshot)
 */

router.post('/:id/snapshot', portfolioController.takeSnapshot);

export default router;