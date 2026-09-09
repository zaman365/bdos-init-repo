"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Plus,
  ShieldCheck,
  Check,
  BookOpen,
  Wallet,
  Link2,
  Megaphone,
  Send,
  RefreshCw,
  Users,
  CheckCircle2,
} from "lucide-react";
import {
  useApp,
  Heading,
  Stats,
  Money,
  Pill,
  Empty,
  Topup,
  Avatar,
  options,
  type Row,
} from "./ui";
export function Studio() {
  const { data, t, go, act, modal } = useApp();
  const total = (key: string) =>
    data.ownPosts?.reduce(
      (s: number, p: Row) => s + (Number(p[key]) || 0),
      0,
    ) ?? 0;
  const available =
    data.wallet
      ?.filter((b: Row) =>
        ["creator_payable", "gift_liability"].includes(b.kind),
      )
      .reduce((s: number, b: Row) => s + b.balance_paisa, 0) ?? 0;
  const held =
    data.wallet?.find((b: Row) => b.kind === "commission_held")
      ?.balance_paisa ?? 0;
  return (
    <>
      <Heading
        eyebrow="CREATOR STUDIO"
        title={t(
          "তোমার সৃজনশীলতা, তোমার আয়।",
          "Your creativity. Your momentum.",
        )}
        description={t(
          "গল্পের প্রভাব থেকে আয়ের হিসাব — সব এখানে।",
          "See how your stories connect, and where every taka comes from.",
        )}
        action={
          <button className="primary" onClick={() => go("cut")}>
            <Plus size={17} />
            {t("তৈরি করো", "Create a story")}
          </button>
        }
      />
      <Stats
        items={[
          { label: t("প্লে", "Plays"), value: total("plays") },
          {
            label: t("সম্পূর্ণ দেখা", "Completion rate"),
            value: `${total("plays") ? Math.round((total("completions") / total("plays")) * 100) : 0}%`,
          },
          {
            label: t("উত্তোলনযোগ্য আয়", "Available earnings"),
            value: <Money value={available} />,
          },
          {
            label: t("অপেক্ষমাণ কমিশন", "Commission on hold"),
            value: <Money value={held} />,
            note: t("৭ দিনের রিটার্ন উইন্ডো", "7-day return window"),
          },
        ]}
      />
      <div className="two-columns">
        <div className="panel">
          <div className="section-header">
            <h2>{t("তোমার কনটেন্ট", "Your content")}</h2>
            <Pill>{data.ownPosts?.length ?? 0}</Pill>
          </div>
          {data.ownPosts?.map((p: Row) => (
            <div className="content-row" key={p.id}>
              <img src={p.cover} alt="" />
              <div>
                <strong>{p.caption}</strong>
                <small>
                  {p.state} · {p.plays ?? 0} plays · {p.likes ?? 0} likes
                </small>
                <div className="retention-bar">
                  <span
                    style={{
                      width: `${Math.min(100, p.plays ? (p.completions / p.plays) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          {!data.ownPosts?.length && (
            <Empty
              title={t("প্রথম গল্পের সময়", "Your first story is waiting")}
            />
          )}
        </div>
        <Payouts />
      </div>
      <div className="two-columns">
        <div className="panel">
          <h2>{t("BDOS একাডেমি", "BDOS Academy")}</h2>
          {[
            [
              "first-post",
              "তোমার প্রথম গল্প",
              "Your first story",
              "Choose a clear subject, use natural light, add Bangla captions, then tag a relevant product. Keep the first three seconds useful.",
            ],
            [
              "safe-community",
              "নিরাপদ কমিউনিটি",
              "A safer community",
              "Keep DMs limited, choose your remix permissions, report harassment, and use one-tap blocking. Every removal has a reason and an appeal.",
            ],
            [
              "first-sale",
              "প্রথম বিক্রি",
              "Your first sale",
              "Request a sample, publish an honest product story, and show what the product really does. Commission follows a recorded product click and confirmed delivery.",
            ],
            [
              "understand-earnings",
              "তোমার আয়ের হিসাব",
              "Understand your earnings",
              "Commission stays held for seven days after delivery. Gifts split 60% creator / 40% platform before illustrative withholding. Verify your payout method and check each receipt.",
            ],
          ].map(([id, bn, en, body]) => (
            <details className="lesson" key={id}>
              <summary>
                <BookOpen size={18} />
                {t(bn, en)}
                {data.lessons?.some((l: Row) => l.lesson === id) && (
                  <Check size={17} />
                )}
              </summary>
              <p>{body}</p>
              <button
                className="secondary small"
                onClick={() =>
                  void act("academy", { lesson: id }).catch(() => {})
                }
              >
                {t("পড়া শেষ", "Mark complete")}
              </button>
            </details>
          ))}
        </div>
        <div className="panel">
          <h2>{t("ব্র্যান্ডের সাথে কাজ", "Creator marketplace")}</h2>
          {data.briefs?.map((b: Row) => (
            <article className="brief" key={b.id}>
              <small>{b.trade_name}</small>
              <h3>{b.title}</h3>
              <p>{b.description}</p>
              <div className="section-header">
                <Money value={b.budget_paisa} />
                <Pill>{b.state}</Pill>
              </div>
              {!b.applied &&
                b.state === "open" &&
                b.owner_id !== data.user.id && (
                  <button
                    className="secondary"
                    onClick={() =>
                      modal({
                        title: t("তোমার প্রস্তাব", "Pitch your story"),
                        fields: [
                          {
                            name: "pitch",
                            label: t(
                              "তুমি কী তৈরি করবে?",
                              "What will you create?",
                            ),
                            type: "textarea",
                          },
                        ],
                        submit: t("আবেদন করো", "Apply"),
                        onSubmit: async (v) => {
                          await act("brief-apply", { id: b.id, ...v });
                        },
                      })
                    }
                  >
                    {t("আবেদন করো", "Apply to brief")}
                    <ArrowUpRight size={15} />
                  </button>
                )}
              {b.applied && (
                <small>
                  {t(
                    "তোমার আবেদন পাঠানো হয়েছে",
                    "Your application is submitted",
                  )}
                </small>
              )}
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
export function Payouts() {
  const { data, t, act, modal } = useApp();
  return (
    <div className="panel">
      <div className="section-header">
        <h2>{t("আয় ও পেআউট", "Earnings & payouts")}</h2>
        <Wallet size={20} />
      </div>
      <p className="muted">
        {t(
          "আসল টাকা পাঠানো হবে না। স্যান্ডবক্স পেআউট।",
          "Sandbox transfers. No real money is sent.",
        )}
      </p>
      <div className="wallet-lines">
        {data.wallet
          ?.filter((b: Row) =>
            ["creator_payable", "gift_liability", "commission_held"].includes(
              b.kind,
            ),
          )
          .map((b: Row) => (
            <div key={b.kind}>
              <span>
                {
                  (
                    {
                      creator_payable: t("কমিশন", "Commission"),
                      gift_liability: t("গিফট ও Spark আয়", "Gifts & Spark"),
                      commission_held: t("হোল্ডে", "On hold"),
                    } as Row
                  )[b.kind]
                }
              </span>
              <Money value={b.balance_paisa} />
            </div>
          ))}
        {data.seller && (
          <div>
            <span>{t("বিক্রেতার ছাড়কৃত আয়", "Seller available")}</span>
            <Money value={data.sellerBalance ?? 0} />
          </div>
        )}
      </div>
      <div className="notice">
        {t(
          "গিফট আয়ে স্যান্ডবক্স ১০% কর কাটে। কমিশনে আগেই কাটা থাকে।",
          "Gift withdrawals deduct illustrative 10% withholding; affiliate commission is already net. Seller funds clear after the return window.",
        )}
      </div>
      <div className="actions">
        <button
          className="primary"
          onClick={() =>
            modal({
              title: t("উত্তোলন করো", "Request a sandbox payout"),
              fields: [
                {
                  name: "source",
                  label: t("আয়ের উৎস", "Earning source"),
                  options: [
                    {
                      value: "creator_payable",
                      label: "Cleared affiliate commission",
                    },
                    {
                      value: "gift_liability",
                      label: "Gifts and Spark earnings",
                    },
                    ...(data.seller
                      ? [
                          {
                            value: "seller_payable",
                            label: "Cleared seller balance",
                          },
                        ]
                      : []),
                  ],
                },
                {
                  name: "amount",
                  label: t("পরিমাণ (৳)", "Gross amount (৳)"),
                  type: "number",
                  min: 1,
                  value: 10,
                  step: "0.01",
                },
                {
                  name: "simulateFailure",
                  label: "Simulate provider failure (balance stays unchanged)",
                  type: "checkbox",
                  value: false,
                },
              ],
              submit: t("উত্তোলন করো", "Request payout"),
              onSubmit: async (v) => {
                await act("withdraw", {
                  ...v,
                  amount: Math.round(v.amount * 100),
                });
              },
            })
          }
        >
          {t("উত্তোলন", "Withdraw")}
          <ArrowUpRight size={15} />
        </button>
        <button
          className="secondary"
          onClick={() =>
            modal({
              title: t("পেআউট গন্তব্য", "Payout destination"),
              description:
                "Use synthetic test account details only. The sandbox marks this destination verified.",
              fields: [
                {
                  name: "channel",
                  label: t("মাধ্যম", "Channel"),
                  options: ["bkash", "nagad", "rocket", "upay", "beftn"].map(
                    (v) => ({ value: v, label: v }),
                  ),
                },
                {
                  name: "account",
                  label: t("টেস্ট অ্যাকাউন্ট নম্বর", "Test account number"),
                  value: "+8801712345678",
                },
              ],
              submit: t("সেভ করো", "Save destination"),
              onSubmit: async (v) => {
                await act("payout-method", v);
              },
            })
          }
        >
          {t("গন্তব্য", "Destination")}
        </button>
      </div>
      {data.methods
        ?.filter((m: Row) => m.is_default)
        .map((m: Row) => (
          <p className="muted" key={m.id}>
            {m.channel} · {m.masked} · Sandbox verified
          </p>
        ))}
      {data.kyc?.state !== "verified" && (
        <button
          className="text-button"
          onClick={() => void act("kyc-submit").catch(() => {})}
        >
          {t("পরিচয় যাচাইয়ের আবেদন", "Request sandbox identity review")}
        </button>
      )}
      <div className="payout-list">
        {data.payouts?.map((p: Row) => (
          <div key={p.id}>
            <span>
              {p.channel}
              <small>
                {new Date(p.requested_at).toLocaleDateString()} · {p.state}
              </small>
            </span>
            <Money value={p.amount_paisa} />
          </div>
        ))}
      </div>
    </div>
  );
}
export function Affiliate() {
  const { data, t, act, modal, go } = useApp();
  const [tab, setTab] = useState("discover");
  const own = data.products.filter((p: Row) => p.owner_id === data.user.id);
  return (
    <>
      <Heading
        eyebrow="BDOS AFFILIATE"
        title={t(
          "ভালো লাগা থেকে ভালো আয়।",
          "Share what you love. Earn from it.",
        )}
        description={t(
          "একটা সৎ গল্প। একটা সফল বিক্রি। তোমার কমিশন।",
          "An honest story. A successful sale. A commission you can trace.",
        )}
        action={
          data.seller?.state === "active" && (
            <button
              className="primary"
              onClick={() =>
                modal({
                  title: t("অ্যাফিলিয়েট প্ল্যান", "Create affiliate plan"),
                  fields: [
                    {
                      name: "kind",
                      label: "Plan type",
                      options: ["open", "targeted", "shop"].map((v) => ({
                        value: v,
                        label: v,
                      })),
                    },
                    {
                      name: "productId",
                      label: "Product",
                      options: options(own),
                    },
                    {
                      name: "rate",
                      label: "Commission (%)",
                      type: "number",
                      value: 3,
                      min: 0.01,
                      max: 20,
                      step: "0.01",
                    },
                    {
                      name: "creatorId",
                      label: "Creator (for targeted plan)",
                      required: false,
                      options: [
                        { value: "", label: "Select for targeted plans" },
                        ...options(data.people, "display_name"),
                      ],
                    },
                  ],
                  submit: "Activate plan",
                  onSubmit: async (v) => {
                    await act("plan", {
                      ...v,
                      rate: Math.round(v.rate * 100),
                      creatorId: v.creatorId || undefined,
                    });
                  },
                })
              }
            >
              <Plus size={16} />
              {t("নতুন প্ল্যান", "New plan")}
            </button>
          )
        }
      />
      <div className="affiliate-banner">
        <Link2 size={28} />
        <div>
          <h3>
            {t(
              "সব কমিশনের হিসাব পরিষ্কার।",
              "Every commission has a clear story.",
            )}
          </h3>
          <p>
            {t(
              "ডেলিভারিতে আয় জমে। ৭ দিনের রিটার্ন উইন্ডোর পর উত্তোলন করা যায়।",
              "Earn at delivery. Withdraw after the seven-day return window. Returns reverse the commission.",
            )}
          </p>
        </div>
        <Pill>{t("সফল বিক্রিতে কমিশন", "Paid on successful sales")}</Pill>
      </div>
      <div className="tabs">
        {[
          ["discover", "পণ্য খুঁজে নাও", "Discover products"],
          ["samples", "স্যাম্পল", "Samples"],
          ["earnings", "কমিশন লেজার", "Commission ledger"],
        ].map(([v, bn, en]) => (
          <button
            key={v}
            className={tab === v ? "selected" : ""}
            onClick={() => setTab(v)}
          >
            {t(bn, en)}
          </button>
        ))}
      </div>
      {tab === "discover" && (
        <div className="product-grid affiliate-grid">
          {data.products.map((p: Row) => {
            const plans =
              data.plans?.filter(
                (pl: Row) =>
                  (pl.kind === "shop" && pl.seller_id === p.seller_id) ||
                  pl.product_id === p.id,
              ) ?? [];
            const rate = Math.max(
              0,
              ...plans.map((pl: Row) => Math.min(pl.rate_bp, p.commission_bp)),
            );
            return (
              <article className="product-card" key={p.id}>
                <div className="product-image">
                  <img src={p.cover} alt="" />
                  <span className="commission-badge">
                    {rate / 100}% {t("কমিশন", "commission")}
                  </span>
                </div>
                <div className="product-info">
                  <small>{p.trade_name}</small>
                  <h3>{t(p.title_bn, p.title_en)}</h3>
                  <Money value={p.skus[0].price_paisa} />
                  <p>
                    {t("প্রতি বিক্রিতে সর্বোচ্চ", "Up to")}{" "}
                    <Money
                      value={Math.floor((p.skus[0].price_paisa * rate) / 10000)}
                    />{" "}
                    {t("কর কাটার আগে", "before withholding")}
                  </p>
                  <div className="actions">
                    <button
                      className="secondary small"
                      onClick={() =>
                        void act("showcase", {
                          productId: p.id,
                          add: !p.showcased,
                        }).catch(() => {})
                      }
                    >
                      {p.showcased ? <Check size={15} /> : <Plus size={15} />}{" "}
                      Showcase
                    </button>
                    {p.owner_id !== data.user.id && (
                      <button
                        className="text-button"
                        onClick={() =>
                          modal({
                            title: t("স্যাম্পল চাই", "Request a sample"),
                            fields: [
                              {
                                name: "pitch",
                                label: t(
                                  "তোমার কনটেন্ট প্ল্যান",
                                  "Your content plan",
                                ),
                                type: "textarea",
                              },
                            ],
                            submit: t("অনুরোধ পাঠাও", "Send request"),
                            onSubmit: async (v) => {
                              await act("sample", { productId: p.id, ...v });
                            },
                          })
                        }
                      >
                        {t("স্যাম্পল চাই", "Request sample")}
                      </button>
                    )}
                  </div>
                  {p.showcased && (
                    <button className="text-button" onClick={() => go("cut")}>
                      {t(
                        "পণ্যটি ট্যাগ করে গল্প তৈরি করো",
                        "Create a product-tagged story",
                      )}
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {tab === "samples" && (
        <div className="panel">
          {data.samples?.map((s: Row) => (
            <div className="sample-row" key={s.id}>
              <div>
                <h3>{s.title_en}</h3>
                <p>
                  {s.display_name} · {s.pitch}
                </p>
                <small>{s.tracking}</small>
              </div>
              <Pill>{s.state.replaceAll("_", " ")}</Pill>
              <div className="actions">
                {s.owner_id === data.user.id &&
                  s.state === "requested" &&
                  ["approved", "rejected"].map((state) => (
                    <button
                      key={state}
                      className="secondary small"
                      onClick={() =>
                        void act("sample-status", { id: s.id, state }).catch(
                          () => {},
                        )
                      }
                    >
                      {state === "approved" ? "Approve" : "Decline"}
                    </button>
                  ))}
                {s.owner_id === data.user.id && s.state === "approved" && (
                  <button
                    className="primary small"
                    onClick={() =>
                      modal({
                        title: "Ship sample",
                        fields: [
                          { name: "tracking", label: "Tracking reference" },
                        ],
                        submit: "Record shipment",
                        onSubmit: async (v) => {
                          await act("sample-status", {
                            id: s.id,
                            state: "shipped",
                            ...v,
                          });
                        },
                      })
                    }
                  >
                    Ship
                  </button>
                )}
                {s.creator_id === data.user.id &&
                  ["shipped", "received"].includes(s.state) && (
                    <button
                      className="primary small"
                      onClick={() =>
                        void act("sample-status", {
                          id: s.id,
                          state:
                            s.state === "shipped"
                              ? "received"
                              : "content_posted",
                        }).catch(() => {})
                      }
                    >
                      {s.state === "shipped"
                        ? "Mark received"
                        : "Mark content posted"}
                    </button>
                  )}
              </div>
            </div>
          ))}
          {!data.samples?.length && (
            <Empty title={t("এখনো স্যাম্পল নেই", "No sample requests yet")} />
          )}
        </div>
      )}
      {tab === "earnings" && (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Gross</th>
                <th>Withheld</th>
                <th>Net</th>
                <th>State</th>
                <th>Clears</th>
              </tr>
            </thead>
            <tbody>
              {data.accruals?.map((a: Row) => (
                <tr key={a.id}>
                  <td>{a.title_en}</td>
                  <td>
                    <Money value={a.commission_paisa} />
                  </td>
                  <td>
                    <Money value={a.withholding_paisa} />
                  </td>
                  <td>
                    <Money value={a.net_paisa} />
                  </td>
                  <td>
                    <Pill>{a.state}</Pill>
                  </td>
                  <td>{new Date(a.hold_until).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.accruals?.length && (
            <Empty
              title={t(
                "প্রথম কমিশনের অপেক্ষা",
                "Your first commission is ahead",
              )}
              body="A buyer must click your product tag before purchasing. Earnings accrue at delivery."
            />
          )}
        </div>
      )}
    </>
  );
}
export function Ads() {
  const { data, t, modal, act } = useApp();
  const isSeller = data.seller?.state === "active";
  return (
    <>
      <Heading
        eyebrow="BDOS ADS"
        title={t(
          "ভালো গল্প, আরও মানুষের কাছে।",
          "Give good stories a bigger stage.",
        )}
        description={t(
          "অনুমতিসহ অর্গানিক গল্প প্রোমোট করো।",
          "Promote organic stories with creator permission and transparent budgets.",
        )}
        action={
          isSeller && (
            <button
              className="primary"
              onClick={() =>
                modal({
                  title: "Create Spark campaign",
                  description:
                    "Review is required before serving. Creator receives 10% of billed impression spend. Charges are per impression in this MVP.",
                  fields: [
                    { name: "name", label: "Campaign name" },
                    {
                      name: "postId",
                      label: "Authorised creator post",
                      options: options(data.consentPosts ?? [], "caption"),
                    },
                    {
                      name: "productId",
                      label: "Your product",
                      options: options(
                        data.products.filter(
                          (p: Row) => p.owner_id === data.user.id,
                        ),
                      ),
                    },
                    {
                      name: "objective",
                      label: "Objective",
                      options: [
                        "reach",
                        "traffic",
                        "engagement",
                        "conversion",
                        "product_sales",
                      ].map((v) => ({
                        value: v,
                        label: v.replaceAll("_", " "),
                      })),
                    },
                    {
                      name: "budget",
                      label: "Total cap (৳)",
                      type: "number",
                      value: 1000,
                      min: 1,
                    },
                    {
                      name: "daily",
                      label: "Daily cap (৳)",
                      type: "number",
                      value: 100,
                      min: 1,
                    },
                    {
                      name: "bid",
                      label: "Cost per impression (৳)",
                      type: "number",
                      value: 0.1,
                      min: 0.01,
                      step: ".01",
                    },
                  ],
                  submit: "Submit for review",
                  onSubmit: async (v) => {
                    await act("campaign", {
                      ...v,
                      budget: Math.round(v.budget * 100),
                      daily: Math.round(v.daily * 100),
                      bid: Math.round(v.bid * 100),
                    });
                  },
                })
              }
            >
              <Plus size={16} />
              {t("ক্যাম্পেইন তৈরি", "Create campaign")}
            </button>
          )
        }
      />
      <Stats
        items={[
          { label: "Campaigns", value: data.campaigns?.length ?? 0 },
          {
            label: "Spend",
            value: (
              <Money
                value={
                  data.campaigns?.reduce(
                    (s: number, c: Row) => s + c.spent_paisa,
                    0,
                  ) ?? 0
                }
              />
            ),
          },
          {
            label: "Impressions",
            value:
              data.campaigns?.reduce(
                (s: number, c: Row) => s + c.impressions,
                0,
              ) ?? 0,
          },
          {
            label: "Clicks",
            value:
              data.campaigns?.reduce((s: number, c: Row) => s + c.clicks, 0) ??
              0,
          },
        ]}
      />
      <div className="two-columns">
        <div className="panel">
          <div className="section-header">
            <h2>{t("ক্যাম্পেইন", "Campaigns")}</h2>
            <Topup />
          </div>
          {data.campaigns?.map((c: Row) => (
            <article className="brief" key={c.id}>
              <div className="section-header">
                <h3>{c.name}</h3>
                <Pill>{c.state.replaceAll("_", " ")}</Pill>
              </div>
              <p>
                {c.objective.replaceAll("_", " ")} · {c.impressions} impressions
                · {c.clicks} clicks · {c.conversions} orders
              </p>
              <div className="budget-bar">
                <span
                  style={{
                    width: `${Math.min(100, (c.spent_paisa / c.total_budget_paisa) * 100)}%`,
                  }}
                />
              </div>
              <p>
                <Money value={c.spent_paisa} /> /{" "}
                <Money value={c.total_budget_paisa} />
              </p>
              {["active", "paused"].includes(c.state) && (
                <button
                  className="secondary small"
                  onClick={() =>
                    void act("campaign-toggle", {
                      id: c.id,
                      active: c.state === "paused",
                    }).catch(() => {})
                  }
                >
                  {c.state === "active" ? "Pause" : "Resume"}
                </button>
              )}
            </article>
          ))}
          {!data.campaigns?.length && (
            <Empty
              title={t("একটা গল্পকে বড় করো", "Put a story in the spotlight")}
              body="Approved sellers can create campaigns using creator-authorised posts."
            />
          )}
        </div>
        <div className="panel">
          <h2>{t("Spark অনুমতি", "Spark permissions")}</h2>
          <p>
            {t(
              "তোমার পোস্ট কে প্রোমোট করবে, তুমিই ঠিক করো।",
              "Choose who can promote your posts. Revoking permission pauses their campaigns.",
            )}
          </p>
          <button
            className="secondary"
            onClick={() =>
              modal({
                title: "Grant promotion permission",
                fields: [
                  {
                    name: "postId",
                    label: "Your published post",
                    options: options(
                      (data.ownPosts ?? []).filter(
                        (p: Row) => p.state === "published",
                      ),
                      "caption",
                    ),
                  },
                  {
                    name: "sellerId",
                    label: "Seller",
                    options: options(data.sellers, "trade_name"),
                  },
                ],
                submit: "Grant permission",
                onSubmit: async (v) => {
                  await act("spark-consent", { ...v, grant: true });
                },
              })
            }
          >
            + {t("অনুমতি দাও", "Grant permission")}
          </button>
          {data.consents?.map((c: Row) => (
            <article className="list-item" key={c.post_id + c.seller_id}>
              <strong>{c.trade_name}</strong>
              <p>{c.caption}</p>
              <button
                className="text-button"
                onClick={() =>
                  void act("spark-consent", {
                    postId: c.post_id,
                    sellerId: c.seller_id,
                    grant: false,
                  }).catch(() => {})
                }
              >
                Revoke permission
              </button>
            </article>
          ))}
          <div className="notice">
            Separate paid placement · maximum one ad per feed page · always
            labelled Sponsored. Organic ranking is unaffected.
          </div>
        </div>
      </div>
    </>
  );
}
export function Profile() {
  const { data, t, act, modal } = useApp();
  const s = data.settings ?? {};
  return (
    <>
      <Heading
        eyebrow="PROFILE & NIRAPOD"
        title={t("তোমার দুনিয়া। তোমার নিয়ন্ত্রণ।", "Your space. Your rules.")}
        description={t(
          "নিজের মতো থাকো। নিরাপদ থাকো।",
          "Be yourself. Feel safer doing it.",
        )}
      />
      <div className="two-columns">
        <form
          className="panel profile-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await act("profile", {
              name: f.get("name"),
              bio: f.get("bio"),
              locale: f.get("locale"),
              dataSaver: f.get("dataSaver") === "on",
              dm: f.get("dm"),
              filter: f.get("filter"),
              duet: f.get("duet") === "on",
              stitch: f.get("stitch") === "on",
            }).catch(() => {});
          }}
        >
          <div className="profile-identity">
            <Avatar name={data.user.display_name} size="large" />
            <div>
              <h2>{data.user.display_name}</h2>
              <p>@{data.user.handle}</p>
            </div>
          </div>
          <label>
            {t("নাম", "Name")}
            <input
              name="name"
              defaultValue={data.user.display_name}
              maxLength={40}
              required
            />
          </label>
          <label>
            {t("বায়ো", "Bio")}
            <textarea
              name="bio"
              defaultValue={data.profile?.bio ?? ""}
              maxLength={200}
            />
          </label>
          <label>
            {t("ভাষা", "Language")}
            <select name="locale" defaultValue={data.user.locale}>
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            {t("কে মেসেজ দিতে পারবে", "Who can message you")}
            <select name="dm" defaultValue={s.dm_from ?? "nobody"}>
              <option value="nobody">Nobody · বন্ধ</option>
              <option value="following">People I follow</option>
              <option value="everyone">Everyone</option>
            </select>
          </label>
          <label>
            {t("কমেন্ট ফিল্টার", "Comment filter")}
            <select name="filter" defaultValue={s.comment_filter ?? "strict"}>
              <option value="strict">Strict</option>
              <option value="standard">Standard</option>
              <option value="off">Off</option>
            </select>
          </label>
          {[
            ["dataSaver", "ডেটা সেভার", "Data Saver", data.user.data_saver],
            ["duet", "Duet অনুমতি", "Allow Duet", s.allow_duet],
            ["stitch", "Stitch অনুমতি", "Allow Stitch", s.allow_stitch],
          ].map(([name, bn, en, value]) => (
            <label className="checkbox-label" key={String(name)}>
              <input
                name={String(name)}
                type="checkbox"
                defaultChecked={!!value}
              />
              {t(String(bn), String(en))}
            </label>
          ))}
          <button className="primary">
            {t("পরিবর্তন সেভ করো", "Save changes")}
            <Check size={16} />
          </button>
        </form>
        <div>
          <Payouts />
          <div className="panel">
            <h2>{t("ব্লক করা অ্যাকাউন্ট", "Blocked accounts")}</h2>
            {data.blocks?.map((b: Row) => (
              <div className="section-header" key={b.id}>
                <span>{b.display_name}</span>
                <button
                  className="text-button"
                  onClick={() =>
                    void act("unblock", { id: b.id }).catch(() => {})
                  }
                >
                  Unblock
                </button>
              </div>
            ))}
            {!data.blocks?.length && (
              <p>
                {t(
                  "কোনো অ্যাকাউন্ট ব্লক করা নেই।",
                  "You have no blocked accounts.",
                )}
              </p>
            )}
          </div>
          <div className="panel">
            <h2>{t("সেফটি সিদ্ধান্ত ও আপিল", "Safety decisions & appeals")}</h2>
            {data.cases?.map((c: Row) => (
              <article className="list-item" key={c.id}>
                <Pill>{c.state}</Pill>
                <p>{t(c.reason_bn, c.reason_en)}</p>
                {c.state === "actioned" && !c.appealed && (
                  <button
                    className="secondary"
                    onClick={() =>
                      modal({
                        title: "Appeal this decision",
                        fields: [
                          {
                            name: "statement",
                            label: "Why should we reconsider?",
                            type: "textarea",
                          },
                        ],
                        submit: "Submit appeal",
                        onSubmit: async (v) => {
                          await act("appeal", { id: c.id, ...v });
                        },
                      })
                    }
                  >
                    Appeal
                  </button>
                )}
              </article>
            ))}
            {!data.cases?.length && (
              <p>
                {t(
                  "এখনো কোনো সিদ্ধান্ত নেই।",
                  "No safety decisions on your account.",
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
export function Inbox() {
  const { data, t, modal, act } = useApp();
  return (
    <>
      <Heading
        eyebrow="INBOX"
        title={t(
          "কথা হোক, সম্মান রেখে।",
          "Good conversations start with respect.",
        )}
        action={
          <button
            className="primary"
            onClick={() =>
              modal({
                title: t("নতুন মেসেজ", "New message"),
                description:
                  "The recipient’s DM permissions apply. New accounts have DMs off by default.",
                fields: [
                  {
                    name: "id",
                    label: t("প্রাপক", "Recipient"),
                    options: options(data.people, "display_name"),
                  },
                  {
                    name: "body",
                    label: t("মেসেজ", "Message"),
                    type: "textarea",
                    max: 2000,
                  },
                ],
                submit: t("পাঠাও", "Send message"),
                onSubmit: async (v) => {
                  await act("message", v);
                },
              })
            }
          >
            <Send size={16} />
            {t("নতুন মেসেজ", "New message")}
          </button>
        }
      />
      <div className="panel messages">
        {data.messages?.map((m: Row) => (
          <article
            key={m.id}
            className={m.sender_id === data.user.id ? "sent" : ""}
          >
            <Avatar name={m.sender_name} />
            <div>
              <strong>
                {m.sender_name} → {m.recipient_name}
              </strong>
              <p>{m.body}</p>
              <small>{new Date(m.created_at).toLocaleString()}</small>
            </div>
          </article>
        ))}
        {!data.messages?.length && (
          <Empty
            title={t("এখনো কোনো কথোপকথন নেই", "Your inbox is quiet")}
            body="Recipients choose who can reach them in Profile & Nirapod."
          />
        )}
      </div>
    </>
  );
}
export function Partner() {
  const { data, t, modal, act } = useApp();
  return (
    <>
      <Heading
        eyebrow="BDOS PARTNER NETWORK"
        title={t(
          "স্থানীয় ব্যবসার নতুন মঞ্চ।",
          "Bring local businesses on stage.",
        )}
        description="Track the businesses you introduce to the BDOS seller ecosystem."
        action={
          <button
            className="primary"
            onClick={() =>
              modal({
                title: "Refer a local business",
                fields: [
                  { name: "name", label: "Business name" },
                  { name: "district", label: "District" },
                  { name: "phone", label: "Phone (+880…)" },
                ],
                submit: "Submit lead",
                onSubmit: async (v) => {
                  await act("partner-lead", v);
                },
              })
            }
          >
            <Plus size={16} />
            Add business
          </button>
        }
      />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Business</th>
              <th>District</th>
              <th>Phone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.leads?.map((l: Row) => (
              <tr key={l.id}>
                <td>{l.business_name}</td>
                <td>{l.district}</td>
                <td>{l.phone}</td>
                <td>
                  <Pill>{l.state}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.leads?.length && (
          <Empty title="Your first introduction starts here" />
        )}
      </div>
    </>
  );
}
export function Admin() {
  const { data, t, act, modal } = useApp();
  const [tab, setTab] = useState("safety");
  const cases =
    data.cases?.filter((c: Row) =>
      ["open", "human_review", "appealed"].includes(c.state),
    ) ?? [];
  return (
    <>
      <Heading
        eyebrow="BDOS OPERATIONS"
        title={t("বিশ্বাসের পেছনের কাজ।", "The work behind the trust.")}
        description="Human review, platform controls, and the money trail."
        action={
          <button
            className="secondary"
            onClick={() => void act("admin-clear").catch(() => {})}
          >
            <RefreshCw size={16} />
            Clear eligible commissions
          </button>
        }
      />
      <Stats
        items={[
          {
            label: "Ledger drift (paisa)",
            value: data.trial?.drift_paisa ?? 0,
            note: "Internal balance only; not bank reconciliation",
          },
          { label: "Posted journals", value: data.trial?.entries ?? 0 },
          { label: "Safety queue", value: cases.length },
          {
            label: "Pending reviews",
            value:
              (data.pendingSellers?.length ?? 0) +
              (data.pendingKyc?.length ?? 0) +
              (data.pendingCampaigns?.length ?? 0),
          },
        ]}
      />
      <div className="tabs">
        {["safety", "reviews", "ledger", "controls", "partners"].map((v) => (
          <button
            key={v}
            className={tab === v ? "selected" : ""}
            onClick={() => setTab(v)}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      {tab === "safety" && (
        <div className="panel">
          {cases.map((c: Row) => (
            <article className="case" key={c.id}>
              <div className="section-header">
                <h3>
                  {c.category.replaceAll("_", " ")} · {c.display_name}
                </h3>
                <Pill>
                  {c.severity} · {c.state}
                </Pill>
              </div>
              <p>{c.caption}</p>
              {c.appeal_statement && (
                <blockquote>{c.appeal_statement}</blockquote>
              )}
              <button
                className="secondary"
                onClick={() =>
                  modal({
                    title: "Record moderation decision",
                    fields: [
                      {
                        name: "decision",
                        label: "Decision",
                        options: (c.state === "appealed"
                          ? ["uphold", "overturn"]
                          : ["remove", "dismiss"]
                        ).map((v) => ({ value: v, label: v })),
                      },
                      {
                        name: "reasonBn",
                        label: "Plain Bangla reason",
                        type: "textarea",
                      },
                      {
                        name: "reasonEn",
                        label: "English reason",
                        type: "textarea",
                      },
                    ],
                    submit: "Save decision",
                    onSubmit: async (v) => {
                      await act("admin-moderate", { id: c.id, ...v });
                    },
                  })
                }
              >
                Review case
              </button>
            </article>
          ))}
          {!cases.length && <Empty title="The safety queue is clear" />}
        </div>
      )}
      {tab === "reviews" && (
        <div className="three-columns">
          {[
            ["Sellers", "pendingSellers", "admin-seller", "trade_name"],
            ["Identity · sandbox", "pendingKyc", "admin-kyc", "display_name"],
            ["Campaigns", "pendingCampaigns", "admin-campaign", "name"],
          ].map(([title, key, command, name]) => (
            <div className="panel" key={key}>
              <h2>{title}</h2>
              {data[key]?.map((r: Row) => (
                <article className="list-item" key={r.id}>
                  <strong>{r[name]}</strong>
                  <p>
                    {r.dbid ?? r.objective ?? "Synthetic identity verification"}
                  </p>
                  <div className="actions">
                    <button
                      className="primary small"
                      onClick={() =>
                        void act(command, { id: r.id, approve: true }).catch(
                          () => {},
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="secondary small"
                      onClick={() =>
                        void act(command, { id: r.id, approve: false }).catch(
                          () => {},
                        )
                      }
                    >
                      Decline
                    </button>
                  </div>
                </article>
              ))}
              {!data[key]?.length && (
                <p className="muted">No pending reviews.</p>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === "ledger" && (
        <div className="panel table-wrap">
          <h2>Append-only journal</h2>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Description</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {data.journals?.map((j: Row) => (
                <tr key={j.id}>
                  <td>{new Date(j.created_at).toLocaleString()}</td>
                  <td>{j.kind.replaceAll("_", " ")}</td>
                  <td>{j.description}</td>
                  <td className="mono">{j.id.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "controls" && (
        <div className="two-columns">
          <div className="panel">
            <h2>Feature switches</h2>
            <p>Server-side switches stop new actions for each surface.</p>
            {data.flags.map((f: Row) => (
              <div className="switch-row" key={f.name}>
                <strong>{f.name}</strong>
                <button
                  role="switch"
                  aria-checked={f.enabled}
                  className={`switch ${f.enabled ? "enabled" : ""}`}
                  onClick={() =>
                    void act("admin-flag", {
                      name: f.name,
                      enabled: !f.enabled,
                    }).catch(() => {})
                  }
                >
                  <span />
                </button>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>Audit trail</h2>
            {data.audit?.map((a: Row) => (
              <div className="audit-row" key={a.id}>
                <strong>{a.action}</strong>
                <small>
                  {a.display_name} · {new Date(a.at).toLocaleString()}
                </small>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "partners" && (
        <div className="panel">
          {data.leads?.map((l: Row) => (
            <article className="list-item" key={l.id}>
              <h3>{l.business_name}</h3>
              <p>
                {l.district} · {l.phone} · {l.state}
              </p>
              <div className="actions">
                {["contacted", "onboarded", "rejected"].map((state) => (
                  <button
                    className="secondary small"
                    key={state}
                    onClick={() =>
                      void act("admin-lead", { id: l.id, state }).catch(
                        () => {},
                      )
                    }
                  >
                    {state}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {!data.leads?.length && <Empty title="No partner referrals yet" />}
        </div>
      )}
    </>
  );
}
