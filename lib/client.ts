"use client";

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T & { error?: string; requestId?: string };
}

export async function callApi(url: string, method = "POST", body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: Record<string, unknown> = {};
    try {
      data = await res.json();
    } catch {
      /* non-JSON */
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network error — is the demo server running?" } };
  }
}
