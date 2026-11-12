import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { publicApi, streamSSE, useApi } from "@/lib/api";
import { RichText, extractIds } from "@/components/ai/RichText";
import { AddToCart } from "@/components/store/AddToCart";
import { inr } from "@/lib/format";

const SUGGESTIONS = ["What do I need for paneer butter masala?", "Show me today's best deals", "Which payment methods can I use?"];

const ProductChip = ({ p }) => (
  <div className="flex items-center gap-2 border rounded-lg p-2 bg-white" data-testid={`ai-product-${p.id}`}>
    <img src={p.image} alt={p.name} className="h-10 w-10 rounded object-cover" />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium truncate">{p.name}</p>
      <p className="text-xs text-muted-foreground tnum">{p.unit} · {inr(p.price)}</p>
    </div>
    <div className="w-24"><AddToCart product={p} size="sm" testid={`ai-${p.id}`} /></div>
  </div>
);

const Bubble = ({ m, products }) => {
  const ids = m.role === "assistant" ? [...new Set(extractIds(m.content))] : [];
  if (m.role === "user") {
    return <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-white px-3.5 py-2 text-sm">{m.content}</div>;
  }
  return (
    <div className="max-w-[92%] space-y-2">
      <div className={`rounded-2xl rounded-bl-sm px-3.5 py-2.5 ${m.error ? "bg-[#ffebee] text-[#b71c1c]" : "bg-muted"}`}>
        {m.content ? <RichText text={m.content} /> : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {ids.filter((id) => products[id]).map((id) => <ProductChip key={id} p={products[id]} />)}
    </div>
  );
};

export const ChatBody = () => {
  const api = useApi();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [products, setProducts] = useState({});
  const [ready, setReady] = useState(false);
  const requested = useRef(new Set());
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get("/ai/chat/history").then((r) => setMessages(r.data)).catch(() => toast.error("Couldn't load your earlier chat.")).finally(() => {
      setReady(true);
      inputRef.current?.focus();
    });
  }, [api]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    if (busy) return;
    const ids = [...new Set(messages.filter((m) => m.role === "assistant").flatMap((m) => extractIds(m.content)))].filter((id) => !requested.current.has(id));
    if (!ids.length) return;
    ids.forEach((id) => requested.current.add(id));
    publicApi.get("/products", { params: { ids: ids.join(",") } })
      .then((r) => setProducts((prev) => ({ ...prev, ...Object.fromEntries(r.data.map((p) => [p.id, p])) })))
      .catch(() => {});
  }, [messages, busy]);

  const patchLast = (fn) => setMessages((m) => {
    if (!m.length || m[m.length - 1].role !== "assistant") return m;
    const c = [...m];
    c[c.length - 1] = fn(c[c.length - 1]);
    return c;
  });

  const send = async (text) => {
    const msg = text.trim();
    if (!msg || busy || !ready || clearing) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }, { role: "assistant", content: "" }]);
    setBusy(true);
    let finished = false;
    try {
      const token = await getToken();
      await streamSSE("/ai/chat", { message: msg }, token, (ev) => {
        if (ev.delta) patchLast((l) => ({ ...l, content: l.content + ev.delta }));
        if (ev.error) { finished = true; patchLast(() => ({ role: "assistant", content: ev.error, error: true })); }
        if (ev.done) finished = true;
      });
      if (!finished) patchLast((l) => ({ ...l, content: `${l.content}\n\n(The reply was cut off. Please ask again.)`, error: !l.content }));
    } catch (e) {
      patchLast(() => ({ role: "assistant", content: e.message, error: true }));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setClearing(true);
    try {
      await api.delete("/ai/chat/history");
      setMessages([]);
    } catch {
      toast.error("Couldn't clear the chat. Please try again.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="ai-messages">
        {!ready && <p className="text-sm text-muted-foreground" data-testid="ai-history-loading">Loading your chat…</p>}
        {ready && messages.length === 0 && (
          <div className="space-y-2" data-testid="ai-suggestions">
            <p className="text-sm text-muted-foreground">Hi! I can find products, suggest recipe ingredients and answer questions about delivery and payments.</p>
            {SUGGESTIONS.map((s, i) => (
              <button key={s} data-testid={`ai-suggestion-${i}`} onClick={() => send(s)}
                className="block w-full text-left text-sm border rounded-lg px-3 py-2 hover:border-primary hover:bg-accent transition-colors">{s}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} m={m} products={products} />)}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t p-3 flex items-center gap-2">
        {messages.length > 0 && !busy && (
          <button type="button" onClick={clear} data-testid="ai-clear-button" aria-label="Clear chat" className="p-2 rounded-md text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
        )}
        <input ref={inputRef} data-testid="ai-chat-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} disabled={!ready || clearing}
          placeholder="Ask about products, recipes, delivery…" className="flex-1 h-10 rounded-lg border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <button type="submit" data-testid="ai-chat-send-button" disabled={busy || !ready || !input.trim()} aria-label="Send"
          className="h-10 w-10 rounded-lg bg-primary text-white grid place-items-center disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </>
  );
};
