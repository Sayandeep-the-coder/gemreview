"use client";

import { useEffect, useState, useRef } from "react";

/* ─── terminal lines to animate ─────────────────── */
interface Line {
  text: string;
  color?: string;
  delay?: number;
  typing?: boolean;
}

const lines: Line[] = [
  { text: "$ gemreview run --pr https://github.com/acme/api/pull/88", color: "text-green-400", delay: 0, typing: true },
  { text: "", delay: 400 },
  { text: "  GemReview 🤖  v1.3.3", color: "text-[hsl(262_100%_81%)]", delay: 300 },
  { text: "  ─────────────────────────────────────────", color: "text-[hsl(0_0%_25%)]", delay: 100 },
  { text: "", delay: 100 },
  { text: "  ▶ Fetching PR #88 …", color: "text-[hsl(200_92%_59%)]", delay: 400 },
  { text: "    acme/api • Add payment processing flow", color: "text-[hsl(0_0%_60%)]", delay: 600 },
  { text: "    6 files changed, 289 lines (+214 / −75)", color: "text-[hsl(0_0%_60%)]", delay: 300 },
  { text: "", delay: 200 },
  { text: "  ▶ Analysing with gemini-2.5-pro …", color: "text-[hsl(200_92%_59%)]", delay: 500 },
  { text: "", delay: 800 },
  { text: "  🐛 Code Quality    3 findings", color: "text-yellow-400", delay: 400 },
  { text: "  🔒 Security        2 findings", color: "text-red-400", delay: 300 },
  { text: "  🧪 Test Coverage   3 findings", color: "text-orange-400", delay: 300 },
  { text: "  ⚡ Optimisation    4 findings", color: "text-blue-400", delay: 300 },
  { text: "", delay: 200 },
  { text: "  ─────────────────────────────────────────", color: "text-[hsl(0_0%_25%)]", delay: 100 },
  { text: "", delay: 100 },
  { text: "  ▶ Posting 12 inline comments …", color: "text-[hsl(200_92%_59%)]", delay: 600 },
  { text: "  ▶ Posting summary comment …", color: "text-[hsl(200_92%_59%)]", delay: 500 },
  { text: "", delay: 200 },
  { text: "  ✅ Review complete — 12 comments posted", color: "text-green-400", delay: 500 },
  { text: "     Overall Risk: 🔴 HIGH", color: "text-red-400", delay: 300 },
  { text: "     Duration: 12s | Model: gemini-2.5-pro", color: "text-[hsl(0_0%_45%)]", delay: 200 },
];

/* ─── component ─────────────────────────────────── */
export function TerminalAnimation() {
  const [visibleLines, setVisibleLines] = useState<{ text: string; color?: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypedText, setCurrentTypedText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = { cancelled: false };

    async function animate() {
      for (let i = 0; i < lines.length; i++) {
        if (ctrl.cancelled) return;
        const line = lines[i];
        const delay = line.delay ?? 200;

        await wait(delay);
        if (ctrl.cancelled) return;

        if (line.typing) {
          setIsTyping(true);
          const fullText = line.text;
          for (let c = 0; c <= fullText.length; c++) {
            if (ctrl.cancelled) return;
            setCurrentTypedText(fullText.slice(0, c));
            await wait(28);
          }
          setIsTyping(false);
          setCurrentTypedText("");
          setVisibleLines((prev) => [...prev, { text: line.text, color: line.color }]);
        } else {
          setVisibleLines((prev) => [...prev, { text: line.text, color: line.color }]);
        }
      }

      // Pause then restart
      await wait(4000);
      if (ctrl.cancelled) return;
      setVisibleLines([]);
      setCurrentTypedText("");
      setIsTyping(false);
      animate();
    }

    animate();
    return () => { ctrl.cancelled = true; };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visibleLines, currentTypedText]);

  return (
    <div className="w-[540px] rounded-2xl border border-border bg-[hsl(0_0%_5%)] shadow-2xl shadow-black/40 overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-[hsl(0_0%_7%)]">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
        </div>
        <span className="ml-2 text-[11px] text-muted-foreground font-medium">
          Terminal — gemreview
        </span>
      </div>

      {/* Terminal content — fixed height, auto-scroll, hidden scrollbar */}
      <div
        ref={containerRef}
        className="h-[420px] p-4 font-mono text-[12.5px] leading-[1.7] overflow-y-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {visibleLines.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre ${line.color || "text-[hsl(0_0%_75%)]"} animate-fade-in`}
          >
            {line.text || "\u00A0"}
          </div>
        ))}

        {/* Currently typing line */}
        {isTyping && (
          <div className="whitespace-pre text-green-400">
            {currentTypedText}
            <span className="animate-blink inline-block w-[7px] h-[14px] bg-green-400 ml-[1px] align-middle" />
          </div>
        )}

        {/* Idle cursor */}
        {!isTyping && visibleLines.length === 0 && (
          <div className="whitespace-pre text-green-400">
            <span className="animate-blink inline-block w-[7px] h-[14px] bg-green-400" />
          </div>
        )}
      </div>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
