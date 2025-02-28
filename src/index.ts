import express, { Application, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import prisma from "./prisma";
import routes from "./routes"; // Importa todas las rutas desde `routes.ts`

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// 🔹 Configurar CORS correctamente
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);

// 🔹 Middleware global para manejar JSON
app.use(express.json());

// 🔹 Usar todas las rutas desde `routes.ts`
app.use("/api", routes);

console.log("🔹 Rutas registradas en Express:");
routes.stack.forEach((layer: any) => {
  if (layer.route) {
    console.log(`✅ ${layer.route.path}`);
  } else if (layer.name === "router" && layer.handle.stack) {
    layer.handle.stack.forEach((nested: any) => {
      console.log(`🔹 ${nested.route?.path || "Middleware (sin ruta asignada)"}`);
    });
  }
});

// 🔹 Middleware para manejar rutas no encontradas
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// 🔹 Middleware global para manejo de errores
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error("❌ Error:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

// 🔹 Iniciar servidor
const server = app
  .listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  })
  .on("error", (err) => {
    console.error("❌ Error al iniciar el servidor:", err);
    process.exit(1);
  });

// 🔹 Manejo de cierre seguro del servidor
const shutdown = async () => {
  console.log("🛑 Apagando servidor...");
  try {
    await prisma.$disconnect();
    server.close(() => {
      console.log("✅ Servidor cerrado correctamente.");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Error al cerrar Prisma:", error);
    process.exit(1);
  }
};

// 🔹 Captura de señales del sistema para apagar el servidor correctamente
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
