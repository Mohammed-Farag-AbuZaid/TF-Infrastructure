// Starring opportunities. Mirrors the Flutter app: a signed-in student toggles
// ratingCount / voters on opportunities/{id}. Firebase is loaded only on first click.
const FIREBASE_VERSION = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
const firebaseConfig = {
  apiKey: 'AIzaSyB0bILaWHg8QXuwl3Fhfht3BQnYLgTkWUk',
  appId: '1:879703010053:web:1fe4e4476ab1680a67a56c',
  messagingSenderId: '879703010053',
  projectId: 'tf-unions',
  authDomain: 'tf-unions.firebaseapp.com',
  storageBucket: 'tf-unions.firebasestorage.app',
};

interface Ctx {
  auth: any;
  db: any;
  fs: any;
  authMod: any;
}
let ctxPromise: Promise<Ctx> | null = null;

function toast(msg: string) {
  const el = document.getElementById('tf-toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.classList.remove('hidden');
  window.clearTimeout((toast as any)._t);
  (toast as any)._t = window.setTimeout(() => {
    el.hidden = true;
    el.classList.add('hidden');
  }, 3500);
}

function load(): Promise<Ctx> {
  if (!ctxPromise) {
    ctxPromise = (async () => {
      const [app, authMod, fs] = await Promise.all([
        import(/* @vite-ignore */ `${CDN}/firebase-app.js`),
        import(/* @vite-ignore */ `${CDN}/firebase-auth.js`),
        import(/* @vite-ignore */ `${CDN}/firebase-firestore.js`),
      ]);
      const a = app.initializeApp(firebaseConfig, 'tf-news');
      return { auth: authMod.getAuth(a), db: fs.getFirestore(a), fs, authMod };
    })();
  }
  return ctxPromise;
}

async function ensureUser(ctx: Ctx) {
  await ctx.auth.authStateReady?.();
  if (ctx.auth.currentUser) return ctx.auth.currentUser;
  const provider = new ctx.authMod.GoogleAuthProvider();
  const cred = await ctx.authMod.signInWithPopup(ctx.auth, provider);
  return cred.user;
}

async function toggle(btn: HTMLButtonElement) {
  if (btn.dataset.busy === '1') return;
  const id = btn.dataset.star;
  if (!id) return;
  btn.dataset.busy = '1';
  try {
    const ctx = await load();
    const user = await ensureUser(ctx);
    const { doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove } = ctx.fs;
    const ref = doc(ctx.db, 'opportunities', id);
    const snap = await getDoc(ref);
    const voters: string[] = (snap.exists() && snap.data().voters) || [];
    const voted = voters.includes(user.uid);
    if (voted) {
      await updateDoc(ref, { ratingCount: increment(-1), voters: arrayRemove(user.uid) });
    } else {
      await updateDoc(ref, { ratingCount: increment(1), voters: arrayUnion(user.uid) });
    }
    const countEl = btn.querySelector<HTMLElement>('[data-star-count]');
    const current = Number(countEl?.textContent || 0);
    const next = Math.max(0, current + (voted ? -1 : 1));
    if (countEl) countEl.textContent = String(next);
    btn.setAttribute('aria-pressed', String(!voted));
    btn.classList.toggle('text-tf-signal', !voted);
    document.querySelectorAll<HTMLElement>(`[data-star="${id}"] [data-star-count]`).forEach((e) => (e.textContent = String(next)));
  } catch (e: any) {
    const code = e?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      toast('Sign-in was cancelled.');
    } else if (code === 'auth/unauthorized-domain') {
      toast('This domain is not authorised for sign-in yet.');
    } else if (code === 'auth/popup-blocked') {
      toast('Your browser blocked the sign-in window. Allow pop-ups and try again.');
    } else {
      toast('Could not register your star. Try again.');
    }
  } finally {
    btn.dataset.busy = '0';
  }
}

document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-star]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  toggle(btn);
});
