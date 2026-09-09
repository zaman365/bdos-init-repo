"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X, ArrowUpRight, Check, LoaderCircle } from "lucide-react";
export type Row = Record<string, any>;
export type Field = {
  name: string;
  label: string;
  type?: string;
  value?: any;
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  help?: string;
};
export type ModalSpec = {
  title: string;
  description?: string;
  fields: Field[];
  submit: string;
  onSubmit: (v: Row) => Promise<void>;
};
export type Context = {
  data: Row;
  view: string;
  locale: "bn" | "en";
  busy: boolean;
  act: (action: string, data?: Row, silent?: boolean) => Promise<Row>;
  go: (view: string) => void;
  modal: (spec: ModalSpec) => void;
  t: (bn: string, en: string) => string;
  money: (n: number) => string;
  refresh: () => Promise<void>;
  toast: (s: string) => void;
};
export const AppContext = createContext<Context>(null!);
export const useApp = () => useContext(AppContext);
const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const bnDigits = (v: string) => v.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

/**
 * Format a timestamp with an intentional fallback.
 *
 * `new Date(undefined).toLocaleString()` renders the literal string
 * "Invalid Date", and that shipped into a user-facing card once already
 * (docs/11-UI-UX-AUDIT.md UX-01). Nothing in this app should construct a Date
 * for display without going through here.
 */
export function formatWhen(value: unknown, locale: "bn" | "en" = "en"): string {
  if (value === null || value === undefined || value === "") {
    return locale === "bn" ? "তারিখ নেই" : "no date";
  }
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) {
    return locale === "bn" ? "তারিখ নেই" : "no date";
  }
  // en-GB rather than the platform default, so the shape is stable across
  // hosts; Bengali locales get Bengali digits rather than an ICU guess.
  const text = d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return locale === "bn" ? bnDigits(text) : text;
}

/** Elapsed time in words. Queues need age at a glance, not a timestamp. */
export function formatAge(value: unknown, locale: "bn" | "en" = "en"): string {
  const d = value ? new Date(value as string) : null;
  if (!d || Number.isNaN(d.getTime())) return locale === "bn" ? "অজানা" : "unknown";
  const minutes = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  const n = (v: number) => (locale === "bn" ? bnDigits(String(v)) : String(v));
  if (minutes < 1) return locale === "bn" ? "এখনই" : "just now";
  if (minutes < 60) return locale === "bn" ? `${n(minutes)} মিনিট` : `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return locale === "bn" ? `${n(hours)} ঘণ্টা` : `${hours}h`;
  const days = Math.round(hours / 24);
  return locale === "bn" ? `${n(days)} দিন` : `${days}d`;
}

/** A formatted timestamp. Use instead of `new Date(x).toLocaleString()`. */
export function When({ value }: { value: unknown }) {
  const { locale } = useApp();
  return <>{formatWhen(value, locale)}</>;
}

/** How long ago, in words. */
export function Age({ value }: { value: unknown }) {
  const { locale } = useApp();
  return <>{formatAge(value, locale)}</>;
}

export function Money({ value }: { value: number }) {
  const { money } = useApp();
  return <span className="money">{money(value)}</span>;
}
export function Pill({
  children,
  live = false,
}: {
  children: ReactNode;
  live?: boolean;
}) {
  return <span className={`pill ${live ? "live" : ""}`}>{children}</span>;
}
export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="empty">
      <span className="empty-line" />
      <h3>{title}</h3>
      <p>{body ?? "Your next step starts here."}</p>
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Stats({
  items,
}: {
  items: { label: string; value: ReactNode; note?: string }[];
}) {
  return (
    <div className="stats">
      {items.map((i) => (
        <div className="stat" key={i.label}>
          <span>{i.label}</span>
          <strong>{i.value}</strong>
          {i.note && <small>{i.note}</small>}
        </div>
      ))}
    </div>
  );
}
export function Avatar({ name, size = "" }: { name: string; size?: string }) {
  return <span className={`avatar ${size}`}>{name?.slice(0, 1)}</span>;
}
export function FormDialog({
  spec,
  close,
}: {
  spec: ModalSpec;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { busy, t } = useApp();
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="dialog-head">
        <div>
          <p className="eyebrow">BDOS</p>
          <h2>{spec.title}</h2>
        </div>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {spec.description && <p className="muted">{spec.description}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const values: Row = {};
          for (const field of spec.fields) {
            const v = f.get(field.name);
            values[field.name] =
              field.type === "checkbox"
                ? v === "on"
                : field.type === "number"
                  ? Number(v)
                  : String(v ?? "");
          }
          setError("");
          try {
            await spec.onSubmit(values);
            close();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Please try again.");
          }
        }}
      >
        <div className="form-fields">
          {spec.fields.map((f) => (
            <label
              key={f.name}
              className={f.type === "checkbox" ? "checkbox-label" : ""}
            >
              <span>{f.label}</span>
              {f.options ? (
                <select
                  name={f.name}
                  required={f.required !== false}
                  defaultValue={f.value ?? f.options[0]?.value}
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.name}
                  defaultValue={f.value ?? ""}
                  maxLength={f.max ?? 2200}
                  required={f.required !== false}
                  rows={3}
                />
              ) : f.type === "checkbox" ? (
                <input name={f.name} type="checkbox" defaultChecked={f.value} />
              ) : (
                <input
                  name={f.name}
                  type={f.type ?? "text"}
                  defaultValue={f.value ?? ""}
                  required={f.required !== false}
                  min={f.min}
                  max={f.max}
                  maxLength={f.type === "number" ? undefined : (f.max ?? 500)}
                  step={f.step ?? "1"}
                />
              )}{" "}
              {f.help && <small>{f.help}</small>}
            </label>
          ))}
        </div>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={close}>
            {t("বাতিল", "Cancel")}
          </button>
          <button className="primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}{" "}
            {spec.submit}
          </button>
        </div>
      </form>
    </dialog>
  );
}
export function Topup() {
  const { modal, act, t } = useApp();
  return (
    <button
      className="secondary"
      onClick={() =>
        modal({
          title: t("স্যান্ডবক্স ক্রেডিট যোগ করো", "Add sandbox credit"),
          description: t(
            "এটি পরীক্ষার টাকা। আসল পেমেন্ট হবে না।",
            "Prepaid demo credit for gifts and advertising. No real payment.",
          ),
          fields: [
            {
              name: "amount",
              label: t("পরিমাণ (৳)", "Amount (৳)"),
              type: "number",
              value: 500,
              min: 10,
              max: 10000,
            },
          ],
          submit: t("ক্রেডিট যোগ করো", "Add credit"),
          onSubmit: async (v) => {
            await act("topup", { amount: Math.round(v.amount * 100) });
          },
        })
      }
    >
      {t("ক্রেডিট যোগ করো", "Add credit")} <ArrowUpRight size={16} />
    </button>
  );
}
export const options = (rows: Row[], label = "title_en") =>
  rows.map((r) => ({ value: r.id, label: r[label] ?? r.id }));
