import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The portal is served under a path prefix rather than its own subdomain, which avoids
// needing a DNS record and a second certificate. A reverse proxy strips the prefix before
// forwarding, but the built assets must still carry it in the HTML, hence `base`.
export default defineConfig({
  base: "/monitor/",
  plugins: [react()],
  server: { port: 5173 },
});
