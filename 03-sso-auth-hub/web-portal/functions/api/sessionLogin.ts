import {
  Env,
  corsHeaders,
  getGoogleAccessToken,
  decodeJwtPayload,
} from './_firebaseAdmin';

const FOURTEEN_DAYS_SEC = 1209600;

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('Origin'), env.ROOT_DOMAIN || 'tfunions.org'),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const rootDomain = env.ROOT_DOMAIN || 'tfunions.org';
  const headers = {
    ...corsHeaders(request.headers.get('Origin'), rootDomain),
    'Content-Type': 'application/json',
  };

  try {
    const body = (await request.json()) as {
      idToken?: string;
      onboardingProfile?: {
        fullName?: string;
        governorate?: string;
        educationSystem?: string;
        gradeOrYear?: string;
        interests?: string[];
      };
    };

    if (!body?.idToken) {
      return new Response(JSON.stringify({ error: 'Missing idToken' }), { status: 400, headers });
    }

    // 1. Exchange Firebase ID Token for a 14-day Session Cookie via Identity Toolkit Admin REST API
    const accessToken = await getGoogleAccessToken(env);
    const sessionRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}:createSessionCookie`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: body.idToken,
          validDuration: String(FOURTEEN_DAYS_SEC),
        }),
      }
    );

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      return new Response(
        JSON.stringify({ error: 'Failed to verify idToken or mint session cookie', details: errText }),
        { status: 401, headers }
      );
    }

    const { sessionCookie } = (await sessionRes.json()) as { sessionCookie: string };
    const claims = decodeJwtPayload(body.idToken);

    const uid: string = claims.user_id || claims.sub;
    const name: string =
      body.onboardingProfile?.fullName ||
      claims.name ||
      (claims.email ? claims.email.split('@')[0] : 'TF Student');
    const role: string = claims.role || 'student';

    // 2. If onboardingProfile is provided (new registration), asynchronously trigger n8n Workflow #1
    if (body.onboardingProfile && env.N8N_ONBOARD_WEBHOOK_URL) {
      waitUntil(
        fetch(env.N8N_ONBOARD_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-TF-Webhook-Secret': env.N8N_WEBHOOK_SECRET || '',
          },
          body: JSON.stringify({
            uid,
            fullName: name,
            email: claims.email || '',
            governorate: body.onboardingProfile.governorate || 'Cairo',
            educationSystem: body.onboardingProfile.educationSystem || 'STEM',
            gradeOrYear: body.onboardingProfile.gradeOrYear || 'G11',
            interests: body.onboardingProfile.interests || ['scholarships'],
          }),
        }).catch(() => {})
      );
    }

    // 3. Construct root-domain cookies (.tfunions.org)
    const userHintJson = encodeURIComponent(JSON.stringify({ uid, name, role }));
    const sessionCookieHeader = `tf_session=${sessionCookie}; HttpOnly; Secure; SameSite=Lax; Domain=.${rootDomain}; Path=/; Max-Age=${FOURTEEN_DAYS_SEC}`;
    const hintCookieHeader = `tf_user_hint=${userHintJson}; Secure; SameSite=Lax; Domain=.${rootDomain}; Path=/; Max-Age=${FOURTEEN_DAYS_SEC}`;

    const respHeaders = new Headers(headers);
    respHeaders.append('Set-Cookie', sessionCookieHeader);
    respHeaders.append('Set-Cookie', hintCookieHeader);

    return new Response(
      JSON.stringify({ ok: true, user: { uid, name, role } }),
      { status: 200, headers: respHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal SSO error' }),
      { status: 500, headers }
    );
  }
};
