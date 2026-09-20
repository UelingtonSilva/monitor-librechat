import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The portal is served under a path prefix rather than its own subdomain, which avoids
// needing a DNS record and a second certificate. A reverse proxy strips the prefix before
// forwarding, but the built assets must still carry it in the HTML, hence `base`.
export default defineConfig({
  base: "/monitor/",
  plugins: [react()],
  server: {
    port: 5173,
    // In dev, the Portal (5173) and the API (4000) are different origins, and the API
    // registers CORS as `origin: false` on purpose — production serves both from the same
    // origin, so there is no legitimate cross-origin caller to allow. Proxying here, instead
    // of relaxing CORS, means local dev exercises the exact request path production uses
    // (relative, same-origin) without ever loosening the API's own security posture.
    proxy: {
      "/monitor/api/v1": {
        target: "http://localhost:4000",
        rewrite: (path) => path.replace(/^\/monitor\/api\/v1/, "/api/v1"),
      },
    },
  },
});
