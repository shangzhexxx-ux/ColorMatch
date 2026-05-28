"use client";

import dynamic from "next/dynamic";

const ImageEditor = dynamic(() => import("@/components/ImageEditor"), {
  ssr: false,
  loading: () => (
    <div className="lg:col-span-12 bg-[color:var(--cm-surface)] p-10 rounded-2xl shadow-sm border border-[color:var(--cm-border)] flex flex-col items-center justify-center gap-4 min-h-[260px]">
      <div className="w-8 h-8 rounded-full border-2 border-[color:var(--cm-border)] border-t-[color:var(--cm-brass)] animate-spin" />
      <div className="text-sm font-medium text-[color:var(--cm-ink-3)]">正在加载编辑器...</div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center py-6 px-4 md:py-12">
      <div className="w-full max-w-6xl flex flex-col gap-6 md:gap-8">
        <header className="cm-home-header flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[color:var(--cm-ink)]">Color Match Live</h1>
          <p className="max-w-xl text-sm md:text-base text-[color:var(--cm-ink-2)] md:text-right">
            创建具有电影感和小红书风格的排版图片。自动取色，自动解析 EXIF。
          </p>
        </header>

        <ImageEditor />
      </div>

      <footer className="cm-home-footer mt-auto py-8 text-center text-[color:var(--cm-ink-3)] text-sm">
        &copy; 2026 Color Match Live. All rights reserved.
      </footer>
    </main>
  );
}
