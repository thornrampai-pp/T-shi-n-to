import { Router } from "express";
import { AuthController } from "../controllers/authcontroller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/logout", authMiddleware, AuthController.logout);

export default router;