"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Scissors,
  ShoppingBag,
  BarChart3,
  Link2,
  Megaphone,
  Radio,
  ShieldCheck,
  Users,
  Package,
  MessageCircle,
  Settings,
  Search,
  Leaf,
  ChevronRight,
  LogOut,
  Bell,
  Menu,
  X,
  Plus,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import { AppContext, FormDialog, Avatar, type ModalSpec, type Row } from "./ui";
import { Feed, Cut } from "./content";
import { Shop, Orders, Seller } from "./shop";
import {
  Studio,
  Affiliate,
  Ads,
  Profile,
  Inbox,
  Partner,
  Admin,
} from "./workspace";
import Live from "./Live";
import { commandSender } from "../../lib/client-command";
async function request(path: string, body?: unknown) {
  const r = await fetch(
    `/api/${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const d = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(d.error ?? "Request failed"), {
      status: r.status,
    });
  return d;
}
const nav = [
  ["feed", "দেখো", "Discover", Play],
  ["cut", "কাট", "BDOS Cut", Scissors],
  ["shop", "কেনাকাটা", "Shop", ShoppingBag],
  ["live", "লাইভ", "LIVE", Radio],
  ["studio", "স্টুডিও", "Creator Studio", BarChart3],
  ["affiliate", "অ্যাফিলিয়েট", "Affiliate", Link2],
  ["seller", "বিক্রেতা কেন্দ্র", "Seller Center", Package],
  ["ads", "বিজ্ঞাপন", "Ads Manager", Megaphone],
  ["orders", "আমার অর্ডার", "My orders", ShoppingBag],
  ["inbox", "ইনবক্স", "Inbox", MessageCircle],
  ["profile", "নিরাপদ ও প্রোফাইল", "Profile & Nirapod", ShieldCheck],
  ["partner", "পার্টনার", "Partner Network", Users],
  ["admin", "অপারেশনস", "Operations", Settings],
] as const;
export default function Shell() {
  const [data, setData] = useState<Row | null>(null),
    [view, setView] = useState("feed"),
    [mode, setMode] = useState("for-you"),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [cursor, setCursor] = useState(""),
    [postId, setPostId] = useState(""),
    [routeReady, setRouteReady] = useState(false),
    [locale, setLocale] = useState<"bn" | "en">("bn"),
    [init, setInit] = useState(true),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<ModalSpec | null>(null),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [bell, setBell] = useState(false),
    [loadError, setLoadError] = useState("");
  const sequence = useRef(0);
  const sender = useRef(commandSender((body) => request("command", body)));
  const pending = useRef(0);
  const t = (bn: string, en: string) => (locale === "bn" ? bn : en);

  // UX-03: the closed mobile drawer used to stay in the tab order while
  // translated offscreen, so keyboard focus vanished to x = -227px. CSS now
  // makes it `visibility: hidden` when closed, which removes its descendants
  // from the focus order; this handles the open case — move focus in, close on
  // Escape, and hand focus back to the toggle that opened it.
  const menuRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // The drawer is only a drawer below the layout breakpoint; above it the
  // sidebar is permanent and must stay interactive.
  const [isDrawer, setIsDrawer] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const sync = () => setIsDrawer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const drawer = menuRef.current;
    drawer?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);
  const money = (n: number) =>
    new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", {
      style: "currency",
      currency: "BDT",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
    }).format((Number(n) || 0) / 100);
  const refresh = useCallback(async () => {
    if (!routeReady) return;
    const seq = ++sequence.current;
    setLoading(true);
    try {
      const d = await request(
        `data?view=${view}&mode=${mode}&q=${encodeURIComponent(q)}&cursor=${encodeURIComponent(cursor)}${postId ? `&post=${postId}` : ""}`,
      );
      if (seq !== sequence.current) return;
      setData(d);
      setLoadError("");
      setLocale(d.user.locale);
    } catch (e) {
      if (seq !== sequence.current) return;
      if ((e as any).status === 401) setData(null);
      else setLoadError((e as Error).message);
    } finally {
      if (seq === sequence.current) {
        setInit(false);
        setLoading(false);
      }
    }
  }, [view, mode, q, cursor, postId, routeReady]);
  const wroteRoute = useRef(false);
  useEffect(() => {
    const readRoute = () => {
      const params = new URLSearchParams(location.search);
      const v = params.get("view") ?? "feed";
      setView(nav.some((n) => n[0] === v) ? v : "feed");
      const m = params.get("mode") ?? "for-you";
      setMode(["for-you", "following", "pashe"].includes(m) ? m : "for-you");
      setQ(params.get("q") ?? "");
      setSearch(params.get("q") ?? "");
      setCursor(params.get("cursor") ?? "");
      setPostId(params.get("post") ?? "");
      setRouteReady(true);
    };
    readRoute();
    window.addEventListener("popstate", readRoute);
    return () => window.removeEventListener("popstate", readRoute);
  }, []);
  useEffect(() => {
    if (!routeReady) return;
    const params = new URLSearchParams({ view });
    if (mode !== "for-you") params.set("mode", mode);
    if (q) params.set("q", q);
    if (cursor) params.set("cursor", cursor);
    if (postId) params.set("post", postId);
    const next = `/?${params}`;
    if (location.pathname + location.search !== next) {
      if (wroteRoute.current) history.pushState(null, "", next);
      else history.replaceState(null, "", next);
    }
    wroteRoute.current = true;
  }, [view, mode, q, cursor, postId, routeReady]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  const act = useCallback(
    async (action: string, values: Row = {}, silent = false) => {
      if (!silent) {
        pending.current++;
        setBusy(true);
      }
      try {
        const result = await sender.current(
          data?.user.id ?? "anonymous",
          action,
          values,
        );
        if (!silent) {
          if (result.message) setToast(result.message);
          await refresh();
        }
        return result;
      } catch (e) {
        setToast((e as Error).message);
        throw e;
      } finally {
        if (!silent) setBusy(--pending.current > 0);
      }
    },
    [refresh, data?.user.id],
  );
  const go = (v: string) => {
    setView(v);
    setCursor("");
    setPostId("");
    setMenu(false);
    setBell(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  if (init)
    return (
      <div className="splash">
        <img src="/icon.svg" alt="BDOS" width="60" />
        <p>তোমার মঞ্চ তৈরি হচ্ছে…</p>
        <LoaderCircle className="spin" />
      </div>
    );
  if (!data) return <Login onLogin={refresh} />;
  const active = nav.find((n) => n[0] === view)!;
  return (
    <AppContext.Provider
      value={{
        data,
        view,
        locale,
        busy,
        act,
        go,
        modal: setModal,
        t,
        money,
        refresh,
        toast: setToast,
      }}
    >
      <div className="app-shell">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <aside
          id="primary-nav"
          ref={menuRef}
          // `inert`, not CSS, decides interactivity. Relying on the
          // `visibility` transition left the drawer focusable for the 200ms it
          // ran — and indefinitely if the browser throttled the animation,
          // which it does in a background window. An accessibility guarantee
          // must not depend on an animation completing.
          inert={isDrawer && !menu}
          className={`sidebar ${menu ? "is-open" : ""}`}
        >
          <button
            className="brand"
            onClick={() => go("feed")}
            aria-label="BDOS home"
          >
            <img src="/icon.svg" width="34" height="34" alt="" />
            <span>
              BDOS<span className="brand-bn">বিডস</span>
            </span>
          </button>
          <p className="brand-tag">BANGLADESH ON STAGE</p>
          <button className="create-button" onClick={() => go("cut")}>
            <Plus size={18} />
            {t("তোমার গল্প বলো", "Create a story")}
          </button>
          <div className="nav-label">
            {t("তোমার দুনিয়া", "YOUR ECOSYSTEM")}
          </div>
          <nav aria-label="Main navigation">
            {nav
              .filter(
                (n) => n[0] !== "admin" || data.user.roles.includes("admin"),
              )
              .filter(
                (n) =>
                  n[0] !== "partner" ||
                  data.user.roles.some((r: string) =>
                    ["partner", "admin"].includes(r),
                  ),
              )
              .map(([id, bn, en, Icon]) => (
                <button
                  key={id}
                  className={`nav-item ${view === id ? "active" : ""}`}
                  onClick={() => go(id)}
                >
                  <Icon size={18} />
                  <span>{t(bn, en)}</span>
                  {id === "live" && <i className="live-dot" />}
                  {view === id && <ChevronRight size={14} />}
                </button>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="safety-note">
              <ShieldCheck size={20} />
              <div>
                <strong>{t("তোমার পাশে নিরাপদ", "A safer stage")}</strong>
                <small>
                  {t(
                    "তোমার নিয়ন্ত্রণে তোমার দুনিয়া",
                    "Your space. Your controls.",
                  )}
                </small>
              </div>
            </div>
            <button className="user-button" onClick={() => go("profile")}>
              <Avatar name={data.user.display_name} />
              <span>
                <strong>{data.user.display_name}</strong>
                <small>@{data.user.handle}</small>
              </span>
              <Settings size={16} />
            </button>
          </div>
        </aside>
        {menu && (
          <button
            className="menu-backdrop"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          />
        )}
        <div className="main-shell">
          <header className="topbar">
            <button
              ref={menuButtonRef}
              className="icon-button mobile-menu"
              aria-label={
                menu
                  ? t("মেনু বন্ধ করো", "Close navigation")
                  : t("মেনু খোলো", "Open navigation")
              }
              aria-expanded={menu}
              aria-controls="primary-nav"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
            <span className="breadcrumb">
              BDOS <ChevronRight size={13} />{" "}
              <strong>{t(active[1], active[2])}</strong>
            </span>
            <form
              className="searchbox"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                setQ(search);
                setCursor("");
                setPostId("");
                setMode("for-you");
                go("feed");
              }}
            >
              <Search size={17} />
              <input
                aria-label="Search BDOS"
                placeholder={t(
                  "গল্প, মানুষ, কাচ্চি…",
                  "Search stories, people, kacchi…",
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <div className="top-actions">
              <button
                className={`data-saver ${data.user.data_saver ? "on" : ""}`}
                onClick={() => {
                  void request("command", {
                    action: "preference",
                    key: crypto.randomUUID(),
                    data: { dataSaver: !data.user.data_saver },
                  })
                    .then(refresh)
                    .catch((e) => setToast(e.message));
                }}
                title="Data Saver"
              >
                <Leaf size={16} />
                <span>{t("ডেটা সেভার", "Data Saver")}</span>
              </button>
              <button
                className="language-button"
                onClick={() => {
                  const next = locale === "bn" ? "en" : "bn";
                  setLocale(next);
                  void request("command", {
                    action: "preference",
                    key: crypto.randomUUID(),
                    data: { locale: next },
                  })
                    .then(refresh)
                    .catch((e) => setToast(e.message));
                }}
                aria-label="Switch language"
              >
                {locale === "bn" ? "EN" : "বাংলা"}
              </button>
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                onClick={() => setBell(!bell)}
              >
                <Bell size={19} />
                {data.notifications.some((n: Row) => !n.read_at) && <i />}
              </button>
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={async () => {
                  await request("auth/logout", {});
                  setData(null);
                  setView("feed");
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>
          {data.sandbox && (
            <div className="sandbox-banner">
              <span className="status-dot" />
              {t(
                "MVP স্যান্ডবক্স · পেমেন্ট ও পেআউট পরীক্ষামূলক",
                "MVP SANDBOX · Payments, payouts and courier events are simulated",
              )}
              <span className="sandbox-right">
                {t("দেখো · কিনো · কামাও", "WATCH · BUY · EARN")}
              </span>
            </div>
          )}
          {bell && (
            <div className="notification-panel">
              <div className="section-header">
                <h3>{t("নোটিফিকেশন", "Notifications")}</h3>
                <button
                  className="text-button"
                  onClick={() => void act("read-notifications").catch(() => {})}
                >
                  {t("পড়া হয়েছে", "Mark read")}
                </button>
              </div>
              {data.notifications.length ? (
                data.notifications.map((n: Row) => (
                  <article key={n.id}>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                  </article>
                ))
              ) : (
                <p>{t("এখনো কোনো আপডেট নেই", "You’re all caught up.")}</p>
              )}
            </div>
          )}
          <main
            id="main"
            tabIndex={-1}
            aria-busy={loading}
            className="workspace"
          >
            {loadError ? (
              <div className="empty">
                <h2>{loadError}</h2>
                <button onClick={() => void refresh()}>Try again</button>
              </div>
            ) : loading && data._view !== view ? (
              <div className="loading-bar" role="status">
                <LoaderCircle className="spin" size={20} />
                {t("লোড হচ্ছে…", "Loading your stage…")}
              </div>
            ) : (
              <>
                {view === "feed" && (
                  <Feed
                    mode={mode}
                    setMode={(m) => {
                      setMode(m);
                      setCursor("");
                      setPostId("");
                    }}
                    page={(c) => {
                      setCursor(c);
                      setPostId("");
                      window.scrollTo({ top: 0 });
                    }}
                    q={q}
                    clearSearch={() => {
                      setQ("");
                      setCursor("");
                      setPostId("");
                      setSearch("");
                    }}
                  />
                )}
                {view === "cut" && <Cut />}
                {view === "shop" && <Shop />}
                {view === "orders" && <Orders />}
                {view === "seller" && <Seller />}
                {view === "studio" && <Studio />}
                {view === "affiliate" && <Affiliate />}
                {view === "ads" && <Ads />}
                {view === "live" && <Live />}
                {view === "profile" && <Profile />}
                {view === "inbox" && <Inbox />}
                {view === "partner" && <Partner />}
                {view === "admin" && <Admin />}
              </>
            )}
          </main>
          <footer className="footer">
            <span>
              BDOS <span className="footer-dot">·</span>{" "}
              {t("বাংলাদেশের জন্য তৈরি", "Made for Bangladesh")}
            </span>
            <span>
              {t(
                "সব আয় ৳-এ। সব গল্প তোমার।",
                "Every earning in ৳. Every story yours.",
              )}
            </span>
          </footer>
        </div>
        {toast && (
          <div className="toast" role="status">
            <span>{toast}</span>
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setToast("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {modal && (
          <FormDialog
            key={modal.title}
            spec={modal}
            close={() => setModal(null)}
          />
        )}
      </div>
    </AppContext.Provider>
  );
}
function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [phone, setPhone] = useState("+8801812345678"),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sandbox, setSandbox] = useState(false),
    [register, setRegister] = useState(false);
  useEffect(() => {
    void request("config").then((d) => setSandbox(d.sandbox));
  }, []);
  return (
    <main className="login">
      <div className="login-art">
        <div className="login-wordmark">
          BDOS<span>বিডস</span>
        </div>
        <p className="eyebrow">BANGLADESH ON STAGE</p>
        <h1>
          তোমার গল্প।
          <br />
          তোমার মঞ্চ।
        </h1>
        <p>
          Your stage. Your shop.
          <br />A world of stories, craft, and possibility.
        </p>
        <div className="login-loop">
          <span>
            দেখো<small>WATCH</small>
          </span>
          <ArrowRight />
          <span>
            কিনো<small>BUY</small>
          </span>
          <ArrowRight />
          <span>
            কামাও<small>EARN</small>
          </span>
        </div>
        <div className="login-art-line" />
      </div>
      <section className="login-form">
        <img src="/icon.svg" width="40" alt="BDOS" />
        <p className="eyebrow">WELCOME TO YOUR STAGE</p>
        <h2>শুরু হোক তোমার গল্প।</h2>
        <p className="muted">Sign in with your Bangladesh mobile number.</p>
        {sandbox && (
          <div className="notice">
            Sandbox workspace · OTP is shown here. No SMS or real payments.
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fields = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              if (!sent) {
                const r = await request("auth/request", { phone });
                setCode(r.sandboxCode ?? "");
                setSent(true);
              } else {
                await request("auth/verify", {
                  phone,
                  code,
                  ...(register
                    ? {
                        name: fields.get("name"),
                        handle: fields.get("handle"),
                        dob: fields.get("dob"),
                      }
                    : {}),
                });
                await onLogin();
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            মোবাইল নম্বর · Phone number
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setSent(false);
              }}
              required
              pattern="\+8801[3-9][0-9]{8}"
            />
          </label>
          {sent && (
            <label>
              যাচাইকরণ কোড · Verification code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                pattern="[0-9]{6}"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              {sandbox && <small>Sandbox code: {code}</small>}
            </label>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={register}
              onChange={(e) => setRegister(e.target.checked)}
            />
            নতুন অ্যাকাউন্ট · Create an account
          </label>
          {register && (
            <>
              <label>
                নাম · Name
                <input name="name" required maxLength={40} />
              </label>
              <label>
                ইউজারনেম · Handle
                <input name="handle" required pattern="[a-z0-9._]{3,24}" />
              </label>
              <label>
                জন্ম তারিখ · Date of birth
                <input type="date" name="dob" required />
              </label>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}{" "}
            {sent ? "প্রবেশ করো · Sign in" : "কোড পাঠাও · Get code"}
          </button>
          {sent && (
            <button
              type="button"
              className="text-button"
              onClick={() => setSent(false)}
            >
              Request a new code
            </button>
          )}
        </form>
        {sandbox && (
          <div className="demo-accounts">
            <p className="eyebrow">EXPLORE A DEMO ROLE</p>
            <div>
              {[
                ["Viewer", "18"],
                ["Creator", "17"],
                ["Seller", "19"],
                ["Operations", "15"],
                ["Partner", "13"],
              ].map(([name, n]) => (
                <button
                  key={name}
                  className="secondary small"
                  onClick={() => {
                    setPhone(`+880${n}12345678`);
                    setSent(false);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <small>
              Each role has its own permissions. All data is synthetic.
            </small>
          </div>
        )}
      </section>
    </main>
  );
}
