import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatBody } from "@/components/ai/ChatBody";

const SignedOutPrompt = () => (
  <div data-testid="ai-signed-out" className="flex-1 flex flex-col items-center justify-center text-center px-8">
    <Sparkles className="h-8 w-8 text-primary" />
    <p className="mt-3 font-semibold">Meet Basket Buddy</p>
    <p className="mt-1 text-sm text-muted-foreground">Sign in to ask for recipe ingredients, best deals and help with your orders.</p>
    <Button asChild className="mt-5" data-testid="ai-sign-in-button"><Link to="/sign-in">Sign in to chat</Link></Button>
  </div>
);

const Panel = ({ open, onClose }) => {
  const { isSignedIn } = useAuth();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div data-testid="ai-assistant-panel" role="dialog" aria-modal="true" aria-label="Basket Buddy AI assistant"
      className={`fixed z-50 inset-0 md:inset-auto md:right-6 md:bottom-6 md:w-[400px] md:h-[min(600px,calc(100vh-48px))] bg-white md:rounded-xl border shadow-2xl flex-col fade-up ${open ? "flex" : "hidden"}`}>
      <div className="flex items-center justify-between px-4 h-14 border-b">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-full bg-accent text-primary grid place-items-center"><Sparkles className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-semibold leading-tight">Basket Buddy</p>
            <p className="text-xs text-muted-foreground leading-tight">AI shopping assistant</p>
          </div>
        </div>
        <button data-testid="ai-assistant-close-button" onClick={onClose} aria-label="Close assistant" className="p-2 rounded-md hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      {isSignedIn ? <ChatBody /> : <SignedOutPrompt />}
    </div>
  );
};

export const AssistantWidget = () => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { pathname } = useLocation();
  const close = useCallback(() => setOpen(false), []);
  if (["/admin", "/delivery", "/sign-"].some((p) => pathname.startsWith(p))) return null;
  return (
    <>
      {mounted && <Panel open={open} onClose={close} />}
      {!open && (
        <button data-testid="ai-assistant-open-button" onClick={() => { setMounted(true); setOpen(true); }}
          className="fixed right-4 bottom-20 md:bottom-6 md:right-6 z-40 h-12 pl-4 pr-5 rounded-full bg-[#1b5e20] text-white shadow-lg flex items-center gap-2 text-sm font-semibold hover:bg-primary transition-colors">
          <Sparkles className="h-4 w-4" /> Ask AI
        </button>
      )}
    </>
  );
};
