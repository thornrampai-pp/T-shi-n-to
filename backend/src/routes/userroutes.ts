import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { UserController } from "../controllers/usercontroller";

const router = Router();

router.get("/me", authMiddleware, UserController.getProfile);
router.patch("/me", authMiddleware, UserController.updateProfile);
router.patch("/change-password", authMiddleware, UserController.changeMyPassword);
router.delete("/me", authMiddleware, UserController.deleteMe);

export default router;