"use client";
import { useState } from "react";
import {
  ShoppingBag,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Package,
  Truck,
  X,
  ChevronRight,
} from "lucide-react";
import {
  useApp,
  Heading,
  Money,
  Stats,
  Empty,
  Pill,
  options,
  When,
  type Row,
} from "./ui";
export function Shop() {
  const { data, t, act, modal, money, go } = useApp();
  const [category, setCategory] = useState(0),
    [search, setSearch] = useState("");
  const products = data.products.filter(
    (p: Row) =>
      (!category || p.category_id === category) &&
      `${p.title_en} ${p.title_bn}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        eyebrow="BDOS SHOP"
        title={t("দেশের তৈরি। তোমার পছন্দ।", "Local craft. Lovely finds.")}
        description={t(
          "বিশ্বস্ত বিক্রেতা থেকে তোমার দরজায়।",
          "From independent makers to your doorstep.",
        )}
      />
      <div className="shop-layout">
        <section>
          <div className="shop-hero">
            <div>
              <p className="eyebrow">CRAFTED CLOSE TO HOME</p>
              <h2>
                {t("প্রতিটি পণ্যে একটা গল্প।", "Every find has a story.")}
              </h2>
              <p>
                {t(
                  "মানুষের হাতে গড়া। মন থেকে বেছে নেওয়া।",
                  "Made by people. Chosen with heart.",
                )}
              </p>
              <Pill>{t("৭ দিনের রিটার্ন", "7-day return window")}</Pill>
            </div>
            <img
              src="/art/craft.svg"
              alt="Original illustration of handwoven Jamdani"
            />
          </div>
          <div className="catalog-toolbar">
            <input
              aria-label="Search products"
              placeholder={t("পণ্য খোঁজো…", "Search products…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(Number(e.target.value))}
            >
              <option value={0}>{t("সব বিভাগ", "All categories")}</option>
              {data.categories.map((c: Row) => (
                <option value={c.id} key={c.id}>
                  {t(c.name_bn, c.name_en)}
                </option>
              ))}
            </select>
          </div>
          <div className="product-grid">
            {products.map((p: Row) => (
              <Product key={p.id} product={p} />
            ))}
          </div>
          {!products.length && (
            <Empty title={t("কোনো পণ্য পাওয়া যায়নি", "No products found")} />
          )}
        </section>
        <Cart />
      </div>
    </>
  );
}
export function Product({ product: p }: { product: Row }) {
  const { t, act, modal, data } = useApp();
  const first = p.skus[0];
  return (
    <article className="product-card">
      <div className="product-image">
        <img src={p.cover} alt={t(p.title_bn, p.title_en)} loading="lazy" />
        <span className="product-category">
          {t(p.category_bn, p.category_en)}
        </span>
      </div>
      <div className="product-info">
        <small>{p.trade_name}</small>
        <h3>{t(p.title_bn, p.title_en)}</h3>
        <p>{p.description}</p>
        <div className="product-price">
          <Money value={first.price_paisa} />
          <span>
            {first.stock
              ? `${first.stock} ${t("টি আছে", "in stock")}`
              : t("স্টক শেষ", "Sold out")}
          </span>
        </div>
        <div className="trust-label">
          <ShieldCheck size={14} />
          {t("ভরসা", "Bharosha")} {p.bharosha}/100{" "}
          <span>· {t("স্যান্ডবক্স স্কোর", "sandbox score")}</span>
        </div>
        <button
          className="secondary full"
          disabled={
            !p.skus.some((s: Row) => s.stock > 0) || p.owner_id === data.user.id
          }
          onClick={() =>
            modal({
              title: t(p.title_bn, p.title_en),
              description: t(
                "ডেলিভারি প্রতি বিক্রেতা ৳৬০।",
                "Delivery is ৳60 per seller.",
              ),
              fields: [
                {
                  name: "skuId",
                  label: t("ভ্যারিয়েন্ট", "Variant"),
                  options: p.skus.map((s: Row) => ({
                    value: s.id,
                    label: `${s.variant_label} · ৳${s.price_paisa / 100} · ${s.stock} available`,
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
                await act("cart", v);
              },
            })
          }
        >
          <ShoppingBag size={16} />
          {t("কার্টে যোগ করো", "Add to cart")}
        </button>
      </div>
    </article>
  );
}
function Cart() {
  const { data, t, act, modal, go, money } = useApp();
  const goods = data.cart.reduce(
      (s: number, i: Row) => s + i.qty * i.price_paisa,
      0,
    ),
    delivery = new Set(data.cart.map((i: Row) => i.seller_id)).size * 6000;
  return (
    <aside className="panel cart">
      <div className="section-header">
        <h2>{t("তোমার ব্যাগ", "Your bag")}</h2>
        <Pill>{data.cart.length}</Pill>
      </div>
      {data.cart.length ? (
        <>
          {data.cart.map((i: Row) => (
            <article className="cart-item" key={i.sku_id}>
              <img src={i.cover} alt="" />
              <div>
                <strong>{t(i.title_bn, i.title_en)}</strong>
                <small>
                  {i.variant_label} · ×{i.qty}
                </small>
                <Money value={i.qty * i.price_paisa} />
              </div>
              <button
                className="icon-button"
                aria-label="Remove cart item"
                onClick={() =>
                  void act("cart", { skuId: i.sku_id, qty: 0 }).catch(() => {})
                }
              >
                <X size={15} />
              </button>
            </article>
          ))}
          <div className="cart-totals">
            <div>
              <span>{t("পণ্যের মূল্য", "Subtotal")}</span>
              <Money value={goods} />
            </div>
            <div>
              <span>{t("ডেলিভারি", "Delivery")}</span>
              <Money value={delivery} />
            </div>
            <div className="total">
              <strong>{t("মোট", "Total")}</strong>
              <Money value={goods + delivery} />
            </div>
          </div>
          <button
            className="primary full"
            onClick={() =>
              modal({
                title: t("অর্ডার সম্পন্ন করো", "Place your order"),
                description: t(
                  "COD-তে ডেলিভারি ফি আগে। ডিজিটাল পেমেন্টে পুরো টাকা ডেলিভারি পর্যন্ত এসক্রোতে থাকবে। সব পেমেন্ট স্যান্ডবক্স।",
                  "COD prepays the delivery fee; digital payments are held in escrow. All payments are sandbox simulations.",
                ),
                fields: [
                  {
                    name: "address",
                    label: t("সম্পূর্ণ ঠিকানা", "Full delivery address"),
                    type: "textarea",
                  },
                  {
                    name: "district",
                    label: t("জেলা", "District"),
                    value: "Dhaka",
                  },
                  {
                    name: "method",
                    label: t("পেমেন্ট", "Payment method"),
                    options: [
                      { value: "cod", label: "Cash on delivery" },
                      { value: "bkash", label: "bKash · sandbox" },
                      { value: "nagad", label: "Nagad · sandbox" },
                      { value: "card", label: "Card · sandbox" },
                    ],
                  },
                  {
                    name: "voucher",
                    label: t("ভাউচার (ঐচ্ছিক)", "Voucher (optional)"),
                    required: false,
                  },
                ],
                submit: t("অর্ডার করো", "Place order"),
                onSubmit: async (v) => {
                  await act("checkout", v);
                  go("orders");
                },
              })
            }
          >
            {t("চেকআউট", "Checkout")}
            <ArrowUpRight size={17} />
          </button>
          <small className="checkout-note">
            <ShieldCheck size={14} />
            {t(
              "ডেলিভারি নিশ্চিত হলে এসক্রো ছাড়ে।",
              "Escrow releases after confirmed delivery.",
            )}
          </small>
        </>
      ) : (
        <Empty
          title={t("তোমার ব্যাগ খালি", "Your bag is empty")}
          body={t(
            "পছন্দের পণ্য খুঁজে যোগ করো।",
            "Find something you love and add it here.",
          )}
        />
      )}
    </aside>
  );
}
export function Orders({ seller = false }: { seller?: boolean }) {
  const { data, t } = useApp();
  return (
    <>
      {!seller && (
        <Heading
          eyebrow="BDOS SHOP"
          title={t("তোমার অর্ডার", "Your orders")}
          description={t(
            "পেমেন্ট থেকে ডেলিভারি — প্রতিটি ধাপ এক জায়গায়।",
            "From payment to your doorstep, every step in one place.",
          )}
        />
      )}
      <div className="order-list">
        {data.orders?.map((o: Row) => (
          <Order key={o.id} order={o} seller={seller} />
        ))}
      </div>
      {!data.orders?.length && (
        <Empty
          title={t("এখনো অর্ডার নেই", "No orders yet")}
          body={t(
            "নতুন অর্ডার এখানে দেখা যাবে।",
            "New orders will appear here with their progress.",
          )}
        />
      )}
    </>
  );
}
function Order({ order: o, seller }: { order: Row; seller: boolean }) {
  const { t, act, modal } = useApp();
  const move = (step: string, extra: Row = {}) =>
    void act("order", { id: o.id, step, ...extra }).catch(() => {});
  return (
    <article className="panel order-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">#{o.id.slice(0, 8)}</span>
          <h3>{o.trade_name}</h3>
        </div>
        <Pill>{o.state.replaceAll("_", " ")}</Pill>
      </div>
      {o.items?.map((i: Row, index: number) => (
        <div className="order-line" key={index}>
          <span>
            {i.title}{" "}
            <small>
              {i.variant} · ×{i.qty}
            </small>
          </span>
          <Money value={i.unit_paisa * i.qty} />
        </div>
      ))}
      <div className="order-details">
        <span>
          <Truck size={15} />
          {o.district} · {o.address}
        </span>
        <span>
          {o.payment_method.toUpperCase()} · {t("মোট", "Total")}{" "}
          <Money value={o.payable_paisa} />
        </span>
        {o.tracking && (
          <span>
            {t("ট্র্যাকিং", "Tracking")}: {o.tracking}
          </span>
        )}
        {o.return_window_ends && (
          <span>
            {t("রিটার্নের শেষ তারিখ", "Return window closes")}:{" "}
            <When value={o.return_window_ends} />
          </span>
        )}
        {o.return_reason && <span>{o.return_reason}</span>}
      </div>
      <div className="actions">
        {!seller && ["created", "paid_in_escrow"].includes(o.state) && (
          <button className="primary small" onClick={() => move("confirm")}>
            {t("ঠিকানা নিশ্চিত করো", "Confirm delivery details")}
          </button>
        )}
        {seller && o.state === "confirmed" && (
          <button
            className="primary small"
            onClick={() =>
              modal({
                title: t("অর্ডার পাঠাও", "Dispatch order"),
                description:
                  "Sandbox courier adapter. A simulated tracking reference will be created.",
                fields: [
                  {
                    name: "courier",
                    label: t("কুরিয়ার", "Courier"),
                    options: [
                      "Pathao",
                      "Steadfast",
                      "RedX",
                      "Paperfly",
                      "eCourier",
                      "Sundarban",
                    ].map((n, i) => ({ value: String(i + 1), label: n })),
                  },
                ],
                submit: t("পাঠাও", "Dispatch"),
                onSubmit: async (v) => {
                  await act("order", {
                    id: o.id,
                    step: "ship",
                    courier: Number(v.courier),
                  });
                },
              })
            }
          >
            {t("পাঠাও", "Dispatch")}
          </button>
        )}
        {!seller && o.state === "shipped" && (
          <button className="primary small" onClick={() => move("deliver")}>
            {t("পণ্য পেয়েছি", "Confirm received")}
          </button>
        )}
        {["created", "paid_in_escrow", "confirmed"].includes(o.state) && (
          <button className="secondary small" onClick={() => move("cancel")}>
            {t("অর্ডার বাতিল", "Cancel order")}
          </button>
        )}
        {!seller &&
          o.state === "delivered" &&
          new Date(o.return_window_ends) > new Date() && (
            <button
              className="secondary small"
              onClick={() =>
                modal({
                  title: t("ফেরত দিতে চাই", "Request a return"),
                  fields: [
                    {
                      name: "reason",
                      label: t("কারণ", "Reason"),
                      type: "textarea",
                    },
                  ],
                  submit: t("রিটার্ন অনুরোধ", "Request return"),
                  onSubmit: async (v) => {
                    await act("order", { id: o.id, step: "return", ...v });
                  },
                })
              }
            >
              {t("ফেরত দাও", "Request return")}
            </button>
          )}
        {seller && o.state === "returned" && (
          <button className="primary small" onClick={() => move("refund")}>
            {t("রিটার্ন ও রিফান্ড অনুমোদন", "Approve return & refund")}
          </button>
        )}
        {seller && o.state === "shipped" && (
          <button className="secondary small" onClick={() => move("rto")}>
            {t("ডেলিভারি ব্যর্থ (RTO)", "Record failed delivery (RTO)")}
          </button>
        )}
      </div>
    </article>
  );
}
export function Seller() {
  const { data, t, modal, act } = useApp();
  const [tab, setTab] = useState("catalog");
  const seller = data.seller;
  const edit = (p?: Row) =>
    modal({
      title: p
        ? t("পণ্য আপডেট", "Edit product")
        : t("নতুন পণ্য", "List a product"),
      fields: [
        { name: "title", label: "English title", value: p?.title_en },
        { name: "titleBn", label: "বাংলা নাম", value: p?.title_bn },
        {
          name: "description",
          label: t("বিবরণ", "Description"),
          type: "textarea",
          value: p?.description,
        },
        {
          name: "category",
          label: t("বিভাগ", "Category"),
          options: data.categories.map((c: Row) => ({
            value: String(c.id),
            label: t(c.name_bn, c.name_en),
          })),
          value: p?.category_id,
        },
        {
          name: "price",
          label: t("দাম (৳)", "Price (৳)"),
          type: "number",
          min: 1,
          step: "0.01",
          value: p
            ? p.skus.find((s: Row) => s.code === "default").price_paisa / 100
            : 500,
        },
        {
          name: "stock",
          label: t("স্টক", "Stock"),
          type: "number",
          min: 0,
          value: p ? p.skus.find((s: Row) => s.code === "default").stock : 10,
        },
        {
          name: "variant",
          label: t("ভ্যারিয়েন্ট", "Variant"),
          value: p
            ? p.skus.find((s: Row) => s.code === "default").variant_label
            : "Default",
        },
        {
          name: "cover",
          label: t("কভার", "Cover artwork"),
          options: ["craft", "beauty", "food", "stage"].map((v) => ({
            value: `/art/${v}.svg`,
            label: v,
          })),
          value: p?.cover,
        },
        {
          name: "active",
          label: t("বিক্রির জন্য সক্রিয়", "Active for sale"),
          type: "checkbox",
          value: p ? p.is_active : true,
        },
      ],
      submit: t("সেভ করো", "Save product"),
      onSubmit: async (v) => {
        await act("product", {
          ...v,
          id: p?.id,
          version: p?.version,
          skuVersion: p?.skus.find((s: Row) => s.code === "default")?.version,
          category: Number(v.category),
          price: Math.round(v.price * 100),
        });
      },
    });
  return (
    <>
      <Heading
        eyebrow="SELLER CENTER"
        title={t("ব্যবসা বাড়ুক, সহজে।", "Your business, in good hands.")}
        description={
          seller?.trade_name ??
          t(
            "স্থানীয় ব্যবসা, নতুন সম্ভাবনা।",
            "Local business. New possibilities.",
          )
        }
        action={
          seller?.state === "active" && (
            <button className="primary" onClick={() => edit()}>
              <Plus size={17} />
              {t("নতুন পণ্য", "List a product")}
            </button>
          )
        }
      />
      {seller?.state !== "active" ? (
        <div className="panel">
          <h2>{t("বিক্রেতা হও", "Become a seller")}</h2>
          <p>
            {seller
              ? `Application status: ${seller.state}`
              : "Apply with your business name and registration reference. Operations reviews every seller."}
          </p>
          <button
            className="primary"
            onClick={() =>
              modal({
                title: t("বিক্রেতার আবেদন", "Seller application"),
                fields: [
                  {
                    name: "name",
                    label: t("ব্যবসার নাম", "Business name"),
                    value: seller?.trade_name,
                  },
                  {
                    name: "dbid",
                    label: "DBID / sandbox registration reference",
                    value: seller?.dbid,
                  },
                ],
                submit: t("আবেদন করো", "Submit application"),
                onSubmit: async (v) => {
                  await act("seller-apply", v);
                },
              })
            }
          >
            {t("আবেদন করো", "Apply")}
          </button>
        </div>
      ) : (
        <>
          <Stats
            items={[
              { label: t("অর্ডার", "Orders"), value: data.orders?.length ?? 0 },
              {
                label: t("ডেলিভারি হয়েছে", "Delivered"),
                value:
                  data.orders?.filter((o: Row) =>
                    ["delivered", "completed"].includes(o.state),
                  ).length ?? 0,
              },
              {
                label: t("উত্তোলনযোগ্য", "Available for payout"),
                value: <Money value={data.sellerBalance} />,
                note: t("রিটার্ন উইন্ডোর পর", "After return-window holds"),
              },
              {
                label: t("ভরসা স্কোর", "Bharosha"),
                value: `${seller.bharosha}/100`,
              },
            ]}
          />
          <div className="tabs">
            {[
              ["catalog", "ক্যাটালগ", "Catalog"],
              ["orders", "অর্ডার", "Orders"],
              ["promotions", "প্রোমোশন", "Promotions"],
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
          {tab === "catalog" && (
            <div className="panel table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("পণ্য", "Product")}</th>
                    <th>{t("ভ্যারিয়েন্ট", "Variants")}</th>
                    <th>{t("স্ট্যাটাস", "Status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.ownProducts?.map((p: Row) => (
                    <tr key={p.id}>
                      <td>
                        <div className="table-product">
                          <img src={p.cover} alt="" />
                          <span>
                            <strong>{t(p.title_bn, p.title_en)}</strong>
                            <small>{p.category_en}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        {p.skus.map((s: Row) => (
                          <div key={s.id}>
                            {s.variant_label} · {s.stock} ·{" "}
                            <Money value={s.price_paisa} />
                            <button
                              className="text-button"
                              aria-label={`Edit variant ${s.variant_label}`}
                              onClick={() =>
                                modal({
                                  title: t(
                                    "ভ্যারিয়েন্ট আপডেট",
                                    "Edit variant",
                                  ),
                                  description: t(
                                    "স্টক পরিবর্তন হলে আবার খুলতে হবে।",
                                    "If stock changes, refresh and reopen this form.",
                                  ),
                                  fields: [
                                    {
                                      name: "label",
                                      label: "Variant label",
                                      value: s.variant_label,
                                    },
                                    {
                                      name: "price",
                                      label: "Price (৳)",
                                      type: "number",
                                      min: 1,
                                      step: "0.01",
                                      value: s.price_paisa / 100,
                                    },
                                    {
                                      name: "stock",
                                      label: "Available stock",
                                      type: "number",
                                      min: 0,
                                      value: s.stock,
                                    },
                                  ],
                                  submit: t("সেভ করো", "Save variant"),
                                  onSubmit: async (v) => {
                                    await act("sku", {
                                      ...v,
                                      id: s.id,
                                      productId: p.id,
                                      version: s.version,
                                      price: Math.round(v.price * 100),
                                    });
                                  },
                                })
                              }
                            >
                              {t("এডিট", "Edit variant")}
                            </button>
                          </div>
                        ))}
                      </td>
                      <td>
                        <Pill>{p.is_active ? "Active" : "Paused"}</Pill>
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            className="text-button"
                            onClick={() => edit(p)}
                          >
                            {t("এডিট", "Edit")}
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              modal({
                                title: t("ভ্যারিয়েন্ট যোগ করো", "Add variant"),
                                fields: [
                                  { name: "label", label: "Variant label" },
                                  {
                                    name: "price",
                                    label: "Price (৳)",
                                    type: "number",
                                    value: 500,
                                    min: 1,
                                    step: "0.01",
                                  },
                                  {
                                    name: "stock",
                                    label: "Stock",
                                    type: "number",
                                    value: 10,
                                    min: 0,
                                  },
                                ],
                                submit: "Add variant",
                                onSubmit: async (v) => {
                                  await act("sku", {
                                    productId: p.id,
                                    ...v,
                                    price: Math.round(v.price * 100),
                                  });
                                },
                              })
                            }
                          >
                            + {t("ভ্যারিয়েন্ট", "Variant")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.ownProducts?.length && (
                <Empty
                  title={t("প্রথম পণ্যটি যোগ করো", "List your first product")}
                />
              )}
            </div>
          )}
          {tab === "orders" && <Orders seller />}
          {tab === "promotions" && (
            <div className="two-columns">
              <div className="panel">
                <h2>{t("ভাউচার", "Vouchers")}</h2>
                {data.vouchers?.map((v: Row) => (
                  <p key={v.code}>
                    <strong>{v.code}</strong> · <Money value={v.amount_paisa} />{" "}
                    off <Money value={v.minimum_paisa} />
                  </p>
                ))}
                <button
                  className="secondary"
                  onClick={() =>
                    modal({
                      title: "Create voucher",
                      fields: [
                        {
                          name: "code",
                          label: "Code (uppercase letters and digits)",
                        },
                        {
                          name: "amount",
                          label: "Discount (৳)",
                          type: "number",
                          value: 100,
                          min: 1,
                        },
                        {
                          name: "minimum",
                          label: "Minimum order (৳)",
                          type: "number",
                          value: 1000,
                          min: 1,
                        },
                      ],
                      submit: "Create voucher",
                      onSubmit: async (v) => {
                        await act("voucher", {
                          ...v,
                          amount: v.amount * 100,
                          minimum: v.minimum * 100,
                        });
                      },
                    })
                  }
                >
                  + {t("ভাউচার", "Voucher")}
                </button>
              </div>
              <div className="panel">
                <h2>{t("ক্রিয়েটর ব্রিফ", "Creator brief")}</h2>
                <p>Invite creators to tell your product’s story.</p>
                <button
                  className="secondary"
                  onClick={() =>
                    modal({
                      title: "Create brand brief",
                      fields: [
                        { name: "title", label: "Title" },
                        {
                          name: "description",
                          label: "Deliverables",
                          type: "textarea",
                        },
                        {
                          name: "budget",
                          label: "Budget (৳)",
                          type: "number",
                          value: 5000,
                          min: 1,
                        },
                      ],
                      submit: "Publish brief",
                      onSubmit: async (v) => {
                        await act("brief", { ...v, budget: v.budget * 100 });
                      },
                    })
                  }
                >
                  + {t("ব্রিফ", "Brief")}
                </button>
                {data.briefs
                  ?.filter((b: Row) => b.owner_id === data.user.id)
                  .map((b: Row) => (
                    <article className="list-item" key={b.id}>
                      <strong>{b.title}</strong>
                      {b.applications?.map((a: Row) => (
                        <p key={a.creator_id}>
                          {a.name} · {a.pitch}{" "}
                          <button
                            className="text-button"
                            onClick={() =>
                              void act("brief-select", {
                                id: b.id,
                                creatorId: a.creator_id,
                              }).catch(() => {})
                            }
                          >
                            Select creator
                          </button>
                        </p>
                      ))}
                    </article>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
