import { NextRequest, NextResponse } from "next/server";
import { AppError } from "./errors";
import { requestId } from "./util";
import { ensureLoaded } from "./store";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/** Wraps route handlers: hydrates demo state (serverless-safe), then uniform error contract (400/403/404/409 with request id; 500 sanitized). */
export function route<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    const rid = requestId();
    try {
      await ensureLoaded();
      return await fn(...args);
    } catch (e) {
      if (e instanceof AppError) {
        return NextResponse.json({ error: e.message, requestId: rid }, { status: e.status });
      }
      console.error(`[aiia] ${rid}`, e);
      return NextResponse.json(
        { error: "Unable to process the request.", requestId: rid },
        { status: 500 }
      );
    }
  };
}

export async function body<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError(400, "Invalid JSON body.");
  }
}

export function str(v: unknown, field: string, opts: { required?: boolean; max?: number } = {}): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (opts.required && !s) throw new AppError(400, `Field "${field}" is required.`);
  if (opts.max && s.length > opts.max) throw new AppError(400, `Field "${field}" exceeds ${opts.max} characters.`);
  return s;
}

export function num(v: unknown, field: string, opts: { required?: boolean; min?: number; max?: number } = {}): number | null {
  if (v === null || v === undefined || v === "") {
    if (opts.required) throw new AppError(400, `Field "${field}" is required.`);
    return null;
  }
  const n = Number(v);
  if (Number.isNaN(n)) throw new AppError(400, `Field "${field}" must be a number.`);
  if (opts.min !== undefined && n < opts.min) throw new AppError(400, `Field "${field}" must be ≥ ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw new AppError(400, `Field "${field}" must be ≤ ${opts.max}.`);
  return n;
}

export function isDate(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
