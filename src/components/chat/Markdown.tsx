"use client";

import React, { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

interface Block {
  type: "fence" | "heading" | "list" | "quote" | "hr" | "para";
  level?: number;
  lang?: string;
  ordered?: boolean;
  lines: string[];
}

function tokenize(source: string): Block[] {
  const lines = source.split(/\r?\n/);
  const blocks: Block[] = [];
  let index = 0;

  const flush = () => {
    const buffer: string[] = [];
    let blank = true;
    while (index < lines.length && lines[index].trim() !== "") {
      buffer.push(lines[index]);
      if (lines[index].trim() !== "") blank = false;
      index++;
    }
    while (index < lines.length && lines[index].trim() === "") index++;
    if (buffer.length > 0 && !blank) {
      const first = buffer[0];
      if (/^(#{1,6})\s/.test(first)) {
        const match = first.match(/^(#{1,6})\s+(.*)$/);
        blocks.push({ type: "heading", level: match![1].length, lines: [match![2]] });
        if (buffer.length > 1) blocks.push({ type: "para", lines: buffer.slice(1) });
      } else if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(first.trim())) {
        blocks.push({ type: "hr", lines: [] });
        if (buffer.length > 1) blocks.push({ type: "para", lines: buffer.slice(1) });
      } else {
        blocks.push({ type: "para", lines: buffer });
      }
    }
  };

  while (index < lines.length) {
    const line = lines[index];

    const fence = line.match(/^```\s*([\w.-]*)\s*$/);
    if (fence) {
      const lang = fence[1];
      index++;
      const code: string[] = [];
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index]);
        index++;
      }
      if (index < lines.length) index++;
      blocks.push({ type: "fence", lang: lang || undefined, lines: code });
      while (index < lines.length && lines[index].trim() === "") index++;
      continue;
    }

    if (/^(#{1,6})\s/.test(line) || /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      flush();
      continue;
    }

    if (/^[-*+]\s/.test(line) || /^\d+[.)]\s/.test(line)) {
      const block: Block = { type: "list", ordered: /^\d/.test(line), lines: [] };
      const ordered = block.ordered;
      while (index < lines.length) {
        const current = lines[index];
        if (ordered ? /^\d+[.)]\s/.test(current) : /^[-*+]\s/.test(current)) {
          block.lines.push(current.replace(/^\d+[.)]\s/, "").replace(/^[-*+]\s/, ""));
          index++;
        } else if (current.trim() === "" && index + 1 < lines.length && (ordered ? /^\d+[.)]\s/.test(lines[index + 1]) : /^[-*+]\s/.test(lines[index + 1]))) {
          index++;
        } else {
          break;
        }
      }
      while (index < lines.length && lines[index].trim() === "") index++;
      blocks.push(block);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const block: Block = { type: "quote", lines: [] };
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        block.lines.push(lines[index].replace(/^>\s?/, ""));
        index++;
      }
      while (index < lines.length && lines[index].trim() === "") index++;
      blocks.push(block);
      continue;
    }

    flush();
  }

  return blocks;
}

interface InlineNodesProps {
  source: string;
}

function InlineNodes({ source }: InlineNodesProps) {
  const segments = source.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]\n]+]\([^)\s]+\))/g);
  return (
    <>
      {segments.map((segment, i) => {
        if (segment.startsWith("`") && segment.endsWith("`") && segment.length > 2) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded bg-slate-800/80 text-[13px] font-mono text-cyan-300 border border-slate-700/50"
            >
              {segment.slice(1, -1)}
            </code>
          );
        }
        if (segment.startsWith("**") && segment.endsWith("**") && segment.length > 4) {
          return (
            <strong key={i} className="font-semibold text-slate-100">
              <InlineNodes source={segment.slice(2, -2)} />
            </strong>
          );
        }
        if (segment.startsWith("*") && segment.endsWith("*") && segment.length > 2) {
          return (
            <em key={i} className="text-slate-300 italic">
              <InlineNodes source={segment.slice(1, -1)} />
            </em>
          );
        }
        const link = segment.match(/^\[([^\]]+)]\(([^)\s]+)\)$/);
        if (link) {
          return (
            <a
              key={i}
              href={link[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-500/40"
            >
              {link[1]}
            </a>
          );
        }
        return <React.Fragment key={i}>{segment}</React.Fragment>;
      })}
    </>
  );
}

function CodeBlock({ lang, code }: { lang?: string; code: string[] }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }, [code]);

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-slate-800 bg-[#0b1424]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/40 border-b border-slate-800">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          {lang || "code"}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-cyan-400 transition-colors"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto">
        <code className="font-mono text-[12.5px] leading-relaxed text-slate-300">{code.join("\n")}</code>
      </pre>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  const blocks = tokenize(content);
  if (blocks.length === 0) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "fence":
            return <CodeBlock key={i} lang={block.lang} code={block.lines} />;
          case "heading": {
            const className =
              block.level === 1
                ? "text-xl font-semibold text-slate-100 mt-1"
                : block.level === 2
                  ? "text-lg font-semibold text-slate-100 mt-1"
                  : "text-base font-semibold text-slate-200 mt-0.5";
            return (
              <div key={i} className={className}>
                <InlineNodes source={block.lines[0] ?? ""} />
              </div>
            );
          }
          case "list":
            return (
              <ul key={i} className="space-y-1 pl-5">
                {block.lines.map((item, j) =>
                  block.ordered ? (
                    <li key={j} className="list-decimal text-slate-300">
                      <InlineNodes source={item} />
                    </li>
                  ) : (
                    <li key={j} className="list-disc text-slate-300">
                      <InlineNodes source={item} />
                    </li>
                  )
                )}
              </ul>
            );
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-cyan-500/40 pl-3 text-slate-400 italic">
                {block.lines.map((line, j) => (
                  <p key={j}>
                    <InlineNodes source={line} />
                  </p>
                ))}
              </blockquote>
            );
          case "hr":
            return <hr key={i} className="border-slate-800" />;
          default:
            return (
              <p key={i} className="leading-relaxed">
                <InlineNodes source={block.lines.join("\n")} />
              </p>
            );
        }
      })}
    </div>
  );
}