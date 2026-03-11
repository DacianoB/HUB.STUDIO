import { NextResponse } from "next/server";

import { authenticateLocalUser } from "~/server/auth/local-auth";
import {
  createLocalDatabaseSession,
  getSessionCookieDefinition,
} from "~/server/auth/local-session";

function resolveSafeCallbackUrl(request: Request, value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "/";
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const requestUrl = new URL(request.url);
    const callbackUrl = new URL(value, request.url);

    if (callbackUrl.origin === requestUrl.origin) {
      return `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
    }
  } catch {}

  return "/";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        email?: string;
        password?: string;
        callbackUrl?: string;
      }
    | null;

  const authResult = await authenticateLocalUser({
    email: body?.email,
    password: body?.password,
  });

  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: authResult.code,
        message: authResult.message,
      },
      { status: 401 },
    );
  }

  const { sessionToken, expires } = await createLocalDatabaseSession(authResult.user.id);
  const callbackUrl = resolveSafeCallbackUrl(request, body?.callbackUrl);
  const response = NextResponse.json({
    ok: true,
    url: callbackUrl,
  });
  const sessionCookie = getSessionCookieDefinition(request.url);

  response.cookies.set({
    name: sessionCookie.name,
    value: sessionToken,
    expires,
    httpOnly: sessionCookie.options.httpOnly,
    sameSite: sessionCookie.options.sameSite,
    path: sessionCookie.options.path,
    secure: sessionCookie.options.secure,
  });

  return response;
}
