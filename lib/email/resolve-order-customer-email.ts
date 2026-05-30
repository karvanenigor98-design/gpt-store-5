/** Email покупателя для transactional писем (login → order fields). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeCustomerEmail(raw: string | null | undefined): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return null;
  return email;
}

export function resolveOrderCustomerEmail(fallbacks: {
  profileEmail?: string | null;
  customerEmail?: string | null;
  accountEmail?: string | null;
}): string | null {
  return (
    normalizeCustomerEmail(fallbacks.profileEmail) ??
    normalizeCustomerEmail(fallbacks.customerEmail) ??
    normalizeCustomerEmail(fallbacks.accountEmail)
  );
}

type EmailLookupClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => PromiseLike<{ data: { email?: string | null } | null }>;
      };
    };
  };
  auth: {
    admin: {
      getUserById: (id: string) => PromiseLike<{ data: { user?: { email?: string | null } | null } }>;
    };
  };
};

export async function resolveGptOrderCustomerEmail(params: {
  supabase: unknown;
  userId: string | null | undefined;
  accountEmail?: string | null;
}): Promise<string | null> {
  const supabase = params.supabase as EmailLookupClient;
  let profileEmail: string | null = null;

  if (params.userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", params.userId)
      .maybeSingle();
    profileEmail = profile?.email ?? null;

    if (!normalizeCustomerEmail(profileEmail)) {
      try {
        const { data: authData } = await supabase.auth.admin.getUserById(params.userId);
        profileEmail = authData.user?.email ?? null;
      } catch {
        /* auth lookup optional */
      }
    }
  }

  return resolveOrderCustomerEmail({
    profileEmail,
    accountEmail: params.accountEmail,
  });
}

export async function resolveSubsOrderCustomerEmail(params: {
  subsAdmin: unknown;
  userId: string | null | undefined;
  customerEmail?: string | null;
  accountEmail?: string | null;
}): Promise<string | null> {
  const subsAdmin = params.subsAdmin as EmailLookupClient;
  let profileEmail: string | null = null;

  if (params.userId) {
    try {
      const { data: authData } = await subsAdmin.auth.admin.getUserById(params.userId);
      profileEmail = authData.user?.email ?? null;
    } catch {
      /* optional */
    }
  }

  return resolveOrderCustomerEmail({
    profileEmail,
    customerEmail: params.customerEmail,
    accountEmail: params.accountEmail,
  });
}
