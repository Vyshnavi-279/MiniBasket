const renderInline = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );

export const TAG_RE = /\[\[([a-z0-9-]+)\]\]/g;

export const extractIds = (text) => [...(text || "").matchAll(TAG_RE)].map((m) => m[1]);

export const RichText = ({ text }) => {
  const lines = (text || "").replace(TAG_RE, "").replace(/^#+\s*/gm, "").split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (/^[-*•]\s+/.test(t)) {
          return (
            <div key={i} className="flex gap-2"><span className="text-primary">•</span><span>{renderInline(t.replace(/^[-*•]\s+/, ""))}</span></div>
          );
        }
        return <p key={i}>{renderInline(t)}</p>;
      })}
    </div>
  );
};
