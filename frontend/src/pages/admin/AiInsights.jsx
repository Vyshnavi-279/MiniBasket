import { useState } from "react";
import { useAuth } from "@clerk/react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/ai/RichText";
import { streamSSE } from "@/lib/api";

export const AiInsights = () => {
  const { getToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setText("");
    setError("");
    try {
      await streamSSE("/admin/ai/insights", { question: question.trim() }, await getToken(), (ev) => {
        if (ev.delta) setText((t) => t + ev.delta);
        if (ev.error) setError(ev.error);
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="ai-insights-panel" className="bg-white border rounded-xl p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">AI sales insights</h2>
      </div>
      <p className="text-sm text-muted-foreground mt-1">Claude reads your live orders, stock and partner data and tells you what to act on.</p>
      <form onSubmit={run} className="mt-4 flex flex-col sm:flex-row gap-2">
        <input data-testid="ai-insights-question-input" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500}
          placeholder="Optional: ask a question, e.g. Which items should I restock?"
          className="flex-1 h-10 rounded-lg border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <Button type="submit" disabled={busy} data-testid="ai-insights-generate-button" className="h-10">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />} Generate insights
        </Button>
      </form>
      {(text || error || busy) && (
        <div data-testid="ai-insights-output" className={`mt-4 rounded-lg p-4 ${error ? "bg-[#ffebee] text-[#b71c1c] text-sm" : "bg-muted"}`}>
          {error || (text ? <RichText text={text} /> : <span className="text-sm text-muted-foreground">Analysing your store…</span>)}
        </div>
      )}
    </section>
  );
};
