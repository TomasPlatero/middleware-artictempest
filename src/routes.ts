import { Router } from "express";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import characterRoutes from "./routes/characters";

const router = Router({ mergeParams: true }); // 🔹 Asegurar que los params se mantengan

// ✅ Definir rutas correctamente
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/characters", characterRoutes);

export default router;
