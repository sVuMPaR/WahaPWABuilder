type RouteHandler = () => Promise<void>;

const routes = new Map<string, RouteHandler>();

export function route(path: string, handler: RouteHandler) {
  routes.set(path, handler);
}

export function navigate(path: string) {
  const full = path.startsWith('/') ? path : `/${path}`;
  window.location.hash = `#${full}`;
}

export function startRouter(fallback: RouteHandler) {
  const run = async () => {
    const hash = window.location.hash.replace(/^#/, '') || '/';
    const handler = routes.get(hash) ?? fallback;
    await handler();
  };

  window.addEventListener('hashchange', () => void run());
  void run();
}

export function parseFactionRoute(): string | null {
  const match = window.location.hash.match(/^#\/faction\/([^/]+)/);
  return match?.[1] ?? null;
}
