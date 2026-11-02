// public/sw.js runs as a plain script; here it is loaded once into a fake
// service-worker global (self / caches / fetch / location) so its caching
// rules can be exercised: only successful responses are stored, the offline
// shell is keyed by "/" (never "/index.html", which the host redirects), and
// old cache versions are dropped on activate.

import type { Mock } from "vitest";

type Listener = (event: FakeFetchEvent | FakeExtendableEvent) => void;
type FetchFn = (input: string | FakeRequest, init?: RequestInit) => Promise<Response>;

class FakeExtendableEvent {
  waited: Promise<unknown> | null = null;
  waitUntil(p: Promise<unknown>): void {
    this.waited = p;
  }
}

// Node's Request rejects mode "navigate", so the handler gets the plain
// shape it reads (url / method / mode) instead.
interface FakeRequest {
  url: string;
  method: string;
  mode: string;
}

class FakeFetchEvent extends FakeExtendableEvent {
  response: Promise<Response> | null = null;
  constructor(readonly request: FakeRequest) {
    super();
  }
  respondWith(p: Promise<Response>): void {
    this.response = p;
  }
}

class FakeCache {
  readonly store = new Map<string, Response>();
  constructor(private readonly fetchImpl: typeof fetch) {}
  async addAll(urls: string[]): Promise<void> {
    for (const url of urls) {
      const res = await this.fetchImpl(new URL(url, ORIGIN).href);
      if (!res.ok) throw new TypeError(`addAll: ${url} -> ${res.status}`);
      await this.put(url, res);
    }
  }
  async put(key: string | FakeRequest, res: Response): Promise<void> {
    this.store.set(toUrl(key), res);
  }
  async match(key: string | FakeRequest): Promise<Response | undefined> {
    return this.store.get(toUrl(key));
  }
}

const ORIGIN = "https://lumen-bloom.example";

function toUrl(key: string | FakeRequest): string {
  return typeof key === "string" ? new URL(key, ORIGIN).href : key.url;
}
const listeners = new Map<string, Listener>();
const cacheStore = new Map<string, FakeCache>();
let fetchMock: Mock<FetchFn>;

function cacheOf(name: string): FakeCache {
  let c = cacheStore.get(name);
  if (!c) {
    c = new FakeCache((input, init) => fetchMock(input as string, init));
    cacheStore.set(name, c);
  }
  return c;
}

function html(body = "<!doctype html>", status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html" } });
}

async function navigate(path: string): Promise<Response> {
  const event = new FakeFetchEvent({ url: ORIGIN + path, method: "GET", mode: "navigate" });
  listeners.get("fetch")!(event);
  return event.response!;
}

async function get(url: string): Promise<Response | null> {
  const event = new FakeFetchEvent({ url, method: "GET", mode: "cors" });
  listeners.get("fetch")!(event);
  return event.response;
}

beforeAll(async () => {
  fetchMock = vi.fn(async () => html());
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", new URL(ORIGIN + "/sw.js"));
  vi.stubGlobal("caches", {
    open: async (name: string) => cacheOf(name),
    keys: async () => [...cacheStore.keys()],
    delete: async (name: string) => cacheStore.delete(name),
    match: async (key: string | FakeRequest) => {
      for (const c of cacheStore.values()) {
        const hit = await c.match(key);
        if (hit) return hit;
      }
      return undefined;
    },
  });
  vi.stubGlobal("self", {
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  });
  // @ts-expect-error -- a plain service-worker script with no type declarations
  await import("../public/sw.js");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  cacheStore.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => html());
});

function shellCache(): FakeCache {
  const [name] = [...cacheStore.keys()].filter((k) => k.startsWith("lumen-bloom-"));
  expect(name, "versioned cache name").toBeDefined();
  return cacheStore.get(name)!;
}

describe("public/sw.js", () => {
  it("precaches the shell under '/' and never requests '/index.html'", async () => {
    const event = new FakeExtendableEvent();
    listeners.get("install")!(event);
    await event.waited;
    const requested = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(requested).toContain(ORIGIN + "/");
    expect(requested.some((u) => u.endsWith("/index.html"))).toBe(false);
    expect(await shellCache().match("/")).toBeDefined();
  });

  it("drops caches from older versions on activate", async () => {
    cacheOf("lumen-bloom-v2");
    const install = new FakeExtendableEvent();
    listeners.get("install")!(install);
    await install.waited;
    const activate = new FakeExtendableEvent();
    listeners.get("activate")!(activate);
    await activate.waited;
    expect(cacheStore.has("lumen-bloom-v2")).toBe(false);
    expect(cacheStore.size).toBe(1);
  });

  it("serves navigations network-first and refreshes the shell on success", async () => {
    const install = new FakeExtendableEvent();
    listeners.get("install")!(install);
    await install.waited;
    fetchMock.mockImplementation(async () => html("<!doctype html><!-- new deploy -->"));
    const res = await navigate("/?obj=rose");
    expect(await res.text()).toContain("new deploy");
    await Promise.resolve();
    expect(await (await shellCache().match("/"))!.text()).toContain("new deploy");
  });

  it("does not let a 404 or 5xx navigation replace the shell", async () => {
    const install = new FakeExtendableEvent();
    listeners.get("install")!(install);
    await install.waited;
    for (const status of [404, 500]) {
      fetchMock.mockImplementation(async () => html("error page", status));
      const res = await navigate("/missing");
      expect(res.status).toBe(status);
      await Promise.resolve();
      expect(await (await shellCache().match("/"))!.clone().text()).toBe("<!doctype html>");
    }
  });

  it("falls back to the cached shell when a navigation fails offline", async () => {
    const install = new FakeExtendableEvent();
    listeners.get("install")!(install);
    await install.waited;
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const res = await navigate("/");
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe("<!doctype html>");
  });

  it("caches same-origin GETs only when they succeed, and ignores other origins", async () => {
    cacheOf("lumen-bloom-v3");
    fetchMock.mockImplementation(async () => new Response("css", { status: 500 }));
    await (await get(ORIGIN + "/assets/a.css"))!;
    await Promise.resolve();
    expect(await shellCache().match(ORIGIN + "/assets/a.css")).toBeUndefined();

    fetchMock.mockImplementation(async () => new Response("css", { status: 200 }));
    await (await get(ORIGIN + "/assets/a.css"))!;
    await Promise.resolve();
    expect(await shellCache().match(ORIGIN + "/assets/a.css")).toBeDefined();

    expect(await get("https://api.open-meteo.com/v1/forecast")).toBeNull();
  });
});
