#!/usr/bin/env node
/**
 * Generates the ADMIN_PASSWORD_HASH value for the Monitor's single login.
 *
 * There is no signup flow and no default password: this is the only way to produce a
 * value the Monitor will accept, so it has to exist before the first deploy, not be
 * discovered by trial and error. Usage:
 *
 *   npm run hash-password -- "your-password-here"
 *
 * The password itself is never printed back or logged — only the resulting hash, which
 * is what goes into ADMIN_PASSWORD_HASH (env var, Secret Manager, docker-compose .env).
 */
import { hashPassword } from "../auth.js";

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run hash-password -- "your-password-here"');
  process.exit(1);
}

console.log(hashPassword(password));
