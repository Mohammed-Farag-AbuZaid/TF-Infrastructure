import { Env, corsHeaders } from './_firebaseAdmin';

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('Origin'), env.ROOT_DOMAIN || 'tfunions.com'),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const rootDomain = env.ROOT_DOMAIN || 'tfunions.com';
  const respHeaders = new Headers({
    ...corsHeaders(request.headers.get('Origin'), rootDomain),
    'Content-Type': 'application/json',
  });

  respHeaders.append(
    'Set-Cookie',
    `tf_session=; HttpOnly; Secure; SameSite=Lax; Domain=.${rootDomain}; Path=/; Max-Age=0`
  );
  respHeaders.append(
    'Set-Cookie',
    `tf_user_hint=; Secure; SameSite=Lax; Domain=.${rootDomain}; Path=/; Max-Age=0`
  );

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: respHeaders,
  });
};

