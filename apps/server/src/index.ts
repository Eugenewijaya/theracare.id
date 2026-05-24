import app, { ensureAppReady } from "./app.js";

const PORT = process.env.PORT || 3000;
const isVercelRuntime = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);

export default app;

if (!isVercelRuntime) {
  ensureAppReady()
    .then(() => {
      app.listen(PORT, () => {
        console.log("\nTheraCare API Server");
        console.log(`   Local:  http://localhost:${PORT}`);
        console.log(`   Health: http://localhost:${PORT}/api/health`);
        console.log(`   Auth:   http://localhost:${PORT}/api/auth\n`);
      });
    })
    .catch((error) => {
      console.error("[server] failed to start", error);
      process.exit(1);
    });
}
