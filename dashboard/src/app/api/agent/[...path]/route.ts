import { NextRequest, NextResponse } from "next/server";

const AGENT_API = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001";
const API_KEY = process.env.VIGIL_API_KEY || process.env.NEXT_PUBLIC_VIGIL_API_KEY;

// In-memory rate limiter for proxy
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 120;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

async function handleRequest(req: NextRequest, method: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const path = req.nextUrl.pathname.replace("/api/agent/", "");
    const search = req.nextUrl.search;
    const headers: Record<string, string> = {};
    if (API_KEY) headers["x-api-key"] = API_KEY;

    let res: Response;
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      const body = await req.json();
      res = await fetch(`${AGENT_API}/${path}`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
    } else if (path === "events") {
      res = await fetch(`${AGENT_API}/${path}${search}`, { headers });
      return new Response(res.body, {
        status: res.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      res = await fetch(`${AGENT_API}/${path}${search}`, { headers });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  return handleRequest(req, "POST");
}

export async function GET(req: NextRequest) {
  return handleRequest(req, "GET");
}
