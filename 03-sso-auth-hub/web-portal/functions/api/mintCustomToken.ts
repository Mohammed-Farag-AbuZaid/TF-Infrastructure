import {
  Env,
  corsHeaders,
  parseCookies,
  decodeJwtPayload,
  signJwtRS256,
  getGoogleAccessToken,
} from './_firebaseAdmin';

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('Origin'), env.ROOT_DOMAIN || 'tfunions.org'),
  });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const rootDomain = env.ROOT_DOMAIN || 'tfunions.org';
  const headers = {
    ...corsHeaders(request.headers.get('Origin'), rootDomain),
    'Content-Type': 'application/json',
  };

  try {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const sessionCookie = cookies['tf_session'];

    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: 'No active tf_session cookie' }), {
        status: 401,
        headers,
      });
    }

    // 1. Decode & validate session cookie expiration and audience
    const decoded = decodeJwtPayload(sessionCookie);
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.sub || (decoded.exp && decoded.exp < now)) {
      return new Response(JSON.stringify({ error: 'Session cookie expired' }), {
        status: 401,
        headers,
      });
    }

    // 2. Verify user is still active (not disabled/revoked) in Firebase Auth
    const accessToken = await getGoogleAccessToken(env);
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:lookup`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ localId: [decoded.sub] }),
      }
    );

    if (!lookupRes.ok) {
      return new Response(JSON.stringify({ error: 'Account lookup failed' }), {
        status: 401,
        headers,
      });
    }

    const lookupData = (await lookupRes.json()) as { users?: Array<{ localId: string; disabled?: boolean; customAttributes?: string }> };
    const userRecord = lookupData.users?.[0];
    if (!userRecord || userRecord.disabled) {
      return new Response(JSON.stringify({ error: 'User disabled or not found' }), {
        status: 403,
        headers,
      });
    }

    const customClaims = userRecord.customAttributes
      ? JSON.parse(userRecord.customAttributes)
      : { role: decoded.role || 'student' };

    // 3. Mint a short-lived Firebase Custom Token signed by Service Account RS256 key
    const customToken = await signJwtRS256(
      {
        iss: env.FIREBASE_CLIENT_EMAIL,
        sub: env.FIREBASE_CLIENT_EMAIL,
        aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
        iat: now,
        exp: now + 3600,
        uid: userRecord.localId,
        claims: customClaims,
      },
      env.FIREBASE_PRIVATE_KEY
    );

    return new Response(
      JSON.stringify({
        ok: true,
        uid: userRecord.localId,
        customToken,
        claims: customClaims,
      }),
      { status: 200, headers }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to mint custom token' }),
      { status: 500, headers }
    );
  }
};
