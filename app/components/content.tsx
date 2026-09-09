"use client";
import { useEffect, useRef, useState } from "react";
import {
  Heart,
  MessageCircle,
  ShoppingBag,
  ArrowUpRight,
  Share2,
  Flag,
  Play,
  Upload,
  Scissors,
  Plus,
  Leaf,
  ChevronRight,
  Check,
} from "lucide-react";
import {
  useApp,
  Heading,
  Avatar,
  Pill,
  Empty,
  Money,
  options,
  type Row,
} from "./ui";
export function Feed({
  mode,
  setMode,
  q,
  clearSearch,
  page,
}: {
  mode: string;
  setMode: (m: string) => void;
  q: string;
  clearSearch: () => void;
  page: (cursor: string) => void;
}) {
  const { data, t, go } = useApp();
  return (
    <>
      <Heading
        eyebrow={t("তোমার পরের পছন্দের গল্প", "YOUR NEXT FAVORITE STORY")}
        title={t("বাংলাদেশ, তোমার মঞ্চে।", "Bangladesh, on your stage.")}
        description={t(
          "ছোট ছোট গল্প। নতুন নতুন সম্ভাবনা।",
          "Little stories. Local finds. Endless possibilities.",
        )}
      />
      <div className="feed-layout">
        <section>
          <div className="tabs" role="tablist">
            {[
              ["for-you", "তোমার জন্য", "For you"],
              ["following", "ফলোয়িং", "Following"],
              ["pashe", "পাশে", "Pashe · Friends"],
            ].map(([id, bn, en]) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                className={mode === id ? "selected" : ""}
                onClick={() => setMode(id)}
              >
                {t(bn, en)}
              </button>
            ))}
            <span className="tab-note">
              {t("নতুন কণ্ঠ। প্রতিদিন।", "FRESH VOICES, EVERY DAY")}
            </span>
          </div>
          {q && (
            <div className="search-result">
              {t("খোঁজার ফল", "Results for")} “{q}”{" "}
              <button className="text-button" onClick={clearSearch}>
                {t("মুছো", "Clear")}
              </button>
            </div>
          )}
          <div className="feed-grid">
            {(data.posts ?? []).map((post: Row, index: number) => (
              <div key={post.id}>
                <PostCard post={post} />
                {index === 3 && data.ads?.[0] && <AdCard ad={data.ads[0]} />}
              </div>
            ))}
          </div>
          <div className="actions">
            {(data.feedCursor || data.sharedPost) && (
              <button className="secondary" onClick={() => page("")}>
                {t("নতুন গল্প", "Latest stories")}
              </button>
            )}
            {data.nextCursor && (
              <button className="primary" onClick={() => page(data.nextCursor)}>
                {t("আগের গল্প দেখো", "Older stories")}
              </button>
            )}
          </div>
          {!data.posts?.length && (
            <Empty
              title={t("এখানে নতুন গল্পের অপেক্ষা", "A little quiet here")}
              body={t(
                "আরও নির্মাতাকে ফলো করো বা অন্যভাবে খোঁজো।",
                "Follow a creator or try another search to find your next story.",
              )}
            />
          )}
        </section>
        <aside className="feed-rail">
          <div className="rail-welcome">
            <span className="eyebrow">দেখো · কিনো · কামাও</span>
            <h2>
              {t(
                "তোমার প্রতিভার নতুন ঠিকানা।",
                "Make room for your next idea.",
              )}
            </h2>
            <p>
              {t(
                "একটা গল্পই হতে পারে নতুন শুরুর প্রথম ধাপ।",
                "Your first story could be the start of something good.",
              )}
            </p>
            <button className="primary" onClick={() => go("cut")}>
              {t("তৈরি করো", "Start creating")}
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="section-header">
            <h3>{t("স্থানীয় পছন্দ", "Local finds")}</h3>
            <button className="text-button" onClick={() => go("shop")}>
              {t("সব", "See all")}
              <ChevronRight size={14} />
            </button>
          </div>
          {data.products.slice(0, 3).map((p: Row) => (
            <button
              className="rail-product"
              key={p.id}
              onClick={() => go("shop")}
            >
              <img src={p.cover} alt="" />
              <span>
                <strong>{t(p.title_bn, p.title_en)}</strong>
                <small>{p.trade_name}</small>
                <Money value={p.skus[0].price_paisa} />
              </span>
            </button>
          ))}
          <div className="rail-safe">
            <Leaf size={20} />
            <h3>{t("কম ডেটা। বেশি গল্প।", "Less data. More stories.")}</h3>
            <p>
              {t(
                "ডেটা সেভার চালু থাকলে ভিডিও নিজে থেকে চলে না।",
                "Data Saver keeps videos on tap-to-play and avoids preloading.",
              )}
            </p>
          </div>
          <span className="eyebrow muted">ORIGINAL DEMO ART · BDOS MVP</span>
        </aside>
      </div>
    </>
  );
}
function AdCard({ ad }: { ad: Row }) {
  const { act, data, go, t } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let sent = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !sent) {
          sent = true;
          void act(
            "ad-event",
            { id: ad.id, kind: "impression", token: ad.token },
            true,
          ).catch(() => {});
        }
      },
      { threshold: 0.5 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ad.id, act]);
  return (
    <article ref={ref} className="ad-card">
      <Pill>{t("স্পনসরড", "Sponsored · Spark")}</Pill>
      <h3>{ad.name}</h3>
      <p>{ad.caption}</p>
      <button
        onClick={async () => {
          await act(
            "ad-event",
            { id: ad.id, kind: "click", token: ad.token },
            true,
          ).catch(() => {});
          go("shop");
        }}
        className="secondary"
      >
        {t("পণ্য দেখো", "Explore product")}
        <ArrowUpRight size={15} />
      </button>
    </article>
  );
}
function PostCard({ post: p }: { post: Row }) {
  const { act, data, t, modal, go, toast } = useApp();
  const [comments, setComments] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const postAct = useRef(act);
  postAct.current = act;
  useEffect(() => {
    let started = 0,
      recorded = false;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting;
        if (visible && !started) started = Date.now();
        if (!visible && started && !recorded) {
          const ms = Math.min(Date.now() - started, 600000);
          if (ms > 1000) {
            recorded = true;
            void postAct
              .current(
                "watch",
                {
                  id: p.id,
                  ms:
                    p.media_id && p.kind === "video"
                      ? Math.min(
                          Math.round((video.current?.currentTime ?? 0) * 1000),
                          ms,
                        )
                      : ms,
                  completed: p.kind !== "video",
                },
                true,
              )
              .catch(() => {});
          }
        }
        if (!visible) video.current?.pause();
      },
      { threshold: 0.6 },
    );
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
    };
  }, [p.id, p.media_id, p.kind]);
  const product = data.products.find((x: Row) => p.product_ids?.includes(x.id));
  return (
    <article className={`post-card ${p.template}`} ref={ref}>
      <div className="post-media">
        {p.media_id && p.kind === "video" ? (
          <video
            ref={video}
            src={`/api/media/${p.media_id}`}
            controls
            playsInline
            preload={data.user.data_saver ? "none" : "metadata"}
            poster={p.cover}
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = Number(p.trim_start) || 0;
            }}
            onTimeUpdate={(e) => {
              if (
                p.trim_end &&
                e.currentTarget.currentTime >= Number(p.trim_end)
              )
                e.currentTarget.pause();
            }}
            onEnded={(e) =>
              void act(
                "watch",
                {
                  id: p.id,
                  ms: Math.round(e.currentTarget.duration * 1000),
                  completed: true,
                },
                true,
              ).catch(() => {})
            }
          />
        ) : (
          <img
            src={p.media_id ? `/api/media/${p.media_id}` : p.cover}
            alt={p.caption.slice(0, 100)}
            loading="lazy"
          />
        )}
        <div className="post-top">
          <Pill>
            {p.kind === "video"
              ? t("ভিডিও", "Video")
              : t("ফটো গল্প", "Photo story")}
          </Pill>
          {p.served_impressions < 500 && (
            <span className="new-voice">{t("নতুন কণ্ঠ", "Fresh voice")}</span>
          )}
        </div>
        {p.captions && <div className="caption-overlay">{p.captions}</div>}
        <div className="post-author">
          <Avatar name={p.display_name} />
          <div>
            <strong>{p.display_name}</strong>
            <small>@{p.handle}</small>
          </div>
          {p.author_id !== data.user.id && (
            <button
              className={p.following ? "following-button" : "follow-button"}
              aria-label={p.following ? "Unfollow creator" : "Follow creator"}
              onClick={() =>
                void act("follow", {
                  id: p.author_id,
                  follow: !p.following,
                }).catch(() => {})
              }
            >
              {p.following ? <Check size={16} /> : <Plus size={16} />}
            </button>
          )}
        </div>
      </div>
      <div className="post-body">
        <p>{p.caption}</p>
        {product && (
          <button
            className="product-anchor"
            onClick={() =>
              modal({
                title: t(product.title_bn, product.title_en),
                description: `${product.trade_name} · ${t("৭ দিনের রিটার্ন", "7-day returns")}`,
                fields: [
                  {
                    name: "skuId",
                    label: t("ভ্যারিয়েন্ট", "Variant"),
                    options: product.skus.map((s: Row) => ({
                      value: s.id,
                      label: `${s.variant_label} · ৳${s.price_paisa / 100}`,
                    })),
                  },
                  {
                    name: "qty",
                    label: t("পরিমাণ", "Quantity"),
                    type: "number",
                    value: 1,
                    min: 1,
                    max: 99,
                  },
                ],
                submit: t("কার্টে যোগ করো", "Add to cart"),
                onSubmit: async (v) => {
                  await act("cart", { ...v, postId: p.id });
                },
              })
            }
          >
            <ShoppingBag size={15} />
            <span>{t(product.title_bn, product.title_en)}</span>
            <Money value={product.skus[0].price_paisa} />
            <ChevronRight size={14} />
          </button>
        )}
        <div className="post-actions">
          <button
            className={p.liked ? "liked" : ""}
            aria-label="Like post"
            onClick={() =>
              void act("like", { id: p.id, liked: !p.liked }).catch(() => {})
            }
          >
            <Heart size={18} fill={p.liked ? "currentColor" : "none"} />
            {p.likes}
          </button>
          <button
            aria-label="Show comments"
            onClick={() => setComments(!comments)}
          >
            <MessageCircle size={18} />
            {p.comments}
          </button>
          <button
            aria-label="Copy post link"
            onClick={() =>
              void navigator.clipboard
                .writeText(`${location.origin}/?view=feed&post=${p.id}`)
                .then(() => toast(t("লিংক কপি হয়েছে", "Link copied")))
                .catch(() => toast("Could not copy link"))
            }
          >
            <Share2 size={17} />
          </button>
          <button
            aria-label="Report post"
            onClick={() =>
              modal({
                title: t("নিরাপদে রিপোর্ট করো", "Report to Nirapod"),
                fields: [
                  {
                    name: "reason",
                    label: t("কারণ", "Reason"),
                    options: [
                      "harassment",
                      "spam",
                      "hate_speech",
                      "minor_safety",
                      "fraud",
                      "copyright",
                      "communal_religious",
                    ].map((v) => ({ value: v, label: v.replaceAll("_", " ") })),
                  },
                  {
                    name: "note",
                    label: t("বিস্তারিত", "Details"),
                    type: "textarea",
                    required: false,
                  },
                  {
                    name: "block",
                    label: t(
                      "রিপোর্টের সাথে ব্লক করো",
                      "Also block this creator",
                    ),
                    type: "checkbox",
                    value: true,
                  },
                ],
                submit: t("রিপোর্ট পাঠাও", "Send report"),
                onSubmit: async (v) => {
                  await act("report", { id: p.id, ...v });
                },
              })
            }
          >
            <Flag size={16} />
          </button>
        </div>
        {(p.allow_duet || p.allow_stitch) && (
          <button
            className="remix-button"
            onClick={() => {
              sessionStorage.setItem("bdos-remix", JSON.stringify(p));
              go("cut");
            }}
          >
            <Scissors size={13} />
            {t("এই গল্প থেকে তৈরি করো", "Remix this story")}
          </button>
        )}
        {comments && (
          <div className="comments">
            {p.comments > 30 && (
              <small>
                {t(
                  "পিন করা ও সাম্প্রতিক ৩০টি মন্তব্য",
                  "Showing pinned and recent comments (up to 30).",
                )}
              </small>
            )}
            {p.comment_list?.map((c: Row) => (
              <div key={c.id}>
                <strong>
                  {c.name}
                  {c.pinned ? " · Pinned" : ""}
                </strong>
                <p>{c.body}</p>
                {p.author_id === data.user.id && (
                  <button
                    className="text-button"
                    onClick={() =>
                      void act("pin-comment", { id: c.id }).catch(() => {})
                    }
                  >
                    Pin / unpin
                  </button>
                )}
              </div>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const body = new FormData(form).get("body");
                try {
                  await act("comment", { id: p.id, body });
                  form.reset();
                } catch {}
              }}
            >
              <input
                name="body"
                aria-label="Comment"
                placeholder={t("সম্মান রেখে বলো…", "Leave a kind comment…")}
                required
                maxLength={1000}
              />
              <button className="primary small">{t("পোস্ট", "Post")}</button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
export function Cut() {
  const { data, t, act, toast, busy } = useApp();
  const [caption, setCaption] = useState(""),
    [captions, setCaptions] = useState(""),
    [template, setTemplate] = useState("original"),
    [media, setMedia] = useState<Row | null>(null),
    [product, setProduct] = useState(""),
    [uploading, setUploading] = useState(false),
    [draft, setDraft] = useState<string | undefined>(),
    [parent, setParent] = useState<Row | null>(null),
    [start, setStart] = useState(0),
    [end, setEnd] = useState<number | undefined>();
  useEffect(() => {
    const p = sessionStorage.getItem("bdos-remix");
    if (p) {
      const r = JSON.parse(p);
      setParent(r);
      setTemplate(r.allow_duet ? "duet" : "stitch");
      sessionStorage.removeItem("bdos-remix");
    }
  }, []);
  const save = async (publish: boolean) => {
    try {
      const result = await act("post", {
        id: draft,
        caption,
        captions,
        template,
        mediaId: media?.id,
        productId: product || undefined,
        parentId: parent?.id,
        trimStart: start,
        trimEnd: end,
        publish,
      });
      if (publish) {
        setDraft(undefined);
        setCaption("");
        setCaptions("");
        setTemplate("original");
        setMedia(null);
        setProduct("");
        setParent(null);
        setStart(0);
        setEnd(undefined);
      } else setDraft(result.id);
    } catch {}
  };
  return (
    <>
      <Heading
        eyebrow="BDOS CUT"
        title={t("তোমার গল্প, তোমার মতো।", "Make it your story.")}
        description={t(
          "আপলোড করো। নিজের ছোঁয়া দাও। মঞ্চে নিয়ে আসো।",
          "Upload. Add your touch. Bring it to the stage.",
        )}
      />
      <div className="editor-layout">
        <section className="panel editor-form">
          <div className="section-header">
            <h2>{t("নতুন গল্প", "New story")}</h2>
            <Pill>{t("৪৮০পি ভিডিও", "480p video")}</Pill>
          </div>
          {parent && (
            <div className="notice">
              {template.toUpperCase()} · {parent.caption}
              <small>
                Remix lineage is recorded. Upload your own composed clip.
              </small>
            </div>
          )}
          <label className="upload-zone">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
              aria-label="Upload media"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const f = new FormData();
                  f.append("file", file);
                  const res = await fetch("/api/upload", {
                    method: "POST",
                    body: f,
                  });
                  const m = await res.json();
                  if (!res.ok) throw new Error(m.error);
                  setMedia(m);
                  toast(t("আপলোড সম্পন্ন", "Upload complete"));
                } catch (e) {
                  toast((e as Error).message);
                } finally {
                  setUploading(false);
                }
              }}
            />
            <Upload size={28} />
            <strong>
              {uploading
                ? t("প্রসেস হচ্ছে…", "Processing your media…")
                : media
                  ? t("মিডিয়া বদলাও", "Replace media")
                  : t(
                      "তোমার ভিডিও বা ছবি আপলোড করো",
                      "Drop your video or photo here",
                    )}
            </strong>
            <span>MP4, WebM, PNG, JPEG, WebP · 20 MB max</span>
          </label>
          <label>
            {t("একটা ফরম্যাট বেছে নাও", "Choose a format")}
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              <option value="original">Original story · নিজের গল্প</option>
              <option value="product-story">Product story · পণ্যের গল্প</option>
              <option value="day-in-life">Day in my life · আমার দিন</option>
              {parent?.allow_duet && <option value="duet">Duet</option>}
              {parent?.allow_stitch && <option value="stitch">Stitch</option>}
            </select>
          </label>
          <label>
            {t("ক্যাপশন", "Caption")}
            <textarea
              aria-label={t("ক্যাপশন", "Caption")}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("তোমার গল্পটা কী?", "What’s your story?")}
              rows={4}
              maxLength={2200}
            />
            <small>{caption.length}/2200</small>
          </label>
          <label>
            {t(
              "ভিডিওতে লেখা (ম্যানুয়াল ক্যাপশন)",
              "On-screen text (manual captions)",
            )}
            <textarea
              value={captions}
              onChange={(e) => setCaptions(e.target.value)}
              rows={2}
              maxLength={5000}
            />
          </label>
          <div className="form-row">
            <label>
              {t("শুরু (সেকেন্ড)", "Trim start (seconds)")}
              <input
                type="number"
                min="0"
                max="599"
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
              />
            </label>
            <label>
              {t("শেষ (সেকেন্ড)", "Trim end (seconds)")}
              <input
                type="number"
                min="1"
                max="600"
                value={end ?? ""}
                onChange={(e) =>
                  setEnd(e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </label>
          </div>
          <label>
            {t("একটি পণ্য ট্যাগ করো", "Tag a product")}
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              <option value="">{t("পণ্য ছাড়া", "No product")}</option>
              {data.products.map((p: Row) => (
                <option value={p.id} key={p.id}>
                  {t(p.title_bn, p.title_en)}
                </option>
              ))}
            </select>
          </label>
          <div className="dialog-actions">
            <button
              disabled={!caption || uploading || busy}
              className="secondary"
              onClick={() => void save(false)}
            >
              {t("ড্রাফট রাখো", "Save draft")}
            </button>
            <button
              disabled={!caption || uploading || busy}
              className="primary"
              onClick={() => void save(true)}
            >
              {t("প্রকাশ করো", "Publish story")}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
        <aside>
          <div className="preview-label">
            {t("তোমার গল্পের প্রিভিউ", "YOUR STORY PREVIEW")}
          </div>
          <div
            className={`editor-preview ${template === "product-story" ? "product-story" : template === "day-in-life" ? "day-in-life" : ""}`}
          >
            {media?.mime?.startsWith("video") ? (
              <video
                src={media.url ?? `/api/media/${media.id}`}
                controls
                playsInline
              />
            ) : (
              <img
                src={media ? `/api/media/${media.id}` : "/art/stage.svg"}
                alt="Story preview"
              />
            )}
            <div className="preview-overlay">
              <Pill>{template.replaceAll("-", " ")}</Pill>
              <h3>
                {captions || t("এখানেই তোমার গল্প।", "Your story goes here.")}
              </h3>
              <p>{caption}</p>
              <span>@{data.user.handle}</span>
            </div>
          </div>
          <div className="panel draft-list">
            <h3>{t("সেভ করা ড্রাফট", "Saved drafts")}</h3>
            {data.ownPosts
              ?.filter((p: Row) => p.state === "uploading")
              .map((p: Row) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setDraft(p.id);
                    setCaption(p.caption);
                    setCaptions(p.captions);
                    setTemplate(p.template);
                    setParent(
                      p.parent_id
                        ? {
                            id: p.parent_id,
                            caption: p.parent_caption,
                            allow_duet: p.parent_allow_duet,
                            allow_stitch: p.parent_allow_stitch,
                          }
                        : null,
                    );
                    setStart(Number(p.trim_start));
                    setEnd(p.trim_end ? Number(p.trim_end) : undefined);
                    setProduct(p.product_ids[0] ?? "");
                    setMedia(
                      p.media_id
                        ? {
                            id: p.media_id,
                            mime:
                              p.kind === "video" ? "video/mp4" : "image/jpeg",
                          }
                        : null,
                    );
                  }}
                >
                  {p.caption}
                  <ChevronRight size={16} />
                </button>
              ))}
            <small>
              {t(
                "তোমার ড্রাফট শুধু তুমিই দেখতে পাবে।",
                "Drafts are visible only to you.",
              )}
            </small>
          </div>
        </aside>
      </div>
    </>
  );
}
