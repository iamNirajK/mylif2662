import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { apiRouter } from "./src/server/routes.ts";
import { attachVoiceWebSocketServer } from "./src/server/voiceService.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === "production";
  const PORT = isProd ? Number(process.env.PORT) || 3000 : 3000;

  app.use(cors());
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Mount API routes
  app.use("/api", apiRouter);

  const httpServer = http.createServer(app);

  // Attach Real-Time Two-Way Voice WebSocket (/ws/voice)
  attachVoiceWebSocketServer(httpServer);

  if (!isProd) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: { server: httpServer },
        watch: null,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static build assets in production
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));

    // Fallback to index.html for SPA routing
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`JIYA Full-Stack Server running on port ${PORT} (${isProd ? "production" : "development"})`);
  });
}

startServer();
