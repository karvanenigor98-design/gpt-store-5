type GrantOk = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

function abortSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

/** Same-origin CF/Vercel proxy → GoTrue, без supabase.co из браузера. */
export async function gptBrowserPasswordGrant(
  email: string,
  password: string,
): Promise<GrantOk | null> {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!anon) return null;
  try {
    const res = await fetch("/__sb-auth/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ email, password }),
      signal: abortSignal(12_000),
    });
    const json = (await res.json().catch(() => ({}))) as GrantOk & {
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !json.access_token || !json.refresh_token) {
      if (res.status === 400 || res.status === 401 || res.status === 429) {
        throw Object.assign(new Error("invalid_credentials"), { status: res.status });
      }
      return null;
    }
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: json.expires_at,
    };
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) throw err;
    return null;
  }
}
