import { useState } from "react";
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

const Panel = ({ onClose }) => {
  const { isSignedIn } = useAuth();
  return (
    <div data-testid="ai-assistant-panel"
      className="fixed z-50 inset-0 md:inset-auto md:right-6 md:bottom-6 md:w-[400px] md:h-[600px] bg-white md:rounded-xl border shadow-2xl flex flex-col fade-up">
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
  const { pathname } = useLocation();
  if (["/admin", "/delivery", "/sign-"].some((p) => pathname.startsWith(p))) return null;
  return open ? (
    <Panel onClose={() => setOpen(false)} />
  ) : (
    <button data-testid="ai-assistant-open-button" onClick={() => setOpen(true)}
      className="fixed right-4 bottom-20 md:bottom-6 md:right-6 z-40 h-12 pl-4 pr-5 rounded-full bg-[#1b5e20] text-white shadow-lg flex items-center gap-2 text-sm font-semibold hover:bg-primary transition-colors">
      <Sparkles className="h-4 w-4" /> Ask AI
    </button>
  );
};
