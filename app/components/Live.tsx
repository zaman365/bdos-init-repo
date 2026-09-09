"use client";
import { useEffect, useRef, useState } from "react";
import {
  Video,
  VideoOff,
  Radio,
  ArrowLeft,
  Gift,
  Send,
  ShoppingBag,
  Plus,
} from "lucide-react";
import {
  useApp,
  Heading,
  Pill,
  Money,
  Empty,
  Topup,
  Avatar,
  options,
  type Row,
} from "./ui";
export default function Live() {
  const { data, t, act, modal, toast, go } = useApp();
  const [room, setRoom] = useState<Row | null>(null),
    [chat, setChat] = useState<Row[]>([]),
    [status, setStatus] = useState(""),
    [camera, setCamera] = useState(false),
    [peerCount, setPeerCount] = useState(0);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    peers = useRef(new Map<string, RTCPeerConnection>()),
    pending = useRef(new Map<string, RTCIceCandidateInit[]>()),
    fn = useRef(act);
  fn.current = act;
  const userId = data.user.id;
  const hosting = room?.host_id === userId;
  const send = async (recipientId: string, payload: Row) => {
    if (room)
      await fn.current("signal", { id: room.id, recipientId, payload }, true);
  };
  const peer = (id: string) => {
    let p = peers.current.get(id);
    if (p) return p;
    p = new RTCPeerConnection({ iceServers: [] });
    peers.current.set(id, p);
    pending.current.set(id, []);
    if (stream.current)
      for (const track of stream.current.getTracks())
        p.addTrack(track, stream.current);
    p.onicecandidate = (e) => {
      if (e.candidate)
        void send(id, { candidate: e.candidate.toJSON() }).catch(() => {});
    };
    p.ontrack = (e) => {
      if (video.current) video.current.srcObject = e.streams[0];
      setStatus("Connected · LIVE");
    };
    p.onconnectionstatechange = () => {
      const count = [...peers.current.values()].filter(
        (x) => x.connectionState === "connected",
      ).length;
      setPeerCount(count);
      if (p?.connectionState === "failed")
        setStatus(
          "Peer connection failed. This MVP works best on the same network.",
        );
    };
    return p;
  };
  const offer = async (id: string) => {
    const p = peer(id);
    if (!p.getSenders().length && stream.current)
      for (const track of stream.current.getTracks())
        p.addTrack(track, stream.current);
    await p.setLocalDescription(await p.createOffer());
    await send(id, { description: p.localDescription });
  };
  useEffect(() => {
    if (!room) return;
    let after = 0,
      stopped = false,
      inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/live?id=${room.id}&after=${after}`, {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (stopped) return;
        setChat(result.chat.reverse());
        if (result.room.state !== "live") {
          setStatus("This LIVE has ended.");
          for (const track of stream.current?.getTracks() ?? []) track.stop();
          for (const p of peers.current.values()) p.close();
          setCamera(false);
          return;
        }
        for (const signal of result.signals) {
          after = Math.max(after, signal.id);
          const id = signal.sender_id;
          const payload = signal.payload;
          if (payload.join && hosting) {
            peer(id);
            if (stream.current) await offer(id);
            continue;
          }
          const p = peer(id);
          if (payload.description) {
            await p.setRemoteDescription(payload.description);
            for (const ice of pending.current.get(id) ?? [])
              await p.addIceCandidate(ice);
            pending.current.set(id, []);
            if (payload.description.type === "offer") {
              await p.setLocalDescription(await p.createAnswer());
              await send(id, { description: p.localDescription });
            }
          } else if (payload.candidate) {
            if (p.remoteDescription) await p.addIceCandidate(payload.candidate);
            else pending.current.get(id)?.push(payload.candidate);
          }
        }
      } catch (e) {
        if (!stopped) setStatus((e as Error).message);
      } finally {
        inFlight = false;
      }
    };
    if (!hosting)
      void send(room.host_id, { join: true }).catch((e) =>
        setStatus(e.message),
      );
    const interval = setInterval(() => void poll(), 1500);
    void poll();
    return () => {
      stopped = true;
      clearInterval(interval);
      for (const p of peers.current.values()) p.close();
      peers.current.clear();
      for (const tr of stream.current?.getTracks() ?? []) tr.stop();
      stream.current = null;
      setCamera(false);
    };
    // Signalling belongs to a room session; callbacks use the current command ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);
  const startCamera = async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      stream.current = media;
      if (video.current) video.current.srcObject = media;
      setCamera(true);
      setStatus("Camera is live. Waiting for viewers.");
      for (const id of peers.current.keys()) await offer(id);
    } catch (e) {
      toast(`Camera could not start: ${(e as Error).message}`);
    }
  };
  const stopCamera = () => {
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
    setCamera(false);
  };
  const selectedProduct = data.products.find(
    (p: Row) => p.id === room?.product_id,
  );
  if (!room)
    return (
      <>
        <Heading
          eyebrow="BDOS LIVE"
          title={t("এখনই, একসাথে।", "Right here. Right now.")}
          description={t(
            "গল্প, আড্ডা আর নতুন আবিষ্কার — লাইভে।",
            "Real conversations. Live discoveries. A little closer to your community.",
          )}
          action={
            <button
              className="primary"
              onClick={() =>
                modal({
                  title: t("লাইভ শুরু করো", "Create a LIVE room"),
                  description:
                    "18+ only. Camera permission is requested after creating the room. Small-room WebRTC works on a local network.",
                  fields: [
                    { name: "title", label: t("লাইভের নাম", "Room title") },
                    {
                      name: "productId",
                      label: t("পণ্য (ঐচ্ছিক)", "Product (optional)"),
                      required: false,
                      options: [
                        { value: "", label: "No product" },
                        ...options(data.products),
                      ],
                    },
                  ],
                  submit: t("রুম তৈরি", "Create room"),
                  onSubmit: async (v) => {
                    const r = await act("live-start", {
                      title: v.title,
                      productId: v.productId || undefined,
                    });
                    setRoom({
                      id: r.id,
                      host_id: userId,
                      title: v.title,
                      product_id: v.productId,
                    });
                  },
                })
              }
            >
              <Radio size={17} />
              {t("লাইভে যাও", "Go LIVE")}
            </button>
          }
        />
        <div className="live-intro">
          <div>
            <Pill live>LIVE · 18+</Pill>
            <h2>{t("সাপোর্ট দাও, সরাসরি।", "Show a little love, live.")}</h2>
            <p>
              {t(
                "প্রতি গিফটের ৬০% নির্মাতার। ৪০% প্ল্যাটফর্মের।",
                "Every gift: 60% to the creator, 40% to the platform, before illustrative withholding.",
              )}
            </p>
          </div>
          <div className="gift-emblems">
            ✿ <span>♧</span> ◈
          </div>
        </div>
        <div className="room-grid">
          {data.rooms?.map((s: Row) => (
            <button
              className="room-card"
              key={s.id}
              onClick={() => {
                setRoom(s);
                setStatus(
                  s.host_id === userId
                    ? "Start your camera to broadcast."
                    : "Connecting to host…",
                );
              }}
            >
              <img src="/art/stage.svg" alt="" />
              <div>
                <Pill live>LIVE</Pill>
                <h3>{s.title}</h3>
                <span>
                  {s.display_name} <span className="muted">@{s.handle}</span>
                </span>
              </div>
            </button>
          ))}
        </div>
        {!data.rooms?.length && (
          <Empty
            title={t("মঞ্চ তোমার অপেক্ষায়", "The stage is waiting")}
            body={t(
              "প্রথম লাইভটি তুমিই শুরু করো।",
              "Start a room and invite someone to join.",
            )}
          />
        )}
      </>
    );
  return (
    <>
      <button className="text-button" onClick={() => setRoom(null)}>
        <ArrowLeft size={15} />
        {t("সব লাইভ", "All LIVE rooms")}
      </button>
      <Heading
        eyebrow="BDOS LIVE"
        title={room.title}
        action={
          <Pill live>
            LIVE · {hosting ? `${peerCount} connected` : "Viewer"}
          </Pill>
        }
      />
      <div className="live-layout">
        <section>
          <div className="live-player">
            <video ref={video} autoPlay playsInline muted={hosting} />
            {!camera && hosting && (
              <div className="camera-prompt">
                <Video size={42} />
                <p>
                  {t("তোমার ক্যামেরা চালু করো", "Bring your camera on stage")}
                </p>
                <button className="primary" onClick={() => void startCamera()}>
                  {t("ক্যামেরা চালু", "Start camera")}
                </button>
              </div>
            )}
          </div>
          <div className="live-controls">
            <span>{status}</span>
            {hosting && (
              <div className="actions">
                <button
                  className="secondary small"
                  onClick={() => (camera ? stopCamera() : void startCamera())}
                >
                  {camera ? <VideoOff size={16} /> : <Video size={16} />}{" "}
                  {camera ? "Stop camera" : "Start camera"}
                </button>
                <button
                  className="secondary small"
                  onClick={async () => {
                    await act("live-end", { id: room.id });
                    setRoom(null);
                  }}
                >
                  End LIVE
                </button>
              </div>
            )}
          </div>
          {selectedProduct && (
            <button
              className="product-anchor"
              onClick={() => {
                modal({
                  title: selectedProduct.title_en,
                  fields: [
                    {
                      name: "skuId",
                      label: "Variant",
                      options: selectedProduct.skus.map((s: Row) => ({
                        value: s.id,
                        label: s.variant_label,
                      })),
                    },
                    {
                      name: "qty",
                      label: "Quantity",
                      type: "number",
                      value: 1,
                      min: 1,
                      max: 99,
                    },
                  ],
                  submit: "Add to cart",
                  onSubmit: async (v) => {
                    await act("cart", v, true);
                    toast("Added to cart");
                  },
                });
              }}
            >
              <ShoppingBag size={18} />
              {selectedProduct.title_en}
              <Money value={selectedProduct.skus[0].price_paisa} />
            </button>
          )}
          <div className="panel gifts">
            <div className="section-header">
              <h3>{t("ভালোবাসা পাঠাও", "Send a little love")}</h3>
              <Topup />
            </div>
            <p>Creator 60% / platform 40% · sandbox credit only</p>
            <div className="gift-grid">
              {data.gifts?.map((g: Row, i: number) => (
                <button
                  key={g.id}
                  disabled={hosting}
                  onClick={async () => {
                    try {
                      const result = await act(
                        "gift",
                        { id: room.id, giftId: g.id },
                        true,
                      );
                      toast(result.message);
                    } catch {}
                  }}
                >
                  <span>{["✿", "♧", "⛵", "◈", "♨", "♜", "⌒"][i]}</span>
                  <strong>{t(g.name_bn, g.name_en)}</strong>
                  <Money value={g.price_paisa} />
                </button>
              ))}
            </div>
          </div>
        </section>
        <aside className="panel live-chat">
          <h3>{t("লাইভ আড্ডা", "Live conversation")}</h3>
          <div className="chat-stream">
            {chat.map((c) => (
              <p key={c.id}>
                <strong>{c.display_name}</strong> {c.body}
              </p>
            ))}
            {!chat.length && <p className="muted">Say hello. Keep it kind.</p>}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              try {
                await act(
                  "live-chat",
                  { id: room.id, body: new FormData(f).get("body") },
                  true,
                );
                f.reset();
              } catch {}
            }}
          >
            <input
              name="body"
              aria-label="LIVE message"
              placeholder="Say something kind…"
              maxLength={500}
              required
            />
            <button className="primary small" aria-label="Send LIVE message">
              <Send size={16} />
            </button>
          </form>
          <small>
            Nirapod is on. Report harassment from the creator’s posts.
          </small>
        </aside>
      </div>
    </>
  );
}
