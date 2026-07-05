import express from "express";
import { registerUser, loginUser, getMe } from "../controllers/authController.js";
import protect from "../middleware/authMiddleware.js";
import {validateRegister, validateLogin} from "../middleware/validateAuth.js";

const router = express.Router();

router.post("/register", validateRegister, registerUser);
router.post("/login", validateLogin, loginUser);
router.get("/me", protect, getMe);

export default router;