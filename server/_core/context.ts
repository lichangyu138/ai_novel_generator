import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";
import * as jose from "jose";
import * as db from "../db";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Parse cookies from request
function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    if (name && rest.length > 0) {
      cookies.set(name.trim(), rest.join('=').trim());
    }
  });
  return cookies;
}

// Verify local JWT token
async function verifyLocalToken(token: string): Promise<{ userId: number; username: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    if (payload.userId && payload.username) {
      return {
        userId: payload.userId as number,
        username: payload.username as string,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const cookies = parseCookies(opts.req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    
    if (sessionCookie) {
      // First try local JWT authentication
      const localSession = await verifyLocalToken(sessionCookie);
      if (localSession) {
        user = await db.getUserById(localSession.userId);
      }
      
      // If local auth failed, try Manus OAuth (for backward compatibility)
      if (!user) {
        try {
          user = await sdk.authenticateRequest(opts.req);
        } catch {
          // OAuth also failed, user remains null
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
