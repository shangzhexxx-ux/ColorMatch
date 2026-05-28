"use client";

import dynamic from "next/dynamic";

const ImageEditor = dynamic(() => import("@/components/ImageEditor"), {
  ssr: false,
  loading: () => (
    <div className="col-span-12 flex justify-center">
      <div className="bg-[color:var(--cm-surface)] p-6 lg:p-10 rounded-2xl shadow-sm border border-[color:var(--cm-border)] flex flex-col items-center justify-center gap-4 w-full aspect-square lg:w-[70vw] lg:max-w-[700px] lg:aspect-[unset] lg:h-[70vh] lg:max-h-[700px]">
        <div className="w-10 h-10 rounded-full border-2 border-[color:var(--cm-border)] border-t-[color:var(--cm-brass)] animate-spin" />
        <div className="text-sm font-medium text-[color:var(--cm-ink-3)]">正在加载编辑器...</div>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-5xl flex flex-col gap-5">
        <header className="cm-home-header flex flex-col items-center text-center gap-3 pt-4">
          <h1 className="text-[32px] lg:text-[42px] font-bold tracking-[-0.03em] text-[color:var(--cm-ink)] leading-none">
            Color<span className="font-light opacity-70">Match</span>
          </h1>
          <p className="text-[14px] lg:text-[15px] text-[color:var(--cm-ink-2)] leading-relaxed">
            自动提取色彩与排版，导出精美成片
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="inline-block w-6 h-[2px] rounded-full bg-[color:var(--cm-brass)] opacity-50" />
            <span className="text-[10px] tracking-[0.2em] uppercase text-[color:var(--cm-ink-3)]">
              取色 · 配色 · 出片
            </span>
            <span className="inline-block w-6 h-[2px] rounded-full bg-[color:var(--cm-brass)] opacity-50" />
          </div>
        </header>

        <ImageEditor />

        <footer className="cm-home-footer pt-6 pb-4 text-center">
          <span className="text-[10px] tracking-[0.15em] uppercase text-[color:var(--cm-ink-3)] opacity-50">
            Color Match — 照片取色排版工具
          </span>
        </footer>
      </div>
    </main>
  );
}
