"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Upload, Download, RefreshCw, MapPin, Calendar, Pipette, Palette, Type as TypeIcon, ArrowLeftRight, ArrowUpDown, Scissors, Sliders, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ColorScheme {
  bg: string;
  text: string;
  name: string;
}

interface FontOption {
  name: string;
  value: string;
  style: string;
  weight: string;
  cssVar: string;
}

type MobileTab = 'presets' | 'colors' | 'text' | 'crop';

type CropState = { x: number; y: number; scale: number };
const DEFAULT_CROP: CropState = { x: 0, y: 0, scale: 1 };

const FONT_OPTIONS: FontOption[] = [
  { name: '衬线', value: 'Playfair Display', style: 'italic', weight: '400', cssVar: 'var(--font-playfair)' },
  { name: '现代', value: 'Montserrat', style: 'normal', weight: '400', cssVar: 'var(--font-montserrat)' },
  { name: '优雅', value: 'Cormorant Garamond', style: 'italic', weight: '400', cssVar: 'var(--font-cormorant)' },
  { name: '简约', value: 'Lora', style: 'italic', weight: '400', cssVar: 'var(--font-lora)' },
  { name: '文艺', value: 'Merriweather', style: 'normal', weight: '700', cssVar: 'var(--font-merriweather)' },
];

const FALLBACK_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export default function ImageEditor() {
  const [image, setImage] = useState<string | null>(null);
  const [schemes, setSchemes] = useState<ColorScheme[]>([]);
  const [selectedSchemeIndex, setSelectedSchemeIndex] = useState<number>(0);
  const [location, setLocation] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageRatio, setImageRatio] = useState<number>(1);
  const [customBgColor, setCustomBgColor] = useState<string>("");
  const [customTextColor, setCustomTextColor] = useState<string>("");
  const [isPickerMode, setIsPickerMode] = useState<'bg' | 'text' | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'bg' | 'text'>('bg');
  const [hoverColor, setHoverColor] = useState<string>("#ffffff");
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('presets');
  const [selectedFontIndex, setSelectedFontIndex] = useState<number>(0);
  const [textScale, setTextScale] = useState<number>(1);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string>("");
  const [mobileUiNonce, setMobileUiNonce] = useState<number>(0);
  const [isCropMode, setIsCropMode] = useState<boolean>(false);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [isCropDragging, setIsCropDragging] = useState<boolean>(false);
  const [isRangeMode, setIsRangeMode] = useState<boolean>(false);
  const [isStripDragging, setIsStripDragging] = useState<boolean>(false);

  const portraitStripMin = 0.22;
  const landscapeStripMin = 0.25;
  const landscapeStripDefault = 0.4;
  const stripMax = 0.5;
  const [portraitStripRatio, setPortraitStripRatio] = useState<number>(portraitStripMin);
  const [landscapeStripRatio, setLandscapeStripRatio] = useState<number>(landscapeStripDefault);

  const clampStripRatio = (v: number, min: number) => {
    const n = Number.isFinite(v) ? v : min;
    return Math.max(min, Math.min(stripMax, n));
  };

  const stripRangePct = (v: number, min: number) => {
    const t = clampStripRatio(v, min);
    const pct = ((t - min) / (stripMax - min)) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const portraitStripPct = (clampStripRatio(portraitStripRatio, portraitStripMin) * 100).toFixed(2);
  const landscapeStripPct = (clampStripRatio(landscapeStripRatio, landscapeStripMin) * 100).toFixed(2);
  const isPortrait = imageRatio < 1;

  const textScalePct = (() => {
    const min = 0.7;
    const max = 1.8;
    const v = Number.isFinite(textScale) ? textScale : 1;
    const pct = ((v - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, pct));
  })();

  const skipCustomSchemeSyncRef = useRef(false);

  useEffect(() => {
    if (skipCustomSchemeSyncRef.current) {
      skipCustomSchemeSyncRef.current = false;
      return;
    }
    if (!customBgColor || !/^#[0-9A-Fa-f]{6}$/.test(customBgColor)) return;
    
    const r = parseInt(customBgColor.slice(1, 3), 16);
    const g = parseInt(customBgColor.slice(3, 5), 16);
    const b = parseInt(customBgColor.slice(5, 7), 16);
    
    let textColor = customTextColor;
    if (!textColor || !/^#[0-9A-Fa-f]{6}$/.test(textColor)) {
      textColor = getContrastAdjustedColor([r, g, b], customBgColor, 'classic');
    }
    
    const customScheme: ColorScheme = {
      bg: customBgColor,
      text: textColor,
      name: "自定义"
    };
    
    const existingCustomIndex = schemes.findIndex(s => s.name === "自定义");
    
    if (existingCustomIndex >= 0) {
      const newSchemes = [...schemes];
      newSchemes[existingCustomIndex] = customScheme;
      setSchemes(newSchemes);
      setSelectedSchemeIndex(existingCustomIndex);
    } else if (schemes.length >= 6) {
      const newSchemes = schemes.slice(0, 6);
      newSchemes.push(customScheme);
      setSchemes(newSchemes);
      setSelectedSchemeIndex(6);
    } else {
      setSchemes([...schemes, customScheme]);
      setSelectedSchemeIndex(schemes.length);
    }
  }, [customBgColor, customTextColor]);
  
  const mobileImgRef = useRef<HTMLImageElement>(null);
  const desktopImgRef = useRef<HTMLImageElement>(null);
  const mobilePreviewCardRef = useRef<HTMLDivElement>(null);
  const desktopPreviewCardRef = useRef<HTMLDivElement>(null);
  const mobileStripRef = useRef<HTMLDivElement>(null);
  const desktopStripRef = useRef<HTMLDivElement>(null);
  const mobileCropViewportRef = useRef<HTMLDivElement>(null);
  const desktopCropViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorPickerCanvasRef = useRef<HTMLCanvasElement>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const locationManuallyEditedRef = useRef(false);
  const locationRequestIdRef = useRef(0);
  const locationValueRef = useRef<string>("");
  const dateManuallyEditedRef = useRef(false);
  const dateRequestIdRef = useRef(0);
  const dateValueRef = useRef<string>("");
  const pickerPointRef = useRef<{ x: number; y: number } | null>(null);

  const mobilePreviewFontPx = (() => {
    try {
      const card = mobilePreviewCardRef.current;
      if (!card) return (isPortrait ? 13 : 17) * textScale;
      const rect = card.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w <= 0 || h <= 0) return (isPortrait ? 13 : 17) * textScale;
      const baseFontPx = isPortrait ? 13 : 17;
      return baseFontPx * textScale;
    } catch { return (isPortrait ? 13 : 17) * textScale; }
  })();

  const desktopPreviewFontPx = (() => {
    try {
      const card = desktopPreviewCardRef.current;
      if (!card) return (isPortrait ? 13 : 17) * textScale;
      const rect = card.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w <= 0 || h <= 0) return (isPortrait ? 13 : 17) * textScale;
      const baseFontPx = isPortrait ? 13 : 17;
      return baseFontPx * textScale;
    } catch { return (isPortrait ? 13 : 17) * textScale; }
  })();

  const cropPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const cropGestureRef = useRef<
    | null
    | {
        mode: "drag";
        rect: DOMRect;
        pointerId: number;
        startPointerX: number;
        startPointerY: number;
        startCropX: number;
        startCropY: number;
      }
    | {
        mode: "pinch";
        rect: DOMRect;
        startScale: number;
        startCropX: number;
        startCropY: number;
        startCenterX: number;
        startCenterY: number;
        startDistance: number;
      }
  >(null);

  const handleSelectScheme = (schemeIndex: number) => {
    const scheme = schemes[schemeIndex];
    if (!scheme) return;
    if (isCropMode || isRangeMode) return;
    setIsPickerMode(null);
    setSelectedSchemeIndex(schemeIndex);
    skipCustomSchemeSyncRef.current = true;
    setCustomBgColor(scheme.bg);
    setCustomTextColor(scheme.text);
  };
  const cropActiveViewportKeyRef = useRef<"mobile" | "desktop" | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const mobileControlsRef = useRef<HTMLDivElement>(null);
  const mobilePreviewRef = useRef<HTMLDivElement>(null);
  const lastMobileFocusActiveRef = useRef(false);
  const cropModeWantedRef = useRef(false);
  const [cropViewport, setCropViewport] = useState<{ mobile: { w: number; h: number }; desktop: { w: number; h: number } }>(
    { mobile: { w: 0, h: 0 }, desktop: { w: 0, h: 0 } }
  );
  const lastCropViewportRef = useRef<{ mobile: { w: number; h: number }; desktop: { w: number; h: number } }>({
    mobile: { w: 0, h: 0 },
    desktop: { w: 0, h: 0 },
  });
  const getViewportOrLast = (key: "mobile" | "desktop") => {
    const cur = cropViewport[key];
    if (cur.w > 0 && cur.h > 0) return cur;
    return lastCropViewportRef.current[key];
  };
  const isMobileNow = () => {
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
      const coarse = typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)").matches
        : false;
      return coarse || /iPhone|iPad|iPod|Android/i.test(ua);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (cropViewport.mobile.w > 0 && cropViewport.mobile.h > 0) {
      lastCropViewportRef.current.mobile = cropViewport.mobile;
    }
    if (cropViewport.desktop.w > 0 && cropViewport.desktop.h > 0) {
      lastCropViewportRef.current.desktop = cropViewport.desktop;
    }
  }, [cropViewport.mobile.w, cropViewport.mobile.h, cropViewport.desktop.w, cropViewport.desktop.h]);

  useEffect(() => {
    if (!isMobileNow()) return;
    if (mobileTab !== "crop") {
      cropModeWantedRef.current = false;
      if (isCropMode) setIsCropMode(false);
      return;
    }
    cropModeWantedRef.current = true;
    if (isPickerMode) return;
    if (!isCropMode) setIsCropMode(true);
  }, [mobileTab, isPickerMode, isCropMode]);

  useEffect(() => {
    if (isCropMode || isPickerMode) {
      if (isRangeMode) setIsRangeMode(false);
    }
  }, [isCropMode, isPickerMode, isRangeMode]);

  useEffect(() => {
    if (isRangeMode) return;
    if (stripGestureRef.current) stripGestureRef.current = null;
    if (isStripDragging) setIsStripDragging(false);
  }, [isRangeMode, isStripDragging]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDesktopBp =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(min-width: 1024px)").matches
        : false;
    if (isDesktopBp) return;
    if (mobileTab !== "colors" && isRangeMode) setIsRangeMode(false);
  }, [mobileTab, isRangeMode]);

  const [mobileStripEdgePx, setMobileStripEdgePx] = useState<number | null>(null);
  const [desktopStripEdgePx, setDesktopStripEdgePx] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isRangeMode) {
      setMobileStripEdgePx(null);
      setDesktopStripEdgePx(null);
      return;
    }

    const update = () => {
      const dpr = typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
      const snap = (v: number) => Math.round(v * dpr) / dpr;

      const mCard = mobilePreviewCardRef.current;
      const mStrip = mobileStripRef.current;
      if (mCard && mStrip) {
        const cardRect = mCard.getBoundingClientRect();
        const stripRect = mStrip.getBoundingClientRect();
        if (cardRect.width > 0 && cardRect.height > 0) {
          const edge = isPortrait ? stripRect.right - cardRect.left : stripRect.bottom - cardRect.top;
          if (Number.isFinite(edge)) setMobileStripEdgePx(snap(edge));
        }
      }

      const dCard = desktopPreviewCardRef.current;
      const dStrip = desktopStripRef.current;
      if (dCard && dStrip) {
        const cardRect = dCard.getBoundingClientRect();
        const stripRect = dStrip.getBoundingClientRect();
        if (cardRect.width > 0 && cardRect.height > 0) {
          const edge = isPortrait ? stripRect.right - cardRect.left : stripRect.bottom - cardRect.top;
          if (Number.isFinite(edge)) setDesktopStripEdgePx(snap(edge));
        }
      }
    };

    const raf1 = window.requestAnimationFrame(() => {
      update();
      window.requestAnimationFrame(update);
    });
    window.addEventListener("resize", update, { passive: true });

    const ro =
      typeof (window as any).ResizeObserver === "function"
        ? new (window as any).ResizeObserver(() => update())
        : null;
    if (ro) {
      const mCard = mobilePreviewCardRef.current;
      const mStrip = mobileStripRef.current;
      const dCard = desktopPreviewCardRef.current;
      const dStrip = desktopStripRef.current;
      if (mCard) ro.observe(mCard);
      if (mStrip) ro.observe(mStrip);
      if (dCard) ro.observe(dCard);
      if (dStrip) ro.observe(dStrip);
    }
    return () => {
      try {
        window.cancelAnimationFrame(raf1);
      } catch {}
      window.removeEventListener("resize", update);
      try {
        ro?.disconnect();
      } catch {}
    };
  }, [isRangeMode, isPortrait, portraitStripPct, landscapeStripPct]);

  useEffect(() => {
    if (!isCropMode) return;
    if (typeof window === "undefined") return;
    const raf = window.requestAnimationFrame(() => {
      const desktopEl = desktopCropViewportRef.current;
      const mobileEl = mobileCropViewportRef.current;
      const desktopRect = desktopEl?.getBoundingClientRect();
      const mobileRect = mobileEl?.getBoundingClientRect();
      const useDesktop = !!desktopRect && desktopRect.width > 0 && desktopRect.height > 0;
      const rect = useDesktop ? desktopRect : mobileRect;
      const key: "mobile" | "desktop" = useDesktop ? "desktop" : "mobile";
      if (!rect) return;
      const vw = (useDesktop ? desktopEl?.clientWidth : mobileEl?.clientWidth) || rect.width;
      const vh = (useDesktop ? desktopEl?.clientHeight : mobileEl?.clientHeight) || rect.height;
      if (!vw || !vh) return;

      lastCropViewportRef.current[key] = { w: vw, h: vh };
      setCropViewport((prev) => {
        const cur = prev[key];
        if (Math.abs(cur.w - vw) < 0.5 && Math.abs(cur.h - vh) < 0.5) return prev;
        return { ...prev, [key]: { w: vw, h: vh } };
      });

      setCrop((prev) => {
        const scale = clampCropScale(prev.scale);
        const bounds = getCropBounds(vw, vh, scale);
        const clamped = clampCropXY(prev.x, prev.y, bounds);
        if (clamped.x === prev.x && clamped.y === prev.y && scale === prev.scale) return prev;
        return { x: clamped.x, y: clamped.y, scale };
      });
    });
    return () => {
      try {
        window.cancelAnimationFrame(raf);
      } catch {}
    };
  }, [isCropMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateFromEl = (key: "mobile" | "desktop", el: HTMLDivElement | null) => {
      if (!el) {
        setCropViewport((prev) => {
          const cur = prev[key];
          if (cur.w === 0 && cur.h === 0) return prev;
          return { ...prev, [key]: { w: 0, h: 0 } };
        });
        return;
      }
      const rect = el.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        setCropViewport((prev) => {
          const cur = prev[key];
          if (cur.w === 0 && cur.h === 0) return prev;
          return { ...prev, [key]: { w: 0, h: 0 } };
        });
        return;
      }
      setCropViewport((prev) => {
        const next = { ...prev, [key]: { w: rect.width, h: rect.height } };
        const cur = prev[key];
        if (Math.abs(cur.w - rect.width) < 0.5 && Math.abs(cur.h - rect.height) < 0.5) return prev;
        return next;
      });
    };

    const m = mobileCropViewportRef.current;
    const d = desktopCropViewportRef.current;

    updateFromEl("mobile", m);
    updateFromEl("desktop", d);

    const onResize = () => {
      updateFromEl("mobile", mobileCropViewportRef.current);
      updateFromEl("desktop", desktopCropViewportRef.current);
    };

    window.addEventListener("resize", onResize, { passive: true });

    const ro =
      typeof (window as any).ResizeObserver === "function"
        ? new (window as any).ResizeObserver(() => onResize())
        : null;
    if (ro) {
      if (m) ro.observe(m);
      if (d) ro.observe(d);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      try {
        ro?.disconnect();
      } catch {}
    };
  }, [image, imageRatio]);

  const getCropCoverBaseSize = (vw: number, vh: number) => {
    const w = Math.max(0, vw);
    const h = Math.max(0, vh);
    if (!w || !h || !Number.isFinite(imageRatio) || imageRatio <= 0) return { baseW: w, baseH: h };
    const areaRatio = w / h;
    if (imageRatio > areaRatio) {
      return { baseW: h * imageRatio, baseH: h };
    }
    return { baseW: w, baseH: w / imageRatio };
  };

  const getCropBounds = (vw: number, vh: number, scale: number) => {
    const { baseW, baseH } = getCropCoverBaseSize(vw, vh);
    const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const scaledW = baseW * s;
    const scaledH = baseH * s;
    const maxX = Math.max(0, (scaledW - vw) / 2);
    const maxY = Math.max(0, (scaledH - vh) / 2);
    return { maxX, maxY, baseW, baseH };
  };

  const clampCropXY = (x: number, y: number, bounds: { maxX: number; maxY: number }) => {
    const cx = Math.max(-bounds.maxX, Math.min(bounds.maxX, x));
    const cy = Math.max(-bounds.maxY, Math.min(bounds.maxY, y));
    return { x: cx, y: cy };
  };

  const clampCropScale = (scale: number) => {
    const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
    return Math.max(1, Math.min(3, s));
  };

  const normalizeCropForViewport = (vw: number, vh: number, c: CropState) => {
    const w = Math.max(0, vw);
    const h = Math.max(0, vh);
    const scale = clampCropScale(c.scale);
    if (!w || !h) return { x: c.x, y: c.y, scale };
    const bounds = getCropBounds(w, h, scale);
    const clamped = clampCropXY(c.x, c.y, bounds);
    return { x: clamped.x, y: clamped.y, scale };
  };

  const getCropCenterUVFor = (c: CropState, vw: number, vh: number) => {
    const w = Math.max(0, vw);
    const h = Math.max(0, vh);
    if (!w || !h) return { u: 0.5, v: 0.5 };
    const { baseW, baseH } = getCropCoverBaseSize(w, h);
    const scale = clampCropScale(c.scale);
    const scaledW = baseW * scale;
    const scaledH = baseH * scale;
    if (!scaledW || !scaledH) return { u: 0.5, v: 0.5 };
    const uRaw = 0.5 - c.x / scaledW;
    const vRaw = 0.5 - c.y / scaledH;
    const u = Math.max(0, Math.min(1, uRaw));
    const v = Math.max(0, Math.min(1, vRaw));
    return { u, v };
  };

  const getCropCenterUV = (vw: number, vh: number) => {
    return getCropCenterUVFor(crop, vw, vh);
  };

  const getCropMiniMapFor = (c: CropState, vw: number, vh: number, thumbSize: number) => {
    const w = Math.max(0, vw);
    const h = Math.max(0, vh);
    const size = Math.max(0, thumbSize);
    if (!w || !h || !size) return null;
    if (!Number.isFinite(imageRatio) || imageRatio <= 0) return null;
    const imgW = imageRatio >= 1 ? size : size * imageRatio;
    const imgH = imageRatio >= 1 ? size / imageRatio : size;
    const imgX = (size - imgW) / 2;
    const imgY = (size - imgH) / 2;

    const { baseW, baseH } = getCropCoverBaseSize(w, h);
    const scale = clampCropScale(c.scale);
    const scaledW = baseW * scale;
    const scaledH = baseH * scale;
    if (!scaledW || !scaledH) return null;

    const viewWFrac = Math.max(0, Math.min(1, w / scaledW));
    const viewHFrac = Math.max(0, Math.min(1, h / scaledH));

    const leftPxRaw = scaledW / 2 - c.x - w / 2;
    const topPxRaw = scaledH / 2 - c.y - h / 2;
    const maxLeftPx = Math.max(0, scaledW - w);
    const maxTopPx = Math.max(0, scaledH - h);
    const leftPx = Math.max(0, Math.min(maxLeftPx, leftPxRaw));
    const topPx = Math.max(0, Math.min(maxTopPx, topPxRaw));

    const leftFrac = scaledW ? leftPx / scaledW : 0;
    const topFrac = scaledH ? topPx / scaledH : 0;

    const frameX = imgX + leftFrac * imgW;
    const frameY = imgY + topFrac * imgH;
    const frameW = viewWFrac * imgW;
    const frameH = viewHFrac * imgH;

    return { imgX, imgY, imgW, imgH, frameX, frameY, frameW, frameH };
  };

  useEffect(() => {
    const desktop = getViewportOrLast("desktop");
    const mobile = getViewportOrLast("mobile");
    const vw = desktop.w && desktop.h ? desktop.w : mobile.w;
    const vh = desktop.w && desktop.h ? desktop.h : mobile.h;
    if (!vw || !vh) return;
    setCrop((prev) => {
      const s = Number.isFinite(prev.scale) && prev.scale > 0 ? prev.scale : 1;
      const scale = Math.max(1, Math.min(3, s));
      const bounds = getCropBounds(vw, vh, scale);
      const clamped = clampCropXY(prev.x, prev.y, bounds);
      if (clamped.x === prev.x && clamped.y === prev.y && scale === prev.scale) return prev;
      return { x: clamped.x, y: clamped.y, scale };
    });
  }, [cropViewport.desktop.w, cropViewport.desktop.h, cropViewport.mobile.w, cropViewport.mobile.h]);

  const handleCropWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isCropMode || isPickerMode) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const vw = e.currentTarget.clientWidth || rect.width;
    const vh = e.currentTarget.clientHeight || rect.height;
    const key: "mobile" | "desktop" =
      e.currentTarget === mobileCropViewportRef.current ? "mobile" : "desktop";
    lastCropViewportRef.current[key] = { w: vw, h: vh };
    setCropViewport((prev) => {
      const cur = prev[key];
      if (Math.abs(cur.w - vw) < 0.5 && Math.abs(cur.h - vh) < 0.5) return prev;
      return { ...prev, [key]: { w: vw, h: vh } };
    });
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setCrop((prev) => {
      const nextScale = Math.max(1, Math.min(3, prev.scale + delta));
      const bounds = getCropBounds(vw, vh, nextScale);
      const clamped = clampCropXY(prev.x, prev.y, bounds);
      return { x: clamped.x, y: clamped.y, scale: nextScale };
    });
  };

  const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCropMode || isPickerMode) return;
    try { e.preventDefault(); } catch {}
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const vw = e.currentTarget.clientWidth || rect.width;
    const vh = e.currentTarget.clientHeight || rect.height;
    const key: "mobile" | "desktop" =
      e.currentTarget === mobileCropViewportRef.current ? "mobile" : "desktop";
    cropActiveViewportKeyRef.current = key;
    lastCropViewportRef.current[key] = { w: vw, h: vh };
    setCropViewport((prev) => {
      const cur = prev[key];
      if (Math.abs(cur.w - vw) < 0.5 && Math.abs(cur.h - vh) < 0.5) return prev;
      return { ...prev, [key]: { w: vw, h: vh } };
    });
    cropPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}

    const pointers = cropPointersRef.current;
    if (pointers.size === 1) {
      cropGestureRef.current = {
        mode: "drag",
        rect,
        pointerId: e.pointerId,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startCropX: crop.x,
        startCropY: crop.y,
      };
      setIsCropDragging(true);
      return;
    }

    if (pointers.size >= 2) {
      const pts = Array.from(pointers.values()).slice(0, 2);
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy) || 1;
      const centerX = (pts[0].x + pts[1].x) / 2 - (rect.left + rect.width / 2);
      const centerY = (pts[0].y + pts[1].y) / 2 - (rect.top + rect.height / 2);
      cropGestureRef.current = {
        mode: "pinch",
        rect,
        startScale: crop.scale,
        startCropX: crop.x,
        startCropY: crop.y,
        startCenterX: centerX,
        startCenterY: centerY,
        startDistance: dist,
      };
      setIsCropDragging(true);
    }
  };

  const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCropMode || isPickerMode) return;
    const pointers = cropPointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = cropGestureRef.current;
    if (!g) return;
    try { e.preventDefault(); } catch {}
    const rectNow = e.currentTarget.getBoundingClientRect();
    const vw = e.currentTarget.clientWidth || rectNow.width;
    const vh = e.currentTarget.clientHeight || rectNow.height;
    const key: "mobile" | "desktop" =
      e.currentTarget === mobileCropViewportRef.current ? "mobile" : "desktop";
    lastCropViewportRef.current[key] = { w: vw, h: vh };
    setCropViewport((prev) => {
      const cur = prev[key];
      if (Math.abs(cur.w - vw) < 0.5 && Math.abs(cur.h - vh) < 0.5) return prev;
      return { ...prev, [key]: { w: vw, h: vh } };
    });

    if (pointers.size === 1 && g.mode === "drag") {
      if (e.pointerId !== g.pointerId) return;
      const dx = e.clientX - g.startPointerX;
      const dy = e.clientY - g.startPointerY;
      setCrop((prev) => {
        const bounds = getCropBounds(vw, vh, prev.scale);
        const next = clampCropXY(g.startCropX + dx, g.startCropY + dy, bounds);
        if (next.x === prev.x && next.y === prev.y) return prev;
        return { x: next.x, y: next.y, scale: prev.scale };
      });
      return;
    }

    if (pointers.size >= 2 && g.mode === "pinch") {
      const pts = Array.from(pointers.values()).slice(0, 2);
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy) || 1;
      const ratio = dist / (g.startDistance || 1);
      const nextScale = Math.max(1, Math.min(3, g.startScale * ratio));
      const bounds = getCropBounds(vw, vh, nextScale);
      const k = nextScale / (g.startScale || 1);
      const centerX = (pts[0].x + pts[1].x) / 2 - (rectNow.left + rectNow.width / 2);
      const centerY = (pts[0].y + pts[1].y) / 2 - (rectNow.top + rectNow.height / 2);
      const nextX = k * g.startCropX + (centerX - k * g.startCenterX);
      const nextY = k * g.startCropY + (centerY - k * g.startCenterY);
      const clamped = clampCropXY(nextX, nextY, bounds);
      setCrop({ x: clamped.x, y: clamped.y, scale: nextScale });
    }
  };

  const handleCropPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const pointers = cropPointersRef.current;
    pointers.delete(e.pointerId);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}

    if (pointers.size === 0) {
      cropGestureRef.current = null;
      cropActiveViewportKeyRef.current = null;
      setIsCropDragging(false);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      cropGestureRef.current = null;
      cropActiveViewportKeyRef.current = null;
      setIsCropDragging(false);
      return;
    }

    if (pointers.size === 1) {
      const [[pid, p]] = Array.from(pointers.entries());
      cropGestureRef.current = {
        mode: "drag",
        rect,
        pointerId: pid,
        startPointerX: p.x,
        startPointerY: p.y,
        startCropX: crop.x,
        startCropY: crop.y,
      };
      setIsCropDragging(true);
      return;
    }

    if (pointers.size >= 2) {
      const pts = Array.from(pointers.values()).slice(0, 2);
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy) || 1;
      const centerX = (pts[0].x + pts[1].x) / 2 - (rect.left + rect.width / 2);
      const centerY = (pts[0].y + pts[1].y) / 2 - (rect.top + rect.height / 2);
      cropGestureRef.current = {
        mode: "pinch",
        rect,
        startScale: crop.scale,
        startCropX: crop.x,
        startCropY: crop.y,
        startCenterX: centerX,
        startCenterY: centerY,
        startDistance: dist,
      };
      setIsCropDragging(true);
    }
  };

  const stripGestureRef = useRef<
    | null
    | {
        pointerId: number;
        mode: "portrait" | "landscape";
        startClientX: number;
        startClientY: number;
        startRatio: number;
        rectLeft: number;
        rectTop: number;
        rectW: number;
        rectH: number;
      }
  >(null);

  const handleStripPointerDown = (mode: "portrait" | "landscape") => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isRangeMode) return;
    if (isCropMode || isPickerMode) return;
    const rect = getActivePreviewCardEl()?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    try {
      e.preventDefault();
    } catch {}
    try {
      e.stopPropagation();
    } catch {}
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsStripDragging(true);
    stripGestureRef.current = {
      pointerId: e.pointerId,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRatio: mode === "portrait" ? clampStripRatio(portraitStripRatio, portraitStripMin) : clampStripRatio(landscapeStripRatio, landscapeStripMin),
      rectLeft: rect.left,
      rectTop: rect.top,
      rectW: rect.width,
      rectH: rect.height,
    };
  };

  const handleStripPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = stripGestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    try {
      e.preventDefault();
    } catch {}
    try {
      e.stopPropagation();
    } catch {}

    if (g.mode === "portrait") {
      const dx = e.clientX - g.startClientX;
      if (Math.abs(dx) < 0.5) return;
      const raw = g.startRatio + dx / g.rectW;
      setPortraitStripRatio(clampStripRatio(raw, portraitStripMin));
      return;
    }

    const dy = e.clientY - g.startClientY;
    if (Math.abs(dy) < 0.5) return;
    const raw = g.startRatio + dy / g.rectH;
    setLandscapeStripRatio(clampStripRatio(raw, landscapeStripMin));
  };

  const handleStripPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = stripGestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    try {
      e.preventDefault();
    } catch {}
    try {
      e.stopPropagation();
    } catch {}
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    stripGestureRef.current = null;
    setIsStripDragging(false);
  };

  const getActiveImgEl = () => {
    const candidates = [desktopImgRef.current, mobileImgRef.current];
    for (const el of candidates) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return el;
    }
    return desktopImgRef.current || mobileImgRef.current;
  };

  const getActiveCropViewportEl = () => {
    const candidates = [desktopCropViewportRef.current, mobileCropViewportRef.current];
    for (const el of candidates) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return el;
    }
    return desktopCropViewportRef.current || mobileCropViewportRef.current;
  };

  const getActivePreviewCardEl = () => {
    const candidates = [desktopPreviewCardRef.current, mobilePreviewCardRef.current];
    for (const el of candidates) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return el;
    }
    return desktopPreviewCardRef.current || mobilePreviewCardRef.current;
  };

  const scrollEditorIntoView = () => {
    try {
      if (typeof window === "undefined") return;
      editorRootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    } catch {}
  };

  const ensureMobilePreviewVisible = () => {
    try {
      const previewEl = mobilePreviewRef.current;
      if (previewEl) {
        previewEl.scrollIntoView({ block: "start", behavior: "auto" });
      }
    } catch {}
  };

  const resetMobileLayoutAfterKeyboard = () => {
    try {
      const scrollEl = mobileScrollRef.current;
      if (scrollEl) {
        scrollEl.scrollTop = 0;
      }
      ensureMobilePreviewVisible();
    } catch {}
  };

  const handleMobileFieldFocus = () => {
    try {
      if (typeof window === "undefined") return;
      lastMobileFocusActiveRef.current = true;
    } catch {}
  };

  const handleMobileFieldBlur = () => {
    try {
      if (typeof window === "undefined") return;
      resetMobileLayoutAfterKeyboard();
    } catch {}
  };

  const handleMobileKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    try {
      const anyTarget = e.currentTarget as any;
      if (anyTarget && typeof anyTarget.blur === "function") anyTarget.blur();
    } catch {}
    window.setTimeout(() => {
      try {
        resetMobileLayoutAfterKeyboard();
      } catch {}
    }, 80);
  };

  useEffect(() => {
    locationValueRef.current = location;
  }, [location]);

  useEffect(() => {
    dateValueRef.current = date;
  }, [date]);

  const downscaleImageForMobile = async (file: File) => {
    const maxDim = 1600;
    try {
      if (typeof createImageBitmap !== "function") return file;
      const bitmap = await createImageBitmap(file);
      const srcW = bitmap.width;
      const srcH = bitmap.height;
      const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
      if (scale >= 1) {
        if (typeof (bitmap as any).close === "function") {
          (bitmap as any).close();
        }
        return file;
      }

      const dstW = Math.max(1, Math.round(srcW * scale));
      const dstH = Math.max(1, Math.round(srcH * scale));
      const canvas = document.createElement("canvas");
      canvas.width = dstW;
      canvas.height = dstH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        if (typeof (bitmap as any).close === "function") {
          (bitmap as any).close();
        }
        return file;
      }

      ctx.drawImage(bitmap, 0, 0, dstW, dstH);
      if (typeof (bitmap as any).close === "function") {
        (bitmap as any).close();
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          0.92
        );
      });
      return blob;
    } catch {
      return file;
    }
  };

  const selectedColor = schemes[selectedSchemeIndex] ? schemes[selectedSchemeIndex].bg : "#e5e5e5";
  const textColor = schemes[selectedSchemeIndex] ? schemes[selectedSchemeIndex].text : "#171717";

  const reverseGeocodeCity = async (lat: number, lon: number) => {
    console.log("[ColorMatch] reverseGeocodeCity called:", lat, lon);
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => {
      try {
        if (controller) controller.abort();
      } catch {}
    }, 5000);

    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
        String(lat)
      )}&longitude=${encodeURIComponent(String(lon))}&localityLanguage=en`;
      console.log("[ColorMatch] API URL:", url);

      const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
      if (!res.ok) {
        console.log("[ColorMatch] API error:", res.status);
        return null;
      }
      const data: any = await res.json();
      console.log("[ColorMatch] API response:", data);
      const pick = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : null);
      const city = pick(data && data.city);
      const locality = pick(data && data.locality);
      const result = city || locality;
      console.log("[ColorMatch] City result:", result);
      return result;
    } catch (e) {
      console.log("[ColorMatch] API exception:", e);
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const getDeviceLocationCity = async () => {
    console.log("[ColorMatch] getDeviceLocationCity called");
    if (typeof navigator === "undefined") return null;
    const geo: any = (navigator as any).geolocation;
    if (!geo || typeof geo.getCurrentPosition !== "function") {
      console.log("[ColorMatch] Geolocation not available");
      return null;
    }

    const pos = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve(null);
      }, 7000);

      try {
        geo.getCurrentPosition(
          (p: any) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({
              latitude: p && p.coords ? p.coords.latitude : null,
              longitude: p && p.coords ? p.coords.longitude : null,
            } as any);
          },
          () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 6500, maximumAge: 600000 }
        );
      } catch {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(null);
      }
    });

    if (!pos || typeof pos.latitude !== "number" || typeof pos.longitude !== "number") return null;
    const city = await reverseGeocodeCity(pos.latitude, pos.longitude);
    return city;
  };

  const handleFileUpload = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget as HTMLInputElement;
    const processFile = (file: File) => {

      const formatDisplayDate = (d: Date) => {
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const month = monthNames[d.getMonth()];
      const hour = d.getHours();
      const ampm = hour >= 12 ? "pm" : "am";
      const hour12 = hour % 12 || 12;
      const timeStr = `${String(hour12).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}${ampm}`;
      return `${month} - ${timeStr}`;
    };

      setIsProcessing(true);
      setSchemes([]);
      setSelectedSchemeIndex(0);
      setCustomBgColor("");
      setCustomTextColor("");
      setIsPickerMode(null);
      setMousePos(null);
      locationManuallyEditedRef.current = false;
      const locationRequestId = ++locationRequestIdRef.current;
      dateManuallyEditedRef.current = false;
      const dateRequestId = ++dateRequestIdRef.current;
      setLocation("");
      setDate(formatDisplayDate(new Date()));

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const setPreviewFromFile = () => {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            if (result) setImage(result);
          };
          reader.onerror = () => {
            try {
              const fallbackUrl = URL.createObjectURL(file);
              objectUrlRef.current = fallbackUrl;
              setImage(fallbackUrl);
            } catch {}
          };
          reader.readAsDataURL(file);
          return;
        } catch {}
      };

      const isLivePhoto = (f: File) => {
        const t = f.type.toLowerCase();
        const n = f.name.toLowerCase();
        return (
          t.includes("heic") ||
          t.includes("heif") ||
          t.includes("avci") ||
          t.includes("avcs") ||
          n.endsWith(".heic") ||
          n.endsWith(".heif") ||
          n.endsWith(".avci") ||
          n.endsWith(".avcs") ||
          t.startsWith("image/heic") ||
          t.startsWith("image/heif") ||
          t.startsWith("image/avci") ||
          t.startsWith("image/avcs")
        );
      };

      const convertHeicToJpeg = async (f: File) => {
        try {
          const { default: heic2any } = await import("heic2any");
          const blob = await heic2any({
            blob: f,
            toType: "image/jpeg",
            quality: 0.92,
          }) as Blob;
          if (!blob || blob.size === 0) return null;
          return blob;
        } catch {
          return null;
        }
      };

      const extractVideoFrame = (f: File): Promise<string | null> =>
        new Promise((resolve) => {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.muted = true;
          video.playsInline = true;
          video.src = URL.createObjectURL(f);
          video.onloadeddata = () => {
            video.currentTime = 0.1;
          };
          video.onseeked = () => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                URL.revokeObjectURL(video.src);
                resolve(null);
                return;
              }
              ctx.drawImage(video, 0, 0);
              URL.revokeObjectURL(video.src);
              resolve(canvas.toDataURL("image/jpeg", 0.92));
            } catch {
              URL.revokeObjectURL(video.src);
              resolve(null);
            }
          };
          video.onerror = () => {
            URL.revokeObjectURL(video.src);
            resolve(null);
          };
          video.load();
        });

      void (async () => {
        const mime = file.type.toLowerCase();
        const isVideo = mime.startsWith("video/") || mime.includes("quicktime") || mime.includes("mp4");

        if (isLivePhoto(file)) {
          const converted = await convertHeicToJpeg(file);
          if (converted) {
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            const objectUrl = URL.createObjectURL(converted);
            objectUrlRef.current = objectUrl;
            setImage(objectUrl);
            return;
          }
        }

        if (isVideo) {
          const frameDataUrl = await extractVideoFrame(file);
          if (frameDataUrl) {
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            setImage(frameDataUrl);
            return;
          }
        }
      })();

      setPreviewFromFile();

      requestAnimationFrame(() => {
        scrollEditorIntoView();
      });

      const resetInputLater = () => {
        setTimeout(() => {
          try {
            inputEl.value = "";
          } catch {}
        }, 1500);
      };
      resetInputLater();

      const isMobile = isMobileNow();
      if (isMobile && file.size > 1500000) {
        void (async () => {
          const previewBlob = await downscaleImageForMobile(file);
          if (!previewBlob) return;
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
          const objectUrl = URL.createObjectURL(previewBlob);
          objectUrlRef.current = objectUrl;
          setImage(objectUrl);
        })();
      }

      const fallbackToDevice = () => {
        console.log("[ColorMatch] fallbackToDevice called");
        void (async () => {
          if (locationRequestIdRef.current !== locationRequestId) return;
          if (locationManuallyEditedRef.current) return;
          const current = typeof locationValueRef.current === "string" ? locationValueRef.current.trim() : "";
          if (current) return;
          const city = await getDeviceLocationCity();
          console.log("[ColorMatch] Device location city:", city);
          if (locationRequestIdRef.current !== locationRequestId) return;
          if (locationManuallyEditedRef.current) return;
          if (city) setLocation(city);
        })();
      };

      void (async () => {
        try {
          const { default: EXIF } = await import("exif-js");
          
          const processExif = (data: any) => {
            const dateTime =
              EXIF.getTag(data, "DateTimeOriginal") ||
              EXIF.getTag(data, "DateTimeDigitized") ||
              EXIF.getTag(data, "DateTime");
            if (typeof dateTime === "string" && dateTime.includes(" ")) {
              try {
                const parts = dateTime.split(" ");
                const dateParts = parts[0] ? parts[0].split(":") : null;
                const timeParts = parts[1] ? parts[1].split(":") : null;
                const monthIdx = dateParts && dateParts[1] ? parseInt(dateParts[1], 10) - 1 : NaN;
                const hour = timeParts && timeParts[0] ? parseInt(timeParts[0], 10) : NaN;
                const minute = timeParts && timeParts[1] ? parseInt(timeParts[1], 10) : NaN;

                if (
                  !Number.isNaN(monthIdx) &&
                  monthIdx >= 0 &&
                  monthIdx <= 11 &&
                  !Number.isNaN(hour) &&
                  !Number.isNaN(minute)
                ) {
                  const monthNames = [
                    "January",
                    "February",
                    "March",
                    "April",
                    "May",
                    "June",
                    "July",
                    "August",
                    "September",
                    "October",
                    "November",
                    "December",
                  ];
                  const month = monthNames[monthIdx];
                  const ampm = hour >= 12 ? "pm" : "am";
                  const hour12 = hour % 12 || 12;
                  const timeStr = `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")}${ampm}`;
                  if (dateRequestIdRef.current === dateRequestId && !dateManuallyEditedRef.current) {
                    setDate(`${month} - ${timeStr}`);
                  }
                }
              } catch {}
            }

            const gpsLat = EXIF.getTag(data, "GPSLatitude");
            const gpsLatRef = EXIF.getTag(data, "GPSLatitudeRef");
            const gpsLon = EXIF.getTag(data, "GPSLongitude");
            const gpsLonRef = EXIF.getTag(data, "GPSLongitudeRef");
            
            console.log("[ColorMatch] GPS Debug:", { gpsLat, gpsLatRef, gpsLon, gpsLonRef });

            const toNumber = (value: any) => {
              if (value == null) return null;
              if (typeof value === "number") return value;
              if (
                typeof value === "object" &&
                typeof value.numerator === "number" &&
                typeof value.denominator === "number" &&
                value.denominator !== 0
              ) {
                return value.numerator / value.denominator;
              }
              return null;
            };

            const dmsToDecimal = (dms: any[], ref: string | undefined) => {
              if (!Array.isArray(dms) || dms.length < 3) return null;
              const d = toNumber(dms[0]);
              const m = toNumber(dms[1]);
              const s = toNumber(dms[2]);
              if (d == null || m == null || s == null) return null;
              let dec = d + m / 60 + s / 3600;
              if (ref === "S" || ref === "W") dec = -dec;
              return dec;
            };

            const lat = dmsToDecimal(gpsLat, gpsLatRef);
            const lon = dmsToDecimal(gpsLon, gpsLonRef);

            if (lat != null && lon != null) {
              void (async () => {
                const city = await reverseGeocodeCity(lat, lon);
                if (locationRequestIdRef.current !== locationRequestId) return;
                if (locationManuallyEditedRef.current) return;
                if (city) setLocation(city);
              })();
            } else {
              fallbackToDevice();
            }

            resetInputLater();
          };

          try {
            EXIF.getData(file as any, processExif);
          } catch {
            const blobUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
              EXIF.getData(img, processExif);
              URL.revokeObjectURL(blobUrl);
            };
            img.onerror = () => {
              fallbackToDevice();
              resetInputLater();
              URL.revokeObjectURL(blobUrl);
            };
            img.src = blobUrl;
          }
        } catch {
          fallbackToDevice();
          resetInputLater();
        }
      })();
    };

    const file = inputEl.files && inputEl.files[0] ? inputEl.files[0] : undefined;
    if (file) {
      processFile(file);
      return;
    }

    let attempts = 0;
    const tryReadLater = () => {
      const f = inputEl.files && inputEl.files[0] ? inputEl.files[0] : undefined;
      if (f) {
        processFile(f);
        return;
      }
      attempts += 1;
      if (attempts >= 12) return;
      setTimeout(tryReadLater, 50);
    };
    setTimeout(tryReadLater, 0);
  };

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!root) return;
    if (image) root.classList.add("cm-preview-active");
    else root.classList.remove("cm-preview-active");
    return () => {
      root.classList.remove("cm-preview-active");
    };
  }, [image]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (!isMobileNow()) return;

    const vv = (window as any).visualViewport as VisualViewport | undefined;
    let pollTimer: number | null = null;

    const syncViewportVars = () => {
      try {
        const vvH = vv ? vv.height : 0;
        const docH = document.documentElement ? document.documentElement.clientHeight : 0;
        const h = Math.max(vvH || 0, window.innerHeight || 0, docH || 0);
        const scale = vv && typeof vv.scale === "number" ? vv.scale : 1;
        document.documentElement.style.setProperty("--cm-viewport-height", `${h}px`);
        document.documentElement.style.setProperty("--cm-viewport-scale", String(scale));
      } catch {}
    };

    const handleVvResize = () => {
      syncViewportVars();
      if (lastMobileFocusActiveRef.current) {
        window.setTimeout(() => {
          resetMobileLayoutAfterKeyboard();
          lastMobileFocusActiveRef.current = false;
        }, 300);
      }
    };

    syncViewportVars();
    if (vv) {
      vv.addEventListener("resize", handleVvResize);
    }
    pollTimer = window.setInterval(() => {
      syncViewportVars();
    }, 500);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", handleVvResize);
      }
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, []);

  const onImageLoad = (e?: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e?.currentTarget || getActiveImgEl();
    if (!img) return;
    const { naturalWidth, naturalHeight } = img;
    if (!naturalWidth || !naturalHeight) return;
    
    const ratio = naturalWidth / naturalHeight;
    setImageRatio(ratio);
    
    setIsProcessing(true);
    setTimeout(() => {
      extractColors();
    }, 60);
  };

  const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  const normalizeColor = (color: string): string => {
    if (!color) return "#171717";
    if (color.startsWith("#")) return color;
    const match = color.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      return rgbToHex(r, g, b);
    }
    return color.startsWith("#") ? color : `#${color}`;
  };

  const sampleHexAtClientPoint = (clientX: number, clientY: number) => {
    const img = getActiveImgEl();
    if (!img) return;

    const imgRect = img.getBoundingClientRect();
    const cx = clientX - imgRect.left;
    const cy = clientY - imgRect.top;

    if (cx < 0 || cy < 0 || cx >= imgRect.width || cy >= imgRect.height) {
      return;
    }

    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) {
      return;
    }

    const px = Math.round((cx / imgRect.width) * natW);
    const py = Math.round((cy / imgRect.height) * natH);

    if (px < 0 || py < 0 || px >= natW || py >= natH) {
      return;
    }

    const coverCanvas = document.createElement('canvas');
    coverCanvas.width = natW;
    coverCanvas.height = natH;
    const coverCtx = coverCanvas.getContext('2d');
    if (!coverCtx) return;

    coverCtx.drawImage(img, 0, 0);

    const pixel = coverCtx.getImageData(px, py, 1, 1).data;
    return rgbToHex(pixel[0], pixel[1], pixel[2]);
  };

  const handlePickerMoveAtClientPoint = (clientX: number, clientY: number) => {
    if (!isPickerMode) return;
    const hex = sampleHexAtClientPoint(clientX, clientY);
    if (!hex) return;
    pickerPointRef.current = { x: clientX, y: clientY };
    setMousePos({ x: clientX, y: clientY });
    setHoverColor(hex);
  };

  const handlePickerStartAtClientPoint = (clientX: number, clientY: number) => {
    if (!isPickerMode) return;
    handlePickerMoveAtClientPoint(clientX, clientY);
  };

  const handlePickerEnd = () => {
    if (!isPickerMode) return;
    const p = pickerPointRef.current || mousePos;
    if (!p) return;
    const hex = sampleHexAtClientPoint(p.x, p.y);
    if (!hex) return;
    if (isPickerMode === "bg") setCustomBgColor(hex);
    else setCustomTextColor(hex);
    setIsPickerMode(null);
    setMousePos(null);
    pickerPointRef.current = null;
  };

  const handlePickerPickAtClientPoint = (clientX: number, clientY: number) => {
    if (!isPickerMode) return;
    const hex = sampleHexAtClientPoint(clientX, clientY);
    if (!hex) return;
    if (isPickerMode === 'bg') setCustomBgColor(hex);
    else setCustomTextColor(hex);
    setIsPickerMode(null);
    setMousePos(null);
    pickerPointRef.current = null;
  };

  const getColorBrightness = (r: number, g: number, b: number) => {
    return (r * 299 + g * 587 + b * 114) / 1000;
  };

  const getContrastAdjustedColor = (targetRgb: number[], bgHex: string, mode: 'classic' | 'tinted' | 'muted' = 'classic') => {
    const [h, s] = rgbToHsv(targetRgb[0], targetRgb[1], targetRgb[2]);
    
    const r = parseInt(bgHex.slice(1, 3), 16) / 255;
    const g = parseInt(bgHex.slice(3, 5), 16) / 255;
    const b = parseInt(bgHex.slice(5, 7), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const isBgLight = luminance > 0.42;

    if (isBgLight) {
      let targetV = 0.08;
      let targetS = Math.min(s + 0.4, 0.7);
      if (mode === 'tinted') {
        targetV = 0.15;
        targetS = Math.min(s + 0.5, 0.8);
      } else if (mode === 'muted') {
        targetV = 0.25;
        targetS = Math.min(s, 0.3);
      }
      const [tr, tg, tb] = hsvToRgb(h, targetS, targetV);
      return rgbToHex(tr, tg, tb);
    } else {
      let targetV = 0.99;
      let targetS = Math.min(s, 0.15);
      if (mode === 'tinted') {
        targetV = 0.92;
        targetS = Math.min(s + 0.1, 0.25);
      } else if (mode === 'muted') {
        targetV = 0.85;
        targetS = Math.min(s, 0.1);
      }
      const [tr, tg, tb] = hsvToRgb(h, targetS, targetV);
      return rgbToHex(tr, tg, tb);
    }
  };

  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s, v];
  };

  const hsvToRgb = (h: number, s: number, v: number) => {
    let r = 0, g = 0, b = 0;
    const i = Math.floor(h / 60);
    const f = h / 60 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const extractColors = () => {
    const img = getActiveImgEl();
    if (!img) return;
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const maxSampleDim = isMobileNow() ? 240 : 400;
      const scale = Math.min(1, maxSampleDim / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      const colorBuckets: Map<string, { samples: Array<{ r: number, g: number, b: number, s: number, v: number }>, repRgb: number[], repSat: number, repVal: number, richRgb: number[], richSat: number, richVal: number, peakRgb: number[], peakSat: number, peakVal: number, count: number, totalSat: number, totalVal: number }> = new Map();
      const binSize = 20;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
        if (a < 128) continue;
        
        const [h, s, v] = rgbToHsv(r, g, b);
        
        // --- RELAXED FILTERING ---
        // We want to capture the "soul" of the photo, including its shadows and deep tones.
        if (v < 0.15) continue; 
        if (s < 0.05 && v < 0.3) continue;

        const binIdx = Math.floor(h / binSize);
        const key = `hue_${binIdx}`;
        
        if (!colorBuckets.has(key)) {
          colorBuckets.set(key, { 
            samples: [{ r, g, b, s, v }],
            repRgb: [r, g, b],
            repSat: s,
            repVal: v,
            richRgb: [r, g, b],
            richSat: s,
            richVal: v,
            peakRgb: [r, g, b],
            peakSat: s,
            peakVal: v,
            count: 1, 
            totalSat: s, 
            totalVal: v 
          });
        } else {
          const bucket = colorBuckets.get(key)!;
          bucket.count++;
          bucket.totalSat += s;
          bucket.totalVal += v;

          if (bucket.samples.length < 24) {
            bucket.samples.push({ r, g, b, s, v });
          } else {
            const j = Math.floor(Math.random() * bucket.count);
            if (j < 24) bucket.samples[j] = { r, g, b, s, v };
          }
          
          // Selection within bucket: 
          // Instead of just picking the most vibrant, we pick the one that 
          // is closest to the "feeling" of the bucket (average sat/val).
          const avgSat = bucket.totalSat / bucket.count;
          const avgVal = bucket.totalVal / bucket.count;
          
          const currentDist = Math.abs(bucket.repSat - avgSat) + Math.abs(bucket.repVal - avgVal);
          const newDist = Math.abs(s - avgSat) + Math.abs(v - avgVal);
          
          if (newDist < currentDist) {
            bucket.repRgb = [r, g, b];
            bucket.repSat = s;
            bucket.repVal = v;
          }

          const richScore = s * 0.85 + v * 0.15 - (Math.abs(s - avgSat) + Math.abs(v - avgVal)) * 0.35;
          const currentRichScore = bucket.richSat * 0.85 + bucket.richVal * 0.15 - (Math.abs(bucket.richSat - avgSat) + Math.abs(bucket.richVal - avgVal)) * 0.35;
          if (richScore > currentRichScore) {
            bucket.richRgb = [r, g, b];
            bucket.richSat = s;
            bucket.richVal = v;
          }

          const peakScore = s * 0.75 + v * 0.25;
          const currentPeakScore = bucket.peakSat * 0.75 + bucket.peakVal * 0.25;
          if (peakScore > currentPeakScore) {
            bucket.peakRgb = [r, g, b];
            bucket.peakSat = s;
            bucket.peakVal = v;
          }
        }
      }

      const allBins = Array.from(colorBuckets.values());
      
      if (allBins.length === 0) {
        setSchemes([{ bg: "#e5e5e5", text: "#171717", name: "默认" }]);
        return;
      }

      // --- ATMOSPHERE SCORE (Main Vibe) ---
      const hueDiff = (a: number, b: number) => {
        const diff = Math.abs(a - b);
        return Math.min(diff, 360 - diff);
      };

      const isHueDistinct = (h: number, used: number[], min: number) => used.every(uh => hueDiff(h, uh) > min);

      const atmosphereScore = (bin: typeof allBins[0]) => {
        const areaRatio = bin.count / pixels.length;
        const areaScore = areaRatio * 30; // High area weight
        const qualityScore = (bin.repSat * 0.4 + bin.repVal * 0.6) * 10;
        return areaScore + qualityScore;
      };

      const accentScore = (bin: typeof allBins[0], avoidHues: number[]) => {
        const areaRatio = bin.count / pixels.length;
        const base = bin.richSat * 24 + bin.richVal * 10;
        const tinyPenalty = areaRatio < 0.0015 ? 10 : 0;
        const hugePenalty = areaRatio > 0.25 ? 6 : 0;
        const areaBonus = Math.max(0, Math.min(1, (areaRatio - 0.002) / 0.02)) * 4;
        const neutralPenalty = bin.richSat < 0.16 ? 10 : 0;
        const darkPenalty = bin.richVal < 0.32 ? (0.32 - bin.richVal) * 40 : 0;
        const hotPenalty = bin.richSat > 0.82 ? (bin.richSat - 0.82) * 20 : 0;

        const hue = rgbToHsv(bin.peakRgb[0], bin.peakRgb[1], bin.peakRgb[2])[0];
        const minHueDiff = avoidHues.length === 0 ? 180 : Math.min(...avoidHues.map(uh => {
          const diff = Math.abs(hue - uh);
          return Math.min(diff, 360 - diff);
        }));
        const hueBonus = minHueDiff > 80 ? 6 : minHueDiff > 55 ? 3 : 0;

        return base + areaBonus + hueBonus - tinyPenalty - hugePenalty - neutralPenalty - darkPenalty - hotPenalty;
      };

      const sortedByAtmosphere = [...allBins].sort((a, b) => atmosphereScore(b) - atmosphereScore(a));
      
      const sortedByLightness = [...allBins].sort((a, b) => {
        const aSatOk = a.repVal > 0.85 ? a.repSat > 0.03 : a.repSat > 0.08;
        const bSatOk = b.repVal > 0.85 ? b.repSat > 0.03 : b.repSat > 0.08;
        if (aSatOk !== bSatOk) return aSatOk ? -1 : 1;

        const aBalance = a.repVal * 0.8 + (1 - a.repSat) * 0.2;
        const bBalance = b.repVal * 0.8 + (1 - b.repSat) * 0.2;
        return bBalance - aBalance;
      });

      const newSchemes: ColorScheme[] = [];
      const usedBgHues: number[] = [];
      const usedBgRgbs: number[][] = [];

      const createScheme = (bgRaw: number[], name: string, textMode: 'classic' | 'tinted' | 'muted') => {
        const bgHex = rgbToHex(bgRaw[0], bgRaw[1], bgRaw[2]);
        const [bgH] = rgbToHsv(bgRaw[0], bgRaw[1], bgRaw[2]);

        // Text color should be from a DIFFERENT hue in the photo for maximum richness
        const textTintSource = allBins
          .filter(b => {
            const h = rgbToHsv(b.peakRgb[0], b.peakRgb[1], b.peakRgb[2])[0];
            const hDiff = Math.min(Math.abs(h - bgH), 360 - Math.abs(h - bgH));
            return hDiff > 60;
          })
          .sort((a, b) => b.peakSat - a.peakSat)[0] || sortedByAtmosphere.find(b => {
            const h = rgbToHsv(b.repRgb[0], b.repRgb[1], b.repRgb[2])[0];
            return Math.min(Math.abs(h - bgH), 360 - Math.abs(h - bgH)) > 30;
          }) || sortedByAtmosphere[0];

        return {
          bg: bgHex,
          text: getContrastAdjustedColor(textTintSource.peakRgb, bgHex, textMode),
          name
        };
      };

      const rgbDistance = (a: number[], b: number[]) => {
        const dr = a[0] - b[0];
        const dg = a[1] - b[1];
        const db = a[2] - b[2];
        return Math.sqrt(dr * dr + dg * dg + db * db);
      };

      const registerBg = (rgb: number[]) => {
        const [h] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
        usedBgHues.push(h);
        usedBgRgbs.push(rgb);
      };

      const isRgbDistinct = (rgb: number[], minDist: number) => usedBgRgbs.every(u => rgbDistance(rgb, u) > minDist);

      const pickFromBins = (
        bins: typeof allBins,
        rgbSelector: (b: typeof allBins[number]) => number[],
        minHue: number,
        minRgb: number
      ) => {
        for (const b of bins) {
          const rgb = rgbSelector(b);
          const [h] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
          if (isHueDistinct(h, usedBgHues, minHue) && isRgbDistinct(rgb, minRgb)) return rgb;
        }
        for (const b of bins) {
          const rgb = rgbSelector(b);
          const [h] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
          if (isHueDistinct(h, usedBgHues, Math.max(12, minHue * 0.6)) && isRgbDistinct(rgb, Math.max(22, minRgb * 0.6))) return rgb;
        }
        for (const b of bins) {
          const rgb = rgbSelector(b);
          if (isRgbDistinct(rgb, Math.max(18, minRgb * 0.45))) return rgb;
        }
        return rgbSelector(bins[0]) || sortedByAtmosphere[0].repRgb;
      };

      const scheme1 = sortedByAtmosphere[0];
      const scheme1Rgb = scheme1.repRgb;
      registerBg(scheme1Rgb);
      newSchemes.push(createScheme(scheme1Rgb, "清爽氛围", 'classic'));

      const spotlightCandidate = [...allBins]
        .filter(b => b.peakSat >= 0.50 && b.peakVal >= 0.30)
        .sort((a, b) => {
          const aScore = a.peakSat * a.peakVal * 100;
          const bScore = b.peakSat * b.peakVal * 100;
          return bScore - aScore;
        })
        .find(b => {
          const [h] = rgbToHsv(b.peakRgb[0], b.peakRgb[1], b.peakRgb[2]);
          const distFromUsed = usedBgRgbs.map(u => {
            const dr = u[0] - b.peakRgb[0];
            const dg = u[1] - b.peakRgb[1];
            const db = u[2] - b.peakRgb[2];
            return Math.sqrt(dr*dr + dg*dg + db*db);
          });
          return isHueDistinct(h, usedBgHues, 25) && distFromUsed.every(d => d > 40);
        });

      const spotlightRaw = pickFromBins(
        spotlightCandidate ? [spotlightCandidate, ...sortedByAtmosphere] : sortedByAtmosphere,
        (b) => b.peakRgb,
        25,
        40
      );
      registerBg(spotlightRaw);
      newSchemes.push(createScheme(spotlightRaw, "点睛之色", 'tinted'));

      const accentCandidates = [...allBins]
        .filter(b => {
          const h = rgbToHsv(b.peakRgb[0], b.peakRgb[1], b.peakRgb[2])[0];
          const areaRatio = b.count / pixels.length;
          if (areaRatio < 0.0015) return false;
          if (b.richVal < 0.22) return false;
          if (b.richSat < 0.14) return false;
          return hueDiff(h, usedBgHues[0]) > 55;
        })
        .sort((a, b) => accentScore(b, usedBgHues) - accentScore(a, usedBgHues));

      const brightRaw = pickFromBins(
        accentCandidates.length ? accentCandidates : sortedByAtmosphere,
        (b) => b.richRgb,
        55,
        46
      );
      registerBg(brightRaw);
      newSchemes.push(createScheme(brightRaw, "明亮色彩", 'tinted'));

      const softCandidate = [...allBins]
        .filter(b => b.repVal > 0.72 && b.repSat > 0.06)
        .sort((a, b) => {
          const aScore = a.repVal * 10 + a.repSat * 4 + (a.count / pixels.length) * 4;
          const bScore = b.repVal * 10 + b.repSat * 4 + (b.count / pixels.length) * 4;
          return bScore - aScore;
        })
        .find(b => {
          const h = rgbToHsv(b.repRgb[0], b.repRgb[1], b.repRgb[2])[0];
          return isHueDistinct(h, usedBgHues, 35);
        });

      const softRaw = pickFromBins(
        softCandidate ? [softCandidate, ...sortedByLightness] : sortedByLightness,
        (b) => b.repRgb,
        35,
        38
      );
      registerBg(softRaw);
      newSchemes.push(createScheme(softRaw, "柔和背景", 'muted'));

      const midtoneCandidate = [...allBins]
        .filter(b => b.repVal >= 0.32 && b.repVal <= 0.68 && b.repSat >= 0.06 && b.repSat <= 0.28)
        .sort((a, b) => {
          const aArea = a.count / pixels.length;
          const bArea = b.count / pixels.length;
          const aMid = 1 - Math.abs(a.repVal - 0.52);
          const bMid = 1 - Math.abs(b.repVal - 0.52);
          const aScore = aMid * 10 + a.repSat * 4 + Math.min(1, aArea / 0.2) * 3;
          const bScore = bMid * 10 + b.repSat * 4 + Math.min(1, bArea / 0.2) * 3;
          return bScore - aScore;
        })
        .find(b => {
          const h = rgbToHsv(b.repRgb[0], b.repRgb[1], b.repRgb[2])[0];
          return isHueDistinct(h, usedBgHues, 25);
        });

      const midtoneRaw = pickFromBins(
        midtoneCandidate ? [midtoneCandidate, ...sortedByAtmosphere] : sortedByAtmosphere,
        (b) => b.repRgb,
        25,
        34
      );
      registerBg(midtoneRaw);
      newSchemes.push(createScheme(midtoneRaw, "胶片中调", 'classic'));

      const isWarmHue = (h: number) => (h >= 15 && h <= 80) || h >= 330 || h <= 10;

      const warmCandidate = [...allBins]
        .filter(b => b.repSat >= 0.08 && b.repVal >= 0.22 && b.repVal <= 0.75)
        .sort((a, b) => {
          const ha = rgbToHsv(a.repRgb[0], a.repRgb[1], a.repRgb[2])[0];
          const hb = rgbToHsv(b.repRgb[0], b.repRgb[1], b.repRgb[2])[0];

          const aWarm = isWarmHue(ha) ? 1 : 0;
          const bWarm = isWarmHue(hb) ? 1 : 0;
          if (aWarm !== bWarm) return bWarm - aWarm;

          const aArea = a.count / pixels.length;
          const bArea = b.count / pixels.length;

          const aSat = 1 - Math.abs(a.repSat - 0.18);
          const bSat = 1 - Math.abs(b.repSat - 0.18);
          const aVal = 1 - Math.abs(a.repVal - 0.48);
          const bVal = 1 - Math.abs(b.repVal - 0.48);

          const aScore = aSat * 6 + aVal * 6 + Math.min(1, aArea / 0.18) * 3;
          const bScore = bSat * 6 + bVal * 6 + Math.min(1, bArea / 0.18) * 3;
          return bScore - aScore;
        })
        .find(b => {
          const h = rgbToHsv(b.repRgb[0], b.repRgb[1], b.repRgb[2])[0];
          return isHueDistinct(h, usedBgHues, 22);
        });

      const warmRaw = pickFromBins(
        warmCandidate ? [warmCandidate, ...sortedByAtmosphere] : sortedByAtmosphere,
        (b) => b.repRgb,
        22,
        30
      );
      registerBg(warmRaw);
      newSchemes.push(createScheme(warmRaw, "暖影调", 'tinted'));

      setSchemes(newSchemes);
      setSelectedSchemeIndex(0);
      if (newSchemes[0]) {
        setCustomBgColor(newSchemes[0].bg);
        setCustomTextColor(newSchemes[0].text);
      }
    } catch (error) {
      console.error("Color extraction failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = async () => {
    const img = getActiveImgEl();
    if (!canvasRef.current || !img) {
      console.error('Canvas or image ref not available');
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error('Canvas 2d context not available');
      return;
    }

    if (!img.complete || img.naturalWidth === 0) {
      console.error('Image not loaded yet');
      return;
    }

    try {
      const fontReady: any = (document as any).fonts && (document as any).fonts.ready;
      if (fontReady && typeof fontReady.then === "function") {
        await Promise.race([fontReady, new Promise((r) => setTimeout(r, 600))]);
      }
    } catch {}
    
    const isPortrait = imageRatio < 1;
    const cropForExport = (() => {
      const useMobile = isMobileNow();
      const vw = useMobile ? cropViewport.mobile.w : cropViewport.desktop.w;
      const vh = useMobile ? cropViewport.mobile.h : cropViewport.desktop.h;
      const center = getCropCenterUV(vw, vh);
      const s = Number.isFinite(crop.scale) && crop.scale > 0 ? crop.scale : 1;
      return { u: center.u, v: center.v, scale: Math.max(1, Math.min(3, s)) };
    })();
    
    // Canvas size
    const targetWidth = 1200;
    const targetHeight = 1600; // Fixed 3:4 for export
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const getCssVar = (name: string, fallback: string) => {
      try {
        if (typeof window === "undefined") return fallback;
        const v = getComputedStyle(document.documentElement).getPropertyValue(name);
        const t = typeof v === "string" ? v.trim() : "";
        return t || fallback;
      } catch {
        return fallback;
      }
    };

    const paperColor = getCssVar("--cm-paper", "#f6f1e8");

    // Background (paper)
    ctx.fillStyle = paperColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const loc = typeof location === "string" ? location.trim() : "";
    const dat = typeof date === "string" ? date.trim() : "";
    const exportTextIsLong = (() => {
      return (loc.length + dat.length) > (isPortrait ? 18 : 28);
    })();
    const displayStr = (() => {
      if (loc && dat) return `${loc} · ${dat}`;
      if (loc) return loc;
      if (dat) return dat;
      return "";
    })();

    const isMobileExport = isMobileNow();
    const previewCardRef = isMobileExport ? mobilePreviewCardRef : desktopPreviewCardRef;

    const previewScale = (() => {
      try {
        const el = previewCardRef.current || img;
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width <= 0) return 1;
        const previewCardWidth = rect.width;
        if (!previewCardWidth || previewCardWidth <= 0) return 1;
        return targetWidth / previewCardWidth;
      } catch {
        return 1;
      }
    })();

    const getExportFontPx = (basePx: number) => {
      const scaled = basePx * previewScale;
      if (!Number.isFinite(scaled) || scaled <= 0) return Math.round(basePx * 2.5);
      return Math.max(10, Math.round(scaled));
    };

    const drawTextWithSpacing = (text: string, centerX: number, centerY: number, letterSpacingPx: number) => {
      if (!text) return;
      const chars = Array.from(text);
      if (chars.length === 0) return;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const widths: number[] = [];
      let total = 0;
      for (let i = 0; i < chars.length; i += 1) {
        const w = ctx.measureText(chars[i]).width;
        widths.push(w);
        total += w;
      }
      total += Math.max(0, chars.length - 1) * letterSpacingPx;
      let x = centerX - total / 2;
      for (let i = 0; i < chars.length; i += 1) {
        ctx.fillText(chars[i], x, centerY);
        x += widths[i] + letterSpacingPx;
      }
    };

    const basePreviewFontPx = (() => {
      if (isMobileExport) {
        return (isPortrait ? 13 : 17) * textScale;
      } else {
        return (isPortrait ? 13 : 17) * textScale;
      }
    })();

    const exportFontPx = Math.round(basePreviewFontPx * (isMobileExport ? 4 : 4));

    if (isPortrait) {
      const stripW = Math.round(targetWidth * clampStripRatio(portraitStripRatio, portraitStripMin));
      ctx.fillStyle = selectedColor;
      ctx.fillRect(0, 0, stripW, targetHeight);
      const imgX = stripW;
      const imgW = targetWidth - stripW;
      const imgH = targetHeight;

      const areaRatio = imgW / imgH;
      let baseW: number;
      let baseH: number;
      if (imageRatio > areaRatio) {
        baseH = imgH;
        baseW = imgH * imageRatio;
      } else {
        baseW = imgW;
        baseH = imgW / imageRatio;
      }
      const dW = baseW * cropForExport.scale;
      const dH = baseH * cropForExport.scale;
      const dX = imgX + imgW / 2 - cropForExport.u * dW;
      const dY = imgH / 2 - cropForExport.v * dH;
      ctx.save();
      ctx.beginPath();
      ctx.rect(imgX, 0, imgW, imgH);
      ctx.clip();
      ctx.drawImage(img, dX, dY, dW, dH);
      ctx.restore();

      ctx.save();
      ctx.translate(stripW / 2, targetHeight / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = textColor;
      const selectedFont = FONT_OPTIONS[selectedFontIndex];
      const fontWeight = selectedFont.weight;
      const fontPx = exportFontPx;
      const spacingRatio = exportTextIsLong ? 0.12 : 0.18;
      ctx.font = `${selectedFont.style} ${fontWeight} ${fontPx}px "${selectedFont.value}", serif`;
      const spacingPx = fontPx * spacingRatio;
      drawTextWithSpacing(displayStr, 0, 0, spacingPx);
      ctx.restore();
    } else {
      // Landscape Layout: Image on Bottom (60%), Text on Top (40%)
      const stripH = Math.round(targetHeight * clampStripRatio(landscapeStripRatio, landscapeStripMin));
      ctx.fillStyle = selectedColor;
      ctx.fillRect(0, 0, targetWidth, stripH);

      const imgAreaHeight = targetHeight - stripH;
      const imgAreaTop = stripH;
      
      // Draw image to fill the bottom area (object-cover)
      const areaRatio = targetWidth / imgAreaHeight;
      let baseW: number;
      let baseH: number;
      if (imageRatio > areaRatio) {
        baseH = imgAreaHeight;
        baseW = imgAreaHeight * imageRatio;
      } else {
        baseW = targetWidth;
        baseH = targetWidth / imageRatio;
      }
      const dW = baseW * cropForExport.scale;
      const dH = baseH * cropForExport.scale;
      const dX = targetWidth / 2 - cropForExport.u * dW;
      const dY = imgAreaTop + imgAreaHeight / 2 - cropForExport.v * dH;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, imgAreaTop, targetWidth, imgAreaHeight);
      ctx.clip();
      ctx.drawImage(img, dX, dY, dW, dH);
      ctx.restore();

      // Text on Top (centered in the top 50%)
      ctx.fillStyle = textColor;
      const selectedFont = FONT_OPTIONS[selectedFontIndex];
      const fontWeight = selectedFont.weight;
      const fontPx = exportFontPx;
      const spacingRatio = exportTextIsLong ? 0.1 : 0.16;
      ctx.font = `${selectedFont.style} ${fontWeight} ${fontPx}px "${selectedFont.value}", serif`;
      const spacingPx = fontPx * spacingRatio;
      drawTextWithSpacing(displayStr, targetWidth / 2, stripH / 2, spacingPx);
    }

    const previewDataUrl = canvas.toDataURL("image/png");
    setExportPreviewUrl(previewDataUrl);

    // Mobile: only show preview modal for long-press save, no direct download jump.
    if (isMobileNow()) {
      void (async () => {
        try {
          const { default: confetti } = await import("canvas-confetti");
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } catch {}
      })();
      return;
    }

    const filename = `color-match-${Date.now()}.png`;
    const triggerDownloadByUrl = (href: string) => {
      const link = document.createElement("a");
      link.download = filename;
      link.href = href;
      link.click();
    };

    // Prefer Blob download on mobile to avoid occasional 0B files.
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          triggerDownloadByUrl(blobUrl);
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
          }, 2000);
          return;
        }
        triggerDownloadByUrl(previewDataUrl);
      }, "image/png");
    } else {
      triggerDownloadByUrl(previewDataUrl);
    }
    
    void (async () => {
      try {
        const { default: confetti } = await import("canvas-confetti");
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch {}
    })();
  };

  const isDark = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  };

  const previewText = (() => {
    const loc = typeof location === "string" ? location.trim() : "";
    const dat = typeof date === "string" ? date.trim() : "";
    return { loc, dat };
  })();
  const previewTextIsLong = (previewText.loc.length + previewText.dat.length) > (isPortrait ? 18 : 28);
  const previewTextLine = (() => {
    if (previewText.loc && previewText.dat) return `${previewText.loc} · ${previewText.dat}`;
    return previewText.loc || previewText.dat || "";
  })();
  const effectiveViewport = (key: "mobile" | "desktop") => {
    if (
      isCropMode &&
      cropActiveViewportKeyRef.current === key
    ) {
      if (isCropDragging) {
        const last = lastCropViewportRef.current[key];
        if (last.w > 0 && last.h > 0) return last;
      }
      return getViewportOrLast(key);
    }
    return getViewportOrLast(key);
  };
  const mobileViewport = effectiveViewport("mobile");
  const desktopViewport = effectiveViewport("desktop");
  const mobileCropNorm = normalizeCropForViewport(mobileViewport.w, mobileViewport.h, crop);
  const desktopCropNorm = normalizeCropForViewport(desktopViewport.w, desktopViewport.h, crop);
  const mobileCropCover = getCropCoverBaseSize(mobileViewport.w, mobileViewport.h);
  const desktopCropCover = getCropCoverBaseSize(desktopViewport.w, desktopViewport.h);
  const coverOverscanPx = 2;
  const mobileCoverW = mobileViewport.w ? Math.ceil(Math.max(mobileCropCover.baseW, mobileViewport.w) + coverOverscanPx) : Math.ceil(mobileCropCover.baseW);
  const mobileCoverH = mobileViewport.h ? Math.ceil(Math.max(mobileCropCover.baseH, mobileViewport.h) + coverOverscanPx) : Math.ceil(mobileCropCover.baseH);
  const desktopCoverW = desktopViewport.w ? Math.ceil(Math.max(desktopCropCover.baseW, desktopViewport.w) + coverOverscanPx) : Math.ceil(desktopCropCover.baseW);
  const desktopCoverH = desktopViewport.h ? Math.ceil(Math.max(desktopCropCover.baseH, desktopViewport.h) + coverOverscanPx) : Math.ceil(desktopCropCover.baseH);
  const mobileScaledCoverW = Math.ceil(mobileCropCover.baseW * mobileCropNorm.scale + coverOverscanPx);
  const mobileScaledCoverH = Math.ceil(mobileCropCover.baseH * mobileCropNorm.scale + coverOverscanPx);
  const desktopScaledCoverW = Math.ceil(desktopCropCover.baseW * desktopCropNorm.scale + coverOverscanPx);
  const desktopScaledCoverH = Math.ceil(desktopCropCover.baseH * desktopCropNorm.scale + coverOverscanPx);
  const mobileBgLeft = mobileViewport.w ? (mobileViewport.w - mobileScaledCoverW) / 2 + mobileCropNorm.x : 0;
  const mobileBgTop = mobileViewport.h ? (mobileViewport.h - mobileScaledCoverH) / 2 + mobileCropNorm.y : 0;
  const desktopBgLeft = desktopViewport.w ? (desktopViewport.w - desktopScaledCoverW) / 2 + desktopCropNorm.x : 0;
  const desktopBgTop = desktopViewport.h ? (desktopViewport.h - desktopScaledCoverH) / 2 + desktopCropNorm.y : 0;
  const miniMapSize = 64;
  const mobileMiniMap = getCropMiniMapFor(mobileCropNorm, mobileViewport.w, mobileViewport.h, miniMapSize);
  const desktopMiniMap = getCropMiniMapFor(desktopCropNorm, desktopViewport.w, desktopViewport.h, miniMapSize);
  const pickerPortal =
    typeof document !== "undefined" && isPickerMode
      ? createPortal(
          <>
            {mousePos && (
              <div
                className="fixed pointer-events-none z-[9999] transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${mousePos.x}px`, top: `${mousePos.y}px` }}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-white shadow-2xl" style={{ backgroundColor: hoverColor }} />
                  <div className="absolute -top-1 -right-1 bg-white px-1.5 py-0.5 rounded text-[8px] font-mono font-bold shadow-lg">
                    {hoverColor.toUpperCase()}
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-inner" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-6 bg-white -rotate-45 origin-center" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rotate-45 origin-center" />
                </div>
              </div>
            )}
          </>,
          document.body
        )
      : null;

  const modeHintsPortal =
    typeof document !== "undefined" && (isCropMode || isRangeMode || isPickerMode)
      ? createPortal(
          <div className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-[9999] pointer-events-none lg:hidden flex justify-center pt-1">
            <div className="bg-white/90 backdrop-blur-md text-gray-800 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg flex items-center gap-2 border border-gray-200/50">
              {isCropMode ? (
                <>
                  <Scissors className="w-3.5 h-3.5 text-amber-600" />
                  <span>裁剪模式</span>
                </>
              ) : isRangeMode ? (
                <>
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  <span>色彩范围</span>
                </>
              ) : (
                <>
                  <Pipette className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isPickerMode === "bg" ? "拾取背景色" : "拾取文字色"}</span>
                  <span className="font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">{hoverColor.toUpperCase()}</span>
                </>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={editorRootRef}
      className="cm-editor grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[1fr_auto] gap-3 lg:gap-x-8 lg:gap-y-6 items-start lg:items-stretch w-full"
    >
      {pickerPortal}
      {modeHintsPortal}
      {!image && (
        <div className="col-span-12 flex justify-center">
          <div className="cm-empty-state bg-[color:var(--cm-surface)] p-6 lg:p-10 rounded-2xl border border-[color:var(--cm-border)] flex flex-col items-center justify-center gap-4 w-full aspect-square lg:w-[70vw] lg:max-w-[700px] lg:aspect-[unset] lg:h-[70vh] lg:max-h-[700px]">
          <div className="flex flex-col items-center gap-4 text-[color:var(--cm-ink-2)]">
            <div className="w-16 h-16 rounded-2xl bg-[color:var(--cm-surface)] flex items-center justify-center border border-[color:var(--cm-border)] shadow-sm">
              <Upload className="w-7 h-7 text-[color:var(--cm-brass)]" />
            </div>
            <div className="text-sm font-semibold text-[color:var(--cm-ink)]">上传照片开始制作</div>
          </div>
          <div className="w-full max-w-[420px]">
            <label className="cm-upload-btn">
              <span className="inline-flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                上传照片
              </span>
              <input type="file" accept="image/*,video/*,.heic,.heif,.avci,.avcs" onChange={handleFileUpload} className="sr-only" />
            </label>
          </div>
        </div>
        </div>
      )}
      {image && (
        <>
        <div className="cm-mobile-stage lg:hidden fixed inset-0 z-[60] flex flex-col">
                  <div
                    ref={mobileScrollRef}
                    className="flex-1 overflow-y-auto overscroll-contain"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    <div className="px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+104px)] flex flex-col items-center gap-2">
                      <div className="w-[92vw] max-w-[420px] h-6" /> {/* 固定占位空间 */}
                      <div
                        ref={mobilePreviewRef}
                        className="cm-preview-shell relative w-[92vw] max-w-[420px] sm:max-w-[430px] mx-auto flex justify-center bg-[color:var(--cm-surface)] p-2 sm:p-3 rounded-2xl border border-[color:var(--cm-border)] items-center"
                        style={{ minHeight: "50svh" }}
                      >
                        <div
                          ref={mobilePreviewCardRef}
                          className="cm-output-card relative h-[50svh] max-h-[520px] aspect-[3/4] rounded-lg overflow-hidden bg-[color:var(--cm-surface)] grid"
                          style={
                            isPortrait
                              ? { gridTemplateColumns: `${portraitStripPct}% 1fr`, touchAction: isRangeMode && !isCropMode && !isPickerMode ? "none" : undefined }
                              : { gridTemplateRows: `${landscapeStripPct}% 1fr`, touchAction: isRangeMode && !isCropMode && !isPickerMode ? "none" : undefined }
                          }
                        >
                          <div
                            ref={mobileStripRef}
                            className="relative flex items-center justify-center min-w-0 min-h-0"
                            style={{ backgroundColor: selectedColor }}
                          >
                            <div
                              className={cn(
                                "text-center px-4 transition-colors duration-200",
                                isPortrait
                                  ? "rotate-90 whitespace-nowrap"
                                  : undefined
                              )}
                              style={{
                                color: textColor,
                                fontFamily: FONT_OPTIONS[selectedFontIndex].cssVar,
                                fontStyle: FONT_OPTIONS[selectedFontIndex].style,
                                fontWeight: FONT_OPTIONS[selectedFontIndex].weight,
                                fontSize: `${mobilePreviewFontPx}px`,
                                letterSpacing: `${isPortrait ? (previewTextIsLong ? 0.12 : 0.18) : (previewTextIsLong ? 0.1 : 0.16)}em`,
                              }}
                            >
                              {previewTextLine}
                            </div>
                          </div>

                          <div
                            ref={mobileCropViewportRef}
                            className={cn(
                              "relative overflow-hidden bg-zinc-50 flex items-center justify-center w-full h-full touch-pan-y min-w-0 min-h-0",
                              isPickerMode && "touch-none",
                              isCropMode && "touch-none",
                              isCropMode && (isCropDragging ? "cursor-grabbing" : "cursor-grab"),
                              isPortrait ? "h-full" : "w-full"
                            )}
                            style={{ touchAction: isCropMode ? "none" : undefined }}
                            onPointerDown={handleCropPointerDown}
                            onPointerMove={handleCropPointerMove}
                            onPointerUp={handleCropPointerEnd}
                            onPointerCancel={handleCropPointerEnd}
                            onWheel={handleCropWheel}
                          >
                            {isCropMode ? (
                              <>
                                <div className="absolute inset-0">
                                  <div
                                    className="absolute inset-0"
                                    style={
                                      mobileViewport.w && mobileViewport.h
                                        ? {
                                            backgroundImage: `url(${image || FALLBACK_PIXEL})`,
                                            backgroundRepeat: "no-repeat",
                                            backgroundSize: `${mobileScaledCoverW}px ${mobileScaledCoverH}px`,
                                            backgroundPosition: `${mobileBgLeft}px ${mobileBgTop}px`,
                                            transition: isCropDragging ? "none" : "background-position 0.12s ease-out, background-size 0.12s ease-out",
                                          }
                                        : {
                                            backgroundImage: `url(${image || FALLBACK_PIXEL})`,
                                            backgroundRepeat: "no-repeat",
                                            backgroundSize: "cover",
                                            backgroundPosition: "center",
                                          }
                                    }
                                  />
                                  <img
                                    ref={mobileImgRef}
                                    src={image || FALLBACK_PIXEL}
                                    alt="Uploaded"
                                    draggable={false}
                                    className="absolute inset-0 w-full h-full opacity-0 pointer-events-none select-none"
                                    onLoad={onImageLoad}
                                    onError={() => {
                                      setIsProcessing(false);
                                    }}
                                  />
                                </div>
                                <div className="pointer-events-none absolute inset-0 z-10">
                                  <div className="absolute inset-0 border-[3px] border-white/95 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.22),inset_0_0_28px_rgba(0,0,0,0.32)]" />
                                  <div className="absolute top-[33.33%] bottom-[33.33%] left-0 right-0 border-y-2 border-white/45" />
                                  <div className="absolute left-[33.33%] right-[33.33%] top-0 bottom-0 border-x-2 border-white/45" />
                                  <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-white/95" />
                                  <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-white/95" />
                                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-white/95" />
                                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-white/95" />
                                </div>
                              </>
                            ) : (
                              <div className="absolute inset-0">
                                <div
                                  className="absolute inset-0"
                                  style={
                                    mobileViewport.w && mobileViewport.h
                                      ? {
                                          backgroundImage: `url(${image || FALLBACK_PIXEL})`,
                                          backgroundRepeat: "no-repeat",
                                          backgroundSize: `${mobileScaledCoverW}px ${mobileScaledCoverH}px`,
                                          backgroundPosition: `${mobileBgLeft}px ${mobileBgTop}px`,
                                          transition: "background-position 0.12s ease-out, background-size 0.12s ease-out",
                                        }
                                      : {
                                          backgroundImage: `url(${image || FALLBACK_PIXEL})`,
                                          backgroundRepeat: "no-repeat",
                                          backgroundSize: "cover",
                                          backgroundPosition: "center",
                                        }
                                  }
                                />
                                <img
                                  ref={mobileImgRef}
                                  src={image || FALLBACK_PIXEL}
                                  alt="Uploaded"
                                  draggable={false}
                                  className={cn(
                                    "absolute inset-0 w-full h-full opacity-0 select-none",
                                    isPickerMode ? "cursor-none touch-none" : "pointer-events-none"
                                  )}
                                  style={isPickerMode ? { touchAction: "none" } : undefined}
                                  onLoad={onImageLoad}
                                  onError={() => {
                                    setIsProcessing(false);
                                  }}
                                  onPointerDown={(e) => {
                                    if (!isPickerMode) return;
                                    if (isCropMode) return;
                                    if (e.pointerType === "touch") return;
                                    try {
                                      e.preventDefault();
                                    } catch {}
                                    handlePickerStartAtClientPoint(e.clientX, e.clientY);
                                  }}
                                  onPointerMove={(e) => {
                                    if (!isPickerMode) return;
                                    if (isCropMode) return;
                                    if (e.pointerType === "touch") return;
                                    handlePickerMoveAtClientPoint(e.clientX, e.clientY);
                                  }}
                                  onPointerUp={(e) => {
                                    if (!isPickerMode) return;
                                    if (isCropMode) return;
                                    if (e.pointerType === "touch") return;
                                    try {
                                      e.preventDefault();
                                    } catch {}
                                    handlePickerPickAtClientPoint(e.clientX, e.clientY);
                                  }}
                                  onPointerLeave={() => setMousePos(null)}
                                  onTouchStart={(e) => {
                                    if (!isPickerMode) return;
                                    if (isCropMode) return;
                                    const t = e.touches && e.touches[0] ? e.touches[0] : null;
                                    if (!t) return;
                                    try {
                                      e.preventDefault();
                                    } catch {}
                                    handlePickerStartAtClientPoint(t.clientX, t.clientY);
                                  }}
                                  onTouchMove={(e) => {
                                    if (!isPickerMode) return;
                                    if (isCropMode) return;
                                    const t = e.touches && e.touches[0] ? e.touches[0] : null;
                                    if (!t) return;
                                    try {
                                      e.preventDefault();
                                    } catch {}
                                    handlePickerMoveAtClientPoint(t.clientX, t.clientY);
                                  }}
                                  onTouchEnd={(e) => {
                                    if (!isPickerMode) return;
                                    if (isCropMode) return;
                                    try {
                                      e.preventDefault();
                                    } catch {}
                                    const p = pickerPointRef.current || mousePos;
                                    if (p) handlePickerPickAtClientPoint(p.x, p.y);
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          {image && isRangeMode && !isCropMode && !isPickerMode && (
                            <div className="absolute inset-0 z-30 pointer-events-none">
                              <div
                                className={cn("absolute", isPortrait ? "top-0 bottom-0" : "left-0 right-0")}
                                style={
                                  isPortrait
                                    ? { left: mobileStripEdgePx !== null ? `${mobileStripEdgePx}px` : `${portraitStripPct}%` }
                                    : { top: mobileStripEdgePx !== null ? `${mobileStripEdgePx}px` : `${landscapeStripPct}%` }
                                }
                              >
                                <div
                                  className={cn(
                                    "absolute bg-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.22)]",
                                    isPortrait
                                      ? "left-0 top-0 bottom-0 w-[3px]"
                                      : "top-0 left-0 right-0 h-[3px]"
                                  )}
                                  style={isPortrait ? { transform: "translateX(-1.5px)" } : { transform: "translateY(-1.5px)" }}
                                />
                                <div
                                  className={cn(
                                    "absolute w-10 h-10 rounded-full bg-white/80 border border-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur pointer-events-auto flex items-center justify-center",
                                    isStripDragging && "ring-2 ring-[color:var(--cm-brass)]",
                                    isPortrait
                                      ? "left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 cursor-col-resize"
                                      : "top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 cursor-row-resize"
                                  )}
                                  style={{ touchAction: "none" }}
                                  onPointerDown={handleStripPointerDown(isPortrait ? "portrait" : "landscape")}
                                  onPointerMove={handleStripPointerMove}
                                  onPointerUp={handleStripPointerEnd}
                                  onPointerCancel={handleStripPointerEnd}
                                >
                                  {isPortrait ? (
                                    <ArrowLeftRight className="w-5 h-5 text-[color:var(--cm-ink-2)] opacity-70" />
                                  ) : (
                                    <ArrowUpDown className="w-5 h-5 text-[color:var(--cm-ink-2)] opacity-70" />
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          {isCropMode && mobileMiniMap && (
                            <div
                              className="pointer-events-none absolute right-2 bottom-2 z-30 rounded-xl overflow-hidden border border-white/70 shadow-lg bg-black/15"
                              style={{ width: `${miniMapSize}px`, height: `${miniMapSize}px` }}
                            >
                              <img src={image || FALLBACK_PIXEL} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain" />
                              <div
                                className="absolute rounded-md border-2 border-white/90 shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                                style={{
                                  left: `${mobileMiniMap.frameX}px`,
                                  top: `${mobileMiniMap.frameY}px`,
                                  width: `${mobileMiniMap.frameW}px`,
                                  height: `${mobileMiniMap.frameH}px`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        ref={mobileControlsRef}
                        className="cm-controls-panel bg-[color:var(--cm-surface)] w-[92vw] max-w-[420px] sm:max-w-[430px] mt-0.5 rounded-2xl border border-[color:var(--cm-border)] p-4 space-y-3"
                      >
                        <div className="cm-tabbar flex rounded-xl p-0.5 gap-1">
                          <button
                            onClick={() => {
                              cropModeWantedRef.current = false;
                              setIsCropMode(false);
                              setMobileTab("presets");
                            }}
                            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all text-[color:var(--cm-ink-2)] relative"
                          >
                            <span className={mobileTab === "presets" ? "text-[color:var(--cm-ink)]" : ""}>配色</span>
                            <div
                              className={cn(
                                "absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-[color:var(--cm-brass)] transition-all duration-200",
                                mobileTab === "presets" ? "w-6 opacity-100" : "w-0 opacity-0"
                              )}
                            />
                          </button>
                          <button
                            onClick={() => {
                              cropModeWantedRef.current = false;
                              setIsCropMode(false);
                              setMobileTab("colors");
                            }}
                            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all text-[color:var(--cm-ink-2)] relative"
                          >
                            <span className={mobileTab === "colors" ? "text-[color:var(--cm-ink)]" : ""}>颜色</span>
                            <div
                              className={cn(
                                "absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-[color:var(--cm-brass)] transition-all duration-200",
                                mobileTab === "colors" ? "w-6 opacity-100" : "w-0 opacity-0"
                              )}
                            />
                          </button>
                          <button
                            onClick={() => {
                              cropModeWantedRef.current = false;
                              setIsCropMode(false);
                              setMobileTab("text");
                            }}
                            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all text-[color:var(--cm-ink-2)] relative"
                          >
                            <span className={mobileTab === "text" ? "text-[color:var(--cm-ink)]" : ""}>文字</span>
                            <div
                              className={cn(
                                "absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-[color:var(--cm-brass)] transition-all duration-200",
                                mobileTab === "text" ? "w-6 opacity-100" : "w-0 opacity-0"
                              )}
                            />
                          </button>
                          <button
                            onClick={() => {
                              if (mobileTab === "crop") {
                                cropModeWantedRef.current = false;
                                setIsCropMode(false);
                                setMobileTab("presets");
                                return;
                              }
                              setMobileTab("crop");
                              setIsPickerMode(null);
                            }}
                            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all text-[color:var(--cm-ink-2)] relative"
                          >
                            <span className={mobileTab === "crop" ? "text-[color:var(--cm-ink)]" : ""}>裁剪</span>
                            <div
                              className={cn(
                                "absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-[color:var(--cm-brass)] transition-all duration-200",
                                mobileTab === "crop" ? "w-6 opacity-100" : "w-0 opacity-0"
                              )}
                            />
                          </button>
                        </div>

                        <div className="space-y-3">
                          {mobileTab === "presets" && (
                            <div className="tab-panel space-y-2">
                            <div className="scheme-scroll flex gap-2 overflow-x-auto py-2 -mx-1 px-1">
                                {schemes
                                  .map((scheme, schemeIndex) => ({ scheme, schemeIndex }))
                                  .filter(({ scheme }) => scheme.name !== "自定义")
                                  .slice(0, 6)
                                  .map(({ scheme, schemeIndex }) => {
                                    const isSelected = selectedSchemeIndex === schemeIndex;
                                    return (
                                      <button
                                        key={`${scheme.name}-${scheme.bg}-${scheme.text}`}
                                        onClick={() => handleSelectScheme(schemeIndex)}
                                        className={cn(
                                          "flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all w-[78px] shrink-0 outline-none focus:outline-none focus-visible:outline-none",
                                          isSelected
                                            ? "bg-[color:color-mix(in_srgb,var(--cm-brass)_6%,transparent)]"
                                            : "bg-[color:var(--cm-surface)] hover:bg-[color:color-mix(in_srgb,var(--cm-brass)_8%,transparent)] active:scale-[0.99]"
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "w-full aspect-square rounded-lg shadow-inner relative flex items-center justify-center overflow-hidden border-2",
                                            isSelected ? "border-[color:var(--cm-brass)]" : "border-transparent"
                                          )}
                                          style={{ backgroundColor: scheme.bg }}
                                        >
                                          <span className="font-serif italic text-xl select-none" style={{ color: scheme.text }}>
                                            Aa
                                          </span>
                                        </div>
                                        <span className="text-xs font-medium text-[color:var(--cm-ink-2)]">{scheme.name}</span>
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>
                          )}

                    {mobileTab === "colors" && (
                      <div className="tab-panel space-y-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="grid grid-cols-[52px_52px_minmax(0,1fr)] items-center gap-2">
                              <label className="relative cursor-pointer group">
                                <div
                                  className="w-[52px] h-[52px] rounded-xl border-2 border-[color:var(--cm-border-strong)] shadow-inner overflow-hidden transition-all group-hover:border-[color:var(--cm-brass)] relative"
                                  style={{ backgroundColor: customBgColor || "#e5e5e5" }}
                                >
                                  <Palette
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-white drop-shadow-lg"
                                    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
                                  />
                                  <input
                                    type="color"
                                    value={customBgColor || "#e5e5e5"}
                                    onChange={(e) => setCustomBgColor(normalizeColor(e.target.value))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                </div>
                              </label>
                              <button
                                onClick={() => {
                                  if (isPickerMode === "bg") {
                                    setIsPickerMode(null);
                                  } else {
                                    setPickerTarget("bg");
                                    setIsPickerMode("bg");
                                  }
                                }}
                                className={cn(
                                  "w-[52px] h-[52px] rounded-xl border-2 transition-all flex items-center justify-center",
                                  isPickerMode === "bg"
                                    ? "border-transparent ring-2 ring-[color:var(--cm-brass)] bg-[color:color-mix(in_srgb,var(--cm-brass)_6%,transparent)]"
                                    : "border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                                )}
                              >
                                <Pipette className={cn("w-5 h-5", isPickerMode === "bg" ? "text-[color:var(--cm-brass)]" : "text-[color:var(--cm-ink-3)]")} />
                              </button>
                              <input
                                type="text"
                                value={customBgColor}
                                onChange={(e) => setCustomBgColor(normalizeColor(e.target.value))}
                                placeholder="#000000"
                                onFocus={handleMobileFieldFocus}
                                onBlur={handleMobileFieldBlur}
                                onKeyDown={handleMobileKeyDown}
                                className="min-w-0 w-full px-3 py-3 bg-[color:var(--cm-surface)] border-2 border-[color:var(--cm-border-strong)] rounded-xl text-base font-mono uppercase appearance-none shadow-none focus:outline-none focus:!border-transparent focus:ring-2 focus:ring-[color:var(--cm-brass)]"
                                maxLength={7}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="grid grid-cols-[52px_52px_minmax(0,1fr)] items-center gap-2">
                              <label className="relative cursor-pointer group">
                                <div
                                  className="w-[52px] h-[52px] rounded-xl border-2 border-[color:var(--cm-border-strong)] shadow-inner overflow-hidden transition-all group-hover:border-[color:var(--cm-brass)] relative"
                                  style={{ backgroundColor: customTextColor || "#171717" }}
                                >
                                  <TypeIcon
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-white drop-shadow-lg"
                                    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
                                  />
                                  <input
                                    type="color"
                                    value={customTextColor || "#171717"}
                                    onChange={(e) => setCustomTextColor(normalizeColor(e.target.value))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                </div>
                              </label>
                              <button
                                onClick={() => {
                                  if (isPickerMode === "text") {
                                    setIsPickerMode(null);
                                  } else {
                                    setPickerTarget("text");
                                    setIsPickerMode("text");
                                  }
                                }}
                                className={cn(
                                  "w-[52px] h-[52px] rounded-xl border-2 transition-all flex items-center justify-center",
                                  isPickerMode === "text"
                                    ? "border-transparent ring-2 ring-[color:var(--cm-brass)] bg-[color:color-mix(in_srgb,var(--cm-brass)_12%,transparent)]"
                                    : "border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                                )}
                              >
                                <Pipette className={cn("w-5 h-5", isPickerMode === "text" ? "text-[color:var(--cm-brass)]" : "text-[color:var(--cm-ink-3)]")} />
                              </button>
                              <input
                                type="text"
                                value={customTextColor}
                                onChange={(e) => setCustomTextColor(normalizeColor(e.target.value))}
                                placeholder="#000000"
                                onFocus={handleMobileFieldFocus}
                                onBlur={handleMobileFieldBlur}
                                onKeyDown={handleMobileKeyDown}
                                className="min-w-0 w-full px-3 py-3 bg-[color:var(--cm-surface)] border-2 border-[color:var(--cm-border-strong)] rounded-xl text-base font-mono uppercase appearance-none shadow-none focus:outline-none focus:!border-transparent focus:ring-2 focus:ring-[color:var(--cm-brass)]"
                                maxLength={7}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="text-sm font-medium text-[color:var(--cm-ink-2)]">色彩范围</div>
                              <div className={cn("text-[11px] text-[color:var(--cm-ink-3)]", !isRangeMode && "opacity-60")}>也可以在预览图上拖动分割线调整</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (isCropMode || isPickerMode) return;
                                setIsRangeMode((v) => !v);
                              }}
                              className="h-8 px-3 rounded-xl text-sm font-medium border-2 border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))] whitespace-nowrap"
                            >
                              {isRangeMode ? "完成" : "编辑"}
                            </button>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-xs text-[color:var(--cm-ink-3)]">色块占比</div>
                            <div className={cn("text-xs tabular-nums", isRangeMode ? "text-[color:var(--cm-ink-3)]" : "text-[color:var(--cm-ink-3)] opacity-60")}>
                              {Math.round(
                                clampStripRatio(
                                  isPortrait ? portraitStripRatio : landscapeStripRatio,
                                  isPortrait ? portraitStripMin : landscapeStripMin
                                ) * 100
                              )}
                              %
                            </div>
                          </div>
                          <div className={cn("flex items-center gap-3", !isRangeMode && "opacity-70")}>
                            <input
                              type="range"
                              min={isPortrait ? portraitStripMin : landscapeStripMin}
                              max={stripMax}
                              step={0.01}
                              value={clampStripRatio(
                                isPortrait ? portraitStripRatio : landscapeStripRatio,
                                isPortrait ? portraitStripMin : landscapeStripMin
                              )}
                              style={{
                                ["--cm-range-pct" as any]: `${stripRangePct(
                                  isPortrait ? portraitStripRatio : landscapeStripRatio,
                                  isPortrait ? portraitStripMin : landscapeStripMin
                                )}%`,
                              }}
                              disabled={!isRangeMode}
                              onChange={(e) => {
                                if (!isRangeMode) return;
                                const v = Number.parseFloat(e.target.value);
                                if (!Number.isFinite(v)) return;
                                if (isPortrait) {
                                  setPortraitStripRatio(clampStripRatio(v, portraitStripMin));
                                  return;
                                }
                                setLandscapeStripRatio(clampStripRatio(v, landscapeStripMin));
                              }}
                              className="cm-slider w-full"
                            />
                            <button
                              type="button"
                              disabled={!isRangeMode}
                              onClick={() => {
                                if (!isRangeMode) return;
                                setPortraitStripRatio(portraitStripMin);
                                setLandscapeStripRatio(landscapeStripDefault);
                              }}
                              className={cn(
                                "h-9 px-3 rounded-xl text-sm font-medium border-2 bg-[color:var(--cm-surface)] whitespace-nowrap",
                                isRangeMode
                                  ? "border-[color:var(--cm-border-strong)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                                  : "border-[color:var(--cm-border)] text-[color:var(--cm-ink-3)] cursor-not-allowed"
                              )}
                            >
                              重置
                            </button>
                          </div>
                        </div>

                      </div>
                    )}

                    {mobileTab === "text" && (
                      <div className="tab-panel space-y-4">
                        <div className="grid grid-cols-5 gap-2">
                          {FONT_OPTIONS.map((font, index) => (
                            <button
                              key={font.value}
                              onClick={() => setSelectedFontIndex(index)}
                              className={cn(
                                "py-2 px-1 rounded-lg text-sm font-medium transition-all border-2",
                                selectedFontIndex === index
                                  ? "border-transparent ring-2 ring-[color:var(--cm-brass)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink)]"
                                  : "border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                              )}
                              style={{ fontFamily: font.cssVar, fontStyle: font.style, fontWeight: font.weight }}
                            >
                              {font.name}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-[color:var(--cm-ink-2)]">字号</div>
                            <div className="text-xs text-[color:var(--cm-ink-3)] tabular-nums">{Math.round(textScale * 100)}%</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={0.7}
                              max={1.8}
                              step={0.05}
                              value={textScale}
                              style={{ ["--cm-range-pct" as any]: `${textScalePct}%` }}
                              onChange={(e) => {
                                const v = Number.parseFloat(e.target.value);
                                if (Number.isFinite(v)) setTextScale(v);
                              }}
                              className="cm-slider w-full"
                            />
                            <button
                              type="button"
                              onClick={() => setTextScale(1)}
                              className="h-9 px-3 rounded-xl text-sm font-medium border-2 border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))] whitespace-nowrap"
                            >
                              重置
                            </button>
                          </div>
                        </div>

                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[color:var(--cm-ink-3)]" />
                          <input
                            type="text"
                            value={location}
                            onChange={(e) => {
                              locationManuallyEditedRef.current = true;
                              setLocation(e.target.value);
                            }}
                            placeholder="输入地点，如：上海外滩"
                            onFocus={handleMobileFieldFocus}
                            onBlur={handleMobileFieldBlur}
                            onKeyDown={handleMobileKeyDown}
                            className="w-full pl-12 pr-10 py-4 bg-[color:var(--cm-surface)] border-2 border-[color:var(--cm-border-strong)] rounded-xl text-base appearance-none shadow-none focus:outline-none focus:!border-transparent focus:ring-2 focus:ring-[color:var(--cm-brass)]"
                          />
                          {location.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                locationManuallyEditedRef.current = true;
                                setLocation("");
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[color:var(--cm-surface-2)] text-[color:var(--cm-ink-2)] flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[color:var(--cm-ink-3)]" />
                          <input
                            type="text"
                            value={date}
                            onChange={(e) => {
                              dateManuallyEditedRef.current = true;
                              setDate(e.target.value);
                            }}
                            placeholder="输入时间，如：2024.03.15"
                            onFocus={handleMobileFieldFocus}
                            onBlur={handleMobileFieldBlur}
                            onKeyDown={handleMobileKeyDown}
                            className="w-full pl-12 pr-10 py-4 bg-[color:var(--cm-surface)] border-2 border-[color:var(--cm-border-strong)] rounded-xl text-base appearance-none shadow-none focus:outline-none focus:!border-transparent focus:ring-2 focus:ring-[color:var(--cm-brass)]"
                          />
                          {date.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                dateManuallyEditedRef.current = true;
                                setDate("");
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[color:var(--cm-surface-2)] text-[color:var(--cm-ink-2)] flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {mobileTab === "crop" && (
                      <div className="tab-panel space-y-3">
                        <div className="px-4 py-3 bg-[color:color-mix(in_srgb,var(--cm-brass)_10%,transparent)] border border-[color:color-mix(in_srgb,var(--cm-brass)_40%,var(--cm-border))] rounded-xl">
                          <p className="text-xs text-[color:var(--cm-ink-2)] text-center">在预览图片上拖动/双指缩放调整展示区域</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setCrop(DEFAULT_CROP)}
                            className={cn(
                              "h-11 px-4 rounded-xl text-sm font-medium border-2 bg-[color:var(--cm-surface)]",
                              crop.x !== DEFAULT_CROP.x || crop.y !== DEFAULT_CROP.y || crop.scale !== DEFAULT_CROP.scale
                                ? "border-[color:var(--cm-border-strong)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                                : "border-[color:var(--cm-border)] text-[color:var(--cm-ink-3)] cursor-not-allowed"
                            )}
                          >
                            重置
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isCropMode) {
                                cropModeWantedRef.current = false;
                                setIsCropMode(false);
                                setMobileTab("presets");
                              } else {
                                setIsPickerMode(null);
                                cropModeWantedRef.current = true;
                                setIsCropMode(true);
                              }
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                            }}
                            className="h-11 px-4 rounded-xl text-sm font-medium border-2 border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] active:bg-[color:var(--cm-surface-2)] touch-handling"
                          >
                            {isCropMode ? "退出裁剪" : "进入裁剪"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

              <div
                className="cm-mobile-actions fixed left-0 right-0 bottom-0 z-[110] bg-[color:var(--cm-surface)] border-t border-[color:var(--cm-border)]"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                <div className="mx-auto w-full max-w-[430px] px-4 py-3 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="cm-upload-btn h-12">
                      <span className="inline-flex items-center justify-center gap-2">
                        <Upload className="w-5 h-5" />
                        上传照片
                      </span>
                      <input type="file" accept="image/*,video/*,.heic,.heif,.avci,.avcs" onChange={handleFileUpload} className="sr-only" />
                    </label>
                    <button
                      onClick={downloadImage}
                      className="cm-upload-btn"
                    >
                      <Download className="w-5 h-5" />
                      导出成品
                    </button>
                  </div>
                </div>
              </div>
            </div>

          <div className="hidden lg:flex lg:col-span-7 lg:col-start-1 lg:row-span-2 lg:sticky lg:top-3">
                <div className="w-full h-full">
                  <div className="cm-preview-panel bg-[color:var(--cm-surface)] p-5 rounded-2xl border border-[color:var(--cm-border)] h-full flex flex-col">
                    <div
                      className="flex-1 flex items-center justify-center relative"
                    >
                      <div
                        className="cm-output-card relative w-full max-w-[572px] aspect-[3/4] rounded-lg overflow-hidden bg-[color:var(--cm-surface)] mx-auto grid"
                        style={
                          isPortrait
                            ? { gridTemplateColumns: `${portraitStripPct}% 1fr`, touchAction: isRangeMode && !isCropMode && !isPickerMode ? "none" : undefined }
                            : { gridTemplateRows: `${landscapeStripPct}% 1fr`, touchAction: isRangeMode && !isCropMode && !isPickerMode ? "none" : undefined }
                        }
                        ref={desktopPreviewCardRef}
                      >
                      {(isCropMode || isRangeMode || isPickerMode) && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 hidden lg:flex items-center gap-2 bg-white/90 backdrop-blur-md text-gray-800 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg border border-gray-200/50">
                          {isCropMode ? (
                            <>
                              <Scissors className="w-3.5 h-3.5 text-amber-600" />
                              <span>裁剪模式</span>
                            </>
                          ) : isRangeMode ? (
                            <>
                              <Sliders className="w-3.5 h-3.5 text-amber-600" />
                              <span>色彩范围</span>
                            </>
                          ) : (
                            <>
                              <Pipette className="w-3.5 h-3.5 text-amber-600" />
                              <span>{isPickerMode === "bg" ? "拾取背景色" : "拾取文字色"}</span>
                              <span className="font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">{hoverColor.toUpperCase()}</span>
                            </>
                          )}
                        </div>
                      )}
                      <div
                        ref={desktopStripRef}
                        className={cn(
                          "relative flex items-center justify-center min-w-0 min-h-0",
                          isPortrait ? "h-full" : "w-full"
                        )}
                        style={{ backgroundColor: selectedColor }}
                      >
                        <div
                          className={cn(
                            "text-center px-4 transition-colors duration-200",
                            isPortrait
                              ? "rotate-90 whitespace-nowrap"
                              : undefined
                          )}
                          style={{
                            color: textColor,
                            fontFamily: FONT_OPTIONS[selectedFontIndex].cssVar,
                            fontStyle: FONT_OPTIONS[selectedFontIndex].style,
                            fontWeight: FONT_OPTIONS[selectedFontIndex].weight,
                            fontSize: `${desktopPreviewFontPx}px`,
                            letterSpacing: `${isPortrait ? (previewTextIsLong ? 0.12 : 0.18) : (previewTextIsLong ? 0.1 : 0.16)}em`,
                          }}
                        >
                          {previewTextLine}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "relative overflow-hidden bg-[color:var(--cm-paper)] flex items-center justify-center min-w-0 min-h-0",
                          isCropMode && (isCropDragging ? "cursor-grabbing" : "cursor-grab"),
                          isPortrait ? "h-full" : "w-full"
                        )}
                        ref={desktopCropViewportRef}
                        style={{ touchAction: isCropMode ? "none" : undefined }}
                        onPointerDown={handleCropPointerDown}
                        onPointerMove={handleCropPointerMove}
                        onPointerUp={handleCropPointerEnd}
                        onPointerCancel={handleCropPointerEnd}
                        onWheel={handleCropWheel}
                      >
                        {isCropMode ? (
                        <>
                          <div className="absolute inset-0">
                            <div
                              className="absolute inset-0"
                              style={
                                desktopViewport.w && desktopViewport.h
                                  ? {
                                      backgroundImage: `url(${image || FALLBACK_PIXEL})`,
                                      backgroundRepeat: "no-repeat",
                                      backgroundSize: `${desktopScaledCoverW}px ${desktopScaledCoverH}px`,
                                      backgroundPosition: `${desktopBgLeft}px ${desktopBgTop}px`,
                                      transition: isCropDragging ? "none" : "background-position 0.12s ease-out, background-size 0.12s ease-out",
                                    }
                                  : {
                                      backgroundImage: `url(${image || FALLBACK_PIXEL})`,
                                      backgroundRepeat: "no-repeat",
                                      backgroundSize: "cover",
                                      backgroundPosition: "center",
                                    }
                              }
                            />
                            <img
                              ref={desktopImgRef}
                              src={image || FALLBACK_PIXEL}
                              alt="Uploaded"
                              draggable={false}
                              className="absolute inset-0 w-full h-full opacity-0 pointer-events-none select-none"
                              onLoad={onImageLoad}
                              onError={() => {
                                setIsProcessing(false);
                              }}
                            />
                          </div>
                          <div className="pointer-events-none absolute inset-0 z-10">
                            <div className="absolute inset-0 border-[3px] border-white/95 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.22),inset_0_0_28px_rgba(0,0,0,0.32)]" />
                            <div className="absolute top-[33.33%] bottom-[33.33%] left-0 right-0 border-y-2 border-white/45" />
                            <div className="absolute left-[33.33%] right-[33.33%] top-0 bottom-0 border-x-2 border-white/45" />
                            <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-white/95" />
                            <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-white/95" />
                            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-white/95" />
                            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-white/95" />
                          </div>
                        </>
                        ) : (
                          <div className="absolute inset-0">
                            <div
                              className="absolute inset-0"
                              style={
                                desktopViewport.w && desktopViewport.h
                                  ? {
                                      backgroundImage: `url(${image || FALLBACK_PIXEL})`,
                                      backgroundRepeat: "no-repeat",
                                      backgroundSize: `${desktopScaledCoverW}px ${desktopScaledCoverH}px`,
                                      backgroundPosition: `${desktopBgLeft}px ${desktopBgTop}px`,
                                      transition: "background-position 0.12s ease-out, background-size 0.12s ease-out",
                                    }
                                  : {
                                      backgroundImage: `url(${image || FALLBACK_PIXEL})`,
                                      backgroundRepeat: "no-repeat",
                                      backgroundSize: "cover",
                                      backgroundPosition: "center",
                                    }
                              }
                            />
                            <img
                              ref={desktopImgRef}
                              src={image || FALLBACK_PIXEL}
                              alt="Uploaded"
                              draggable={false}
                              className={cn(
                                "absolute inset-0 w-full h-full opacity-0 select-none",
                                isPickerMode ? "cursor-none touch-none" : "pointer-events-none"
                              )}
                              style={isPickerMode ? { touchAction: "none" } : undefined}
                              onLoad={onImageLoad}
                              onError={() => {
                                setIsProcessing(false);
                              }}
                              onPointerDown={(e) => {
                                if (!isPickerMode) return;
                                if (isCropMode) return;
                                if (e.pointerType === "touch") return;
                                try {
                                  e.preventDefault();
                                } catch {}
                                handlePickerStartAtClientPoint(e.clientX, e.clientY);
                              }}
                              onPointerMove={(e) => {
                                if (!isPickerMode) return;
                                if (isCropMode) return;
                                if (e.pointerType === "touch") return;
                                handlePickerMoveAtClientPoint(e.clientX, e.clientY);
                              }}
                              onPointerUp={(e) => {
                                if (!isPickerMode) return;
                                if (isCropMode) return;
                                if (e.pointerType === "touch") return;
                                try {
                                  e.preventDefault();
                                } catch {}
                                handlePickerPickAtClientPoint(e.clientX, e.clientY);
                              }}
                              onPointerLeave={() => setMousePos(null)}
                              onTouchStart={(e) => {
                                if (!isPickerMode) return;
                                if (isCropMode) return;
                                const t = e.touches && e.touches[0] ? e.touches[0] : null;
                                if (!t) return;
                                try {
                                  e.preventDefault();
                                } catch {}
                                handlePickerStartAtClientPoint(t.clientX, t.clientY);
                              }}
                              onTouchMove={(e) => {
                                if (!isPickerMode) return;
                                if (isCropMode) return;
                                const t = e.touches && e.touches[0] ? e.touches[0] : null;
                                if (!t) return;
                                try {
                                  e.preventDefault();
                                } catch {}
                                handlePickerMoveAtClientPoint(t.clientX, t.clientY);
                              }}
                              onTouchEnd={(e) => {
                                if (!isPickerMode) return;
                                if (isCropMode) return;
                                try {
                                  e.preventDefault();
                                } catch {}
                                const p = pickerPointRef.current || mousePos;
                                if (p) handlePickerPickAtClientPoint(p.x, p.y);
                              }}
                            />
                          </div>
                        )}
                      </div>
                      {image && isRangeMode && !isCropMode && !isPickerMode && (
                        <div className="absolute inset-0 z-20 pointer-events-none">
                          <div
                            className={cn("absolute", isPortrait ? "top-0 bottom-0" : "left-0 right-0")}
                            style={
                              isPortrait
                                ? { left: desktopStripEdgePx !== null ? `${desktopStripEdgePx}px` : `${portraitStripPct}%` }
                                : { top: desktopStripEdgePx !== null ? `${desktopStripEdgePx}px` : `${landscapeStripPct}%` }
                            }
                          >
                            <div className={cn("absolute bg-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.22)]", isPortrait ? "left-0 -translate-x-1/2 top-0 bottom-0 w-[3px]" : "top-0 -translate-y-1/2 left-0 right-0 h-[3px]")} />
                            <div
                              className={cn(
                                "absolute w-10 h-10 rounded-full bg-white/80 border border-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur pointer-events-auto flex items-center justify-center",
                                isStripDragging && "ring-2 ring-[color:var(--cm-brass)]",
                                isPortrait
                                  ? "left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 cursor-col-resize"
                                  : "top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 cursor-row-resize"
                              )}
                              style={{ touchAction: "none" }}
                              onPointerDown={handleStripPointerDown(isPortrait ? "portrait" : "landscape")}
                              onPointerMove={handleStripPointerMove}
                              onPointerUp={handleStripPointerEnd}
                              onPointerCancel={handleStripPointerEnd}
                            >
                              {isPortrait ? (
                                <ArrowLeftRight className="w-5 h-5 text-[color:var(--cm-ink-2)] opacity-70" />
                              ) : (
                                <ArrowUpDown className="w-5 h-5 text-[color:var(--cm-ink-2)] opacity-70" />
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {isCropMode && desktopMiniMap && (
                        <div
                          className="pointer-events-none absolute right-2 bottom-2 z-30 rounded-xl overflow-hidden border border-white/70 shadow-lg bg-black/15"
                          style={{ width: `${miniMapSize}px`, height: `${miniMapSize}px` }}
                        >
                          <img src={image || FALLBACK_PIXEL} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain" />
                          <div
                            className="absolute rounded-md border-2 border-white/90 shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                            style={{
                              left: `${desktopMiniMap.frameX}px`,
                              top: `${desktopMiniMap.frameY}px`,
                              width: `${desktopMiniMap.frameW}px`,
                              height: `${desktopMiniMap.frameH}px`,
                            }}
                          />
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                </div>
          </div>

          <div className="hidden lg:flex lg:col-span-5 lg:col-start-8 lg:row-start-1 flex flex-col gap-6 h-full">
            <div className="cm-controls-panel bg-[color:var(--cm-surface)] p-4 lg:p-5 rounded-2xl border border-[color:var(--cm-border)] flex flex-col gap-4 lg:gap-5 flex-1 relative">
              <label className="cm-upload-btn">
                <span className="inline-flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" />
                  上传照片
                </span>
                <input type="file" accept="image/*,video/*,.heic,.heif,.avci,.avcs" onChange={handleFileUpload} className="sr-only" />
              </label>

              <div className="space-y-5 lg:space-y-5">
                <label className="hidden lg:flex text-base font-medium text-[color:var(--cm-ink-2)] flex items-center gap-2 whitespace-nowrap">
                  <RefreshCw className={cn("w-4 h-4", isProcessing && "animate-spin")} />
                  智能方案预设
                </label>
                
                <div className="hidden lg:block">
                  <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 lg:mx-0 lg:px-0 lg:pb-0 lg:flex-nowrap lg:overflow-visible">
                    {schemes
                      .map((scheme, schemeIndex) => ({ scheme, schemeIndex }))
                      .filter(({ scheme }) => scheme.name !== "自定义")
                      .slice(0, 6)
                      .map(({ scheme, schemeIndex }) => {
                      const isSelected = selectedSchemeIndex === schemeIndex;
                      return (
                      <button
                        key={`${scheme.name}-${scheme.bg}-${scheme.text}`}
                        onClick={() => handleSelectScheme(schemeIndex)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-1 rounded-xl transition-all w-[52px] shrink-0 outline-none focus:outline-none focus-visible:outline-none",
                          isSelected
                            ? "bg-[color:color-mix(in_srgb,var(--cm-brass)_12%,transparent)]"
                            : "bg-[color:var(--cm-surface)] hover:bg-[color:color-mix(in_srgb,var(--cm-brass)_8%,transparent)] active:scale-[0.99]"
                        )}
                      >
                        <div
                          className={cn(
                            "w-full aspect-square rounded-lg shadow-inner relative flex items-center justify-center overflow-hidden border-2",
                            isSelected ? "border-[color:var(--cm-brass)]" : "border-transparent"
                          )}
                          style={{ backgroundColor: scheme.bg }}
                        >
                          <span className="font-serif italic text-xl select-none" style={{ color: scheme.text }}>Aa</span>
                        </div>
                        <span className="text-[10px] font-medium text-[color:var(--cm-ink-2)] whitespace-nowrap">{scheme.name}</span>
                      </button>
                      );
                    })}
                  </div>
                </div>
                
                <div className="cm-subpanel hidden lg:block mt-4 p-4 bg-[color:var(--cm-paper)] rounded-xl border border-[color:var(--cm-border)]">
                  <div className="text-xs font-medium text-[color:var(--cm-ink-2)] mb-3">🎨 自定义颜色</div>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] text-[color:var(--cm-ink-3)] font-medium w-12">背景色</div>
                        <label className="relative cursor-pointer group flex-shrink-0">
                          <div 
                            className="w-10 h-10 rounded-lg border-2 border-[color:var(--cm-border-strong)] shadow-inner overflow-hidden transition-all group-hover:border-[color:var(--cm-brass)] relative"
                            style={{ backgroundColor: customBgColor || '#e5e5e5' }}
                          >
                            <Palette className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white drop-shadow-lg" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
                            <input
                              type="color"
                              value={customBgColor || '#e5e5e5'}
                              onChange={(e) => setCustomBgColor(normalizeColor(e.target.value))}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div 
                              className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-md overflow-hidden z-20"
                              style={{ backgroundColor: customBgColor || '#e5e5e5' }}
                            />
                          </div>
                        </label>
                        <button
                          onClick={() => { if (isPickerMode === 'bg') { setIsPickerMode(null); } else { setPickerTarget('bg'); setIsPickerMode('bg'); } }}
                          className={cn(
                            "w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center flex-shrink-0",
                            isPickerMode === 'bg' 
                              ? "border-transparent ring-2 ring-[color:var(--cm-brass)] bg-[color:color-mix(in_srgb,var(--cm-brass)_12%,transparent)]" 
                              : "border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                          )}
                        >
                          <Pipette className={cn("w-4 h-4", isPickerMode === 'bg' ? "text-[color:var(--cm-brass)]" : "text-[color:var(--cm-ink-3)]")} />
                        </button>
                        <input
                          type="text"
                          value={customBgColor}
                          onChange={(e) => setCustomBgColor(normalizeColor(e.target.value))}
                          placeholder="#000000"
                          className="flex-1 h-10 px-3 bg-[color:var(--cm-surface)] border-2 border-[color:var(--cm-border-strong)] rounded-lg text-sm font-mono uppercase appearance-none shadow-none focus:outline-none focus:!border-transparent focus:ring-2 focus:ring-[color:var(--cm-brass)]"
                          maxLength={7}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] text-[color:var(--cm-ink-3)] font-medium w-12">文字色</div>
                        <label className="relative cursor-pointer group flex-shrink-0">
                          <div 
                            className="w-10 h-10 rounded-lg border-2 border-[color:var(--cm-border-strong)] shadow-inner overflow-hidden transition-all group-hover:border-[color:var(--cm-brass)] relative"
                            style={{ backgroundColor: customTextColor || '#171717' }}
                          >
                            <TypeIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white drop-shadow-lg" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
                            <input
                              type="color"
                              value={customTextColor || '#171717'}
                              onChange={(e) => setCustomTextColor(normalizeColor(e.target.value))}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div 
                              className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-md overflow-hidden z-20"
                              style={{ backgroundColor: customTextColor || '#171717' }}
                            />
                          </div>
                        </label>
                        <button
                          onClick={() => { if (isPickerMode === 'text') { setIsPickerMode(null); } else { setPickerTarget('text'); setIsPickerMode('text'); } }}
                          className={cn(
                            "w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center flex-shrink-0",
                            isPickerMode === 'text' 
                              ? "border-transparent ring-2 ring-[color:var(--cm-brass)] bg-[color:color-mix(in_srgb,var(--cm-brass)_12%,transparent)]" 
                              : "border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                          )}
                        >
                          <Pipette className={cn("w-4 h-4", isPickerMode === 'text' ? "text-[color:var(--cm-brass)]" : "text-[color:var(--cm-ink-3)]")} />
                        </button>
                        <input
                          type="text"
                          value={customTextColor}
                          onChange={(e) => setCustomTextColor(normalizeColor(e.target.value))}
                          placeholder="#000000"
                          className="flex-1 h-10 px-3 bg-[color:var(--cm-surface)] border-2 border-[color:var(--cm-border-strong)] rounded-lg text-sm font-mono uppercase appearance-none shadow-none focus:outline-none focus:!border-transparent focus:ring-2 focus:ring-[color:var(--cm-brass)]"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={cn("mt-4 space-y-2", isRangeMode && "relative z-50")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium text-[color:var(--cm-ink-2)]">色彩范围</div>
                        <div className={cn("text-[10px] text-[color:var(--cm-ink-3)]", !isRangeMode && "opacity-60")}>也可以在预览图上拖动分割线调整</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (isCropMode || isPickerMode) return;
                          setIsRangeMode((v) => !v);
                        }}
                        className="h-7 px-3 rounded-lg text-xs font-medium border-2 border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))] whitespace-nowrap"
                      >
                        {isRangeMode ? "完成" : "编辑"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-[color:var(--cm-ink-3)]">色块占比</div>
                      <div className={cn("text-[10px] tabular-nums", isRangeMode ? "text-[color:var(--cm-ink-3)]" : "text-[color:var(--cm-ink-3)] opacity-60")}>
                        {Math.round(
                          clampStripRatio(
                            isPortrait ? portraitStripRatio : landscapeStripRatio,
                            isPortrait ? portraitStripMin : landscapeStripMin
                          ) * 100
                        )}
                        %
                      </div>
                    </div>
                    <div className={cn("flex items-center gap-3", !isRangeMode && "opacity-70")}>
                      <input
                        type="range"
                        min={isPortrait ? portraitStripMin : landscapeStripMin}
                        max={stripMax}
                        step={0.01}
                        value={clampStripRatio(
                          isPortrait ? portraitStripRatio : landscapeStripRatio,
                          isPortrait ? portraitStripMin : landscapeStripMin
                        )}
                        style={{
                          ["--cm-range-pct" as any]: `${stripRangePct(
                            isPortrait ? portraitStripRatio : landscapeStripRatio,
                            isPortrait ? portraitStripMin : landscapeStripMin
                          )}%`,
                        }}
                        disabled={!isRangeMode}
                        onChange={(e) => {
                          if (!isRangeMode) return;
                          const v = Number.parseFloat(e.target.value);
                          if (!Number.isFinite(v)) return;
                          if (isPortrait) {
                            setPortraitStripRatio(clampStripRatio(v, portraitStripMin));
                            return;
                          }
                          setLandscapeStripRatio(clampStripRatio(v, landscapeStripMin));
                        }}
                        className="cm-slider w-full"
                      />
                      <button
                        type="button"
                        disabled={!isRangeMode}
                        onClick={() => {
                          if (!isRangeMode) return;
                          setPortraitStripRatio(portraitStripMin);
                          setLandscapeStripRatio(landscapeStripDefault);
                        }}
                        className={cn(
                          "h-8 px-3 rounded-lg text-xs font-medium border-2 bg-[color:var(--cm-surface)] whitespace-nowrap",
                          isRangeMode
                            ? "border-[color:var(--cm-border-strong)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                            : "border-[color:var(--cm-border)] text-[color:var(--cm-ink-3)] cursor-not-allowed"
                        )}
                      >
                        重置
                      </button>
                    </div>
                  </div>
                  
                </div>

                <div className="hidden lg:block space-y-4">
                  <div className="text-sm font-medium text-[color:var(--cm-ink-2)]">字体选择</div>
                  <div className="flex gap-2">
                    {FONT_OPTIONS.map((font, index) => (
                      <button
                        key={font.value}
                        onClick={() => setSelectedFontIndex(index)}
                        className={cn(
                          "flex-1 py-2 px-1 rounded-lg text-sm font-medium transition-all border-2",
                          selectedFontIndex === index
                            ? "border-transparent ring-2 ring-[color:var(--cm-brass)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink)]"
                                  : "border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                        )}
                        style={{ fontFamily: font.cssVar, fontStyle: font.style, fontWeight: font.weight }}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-[color:var(--cm-ink-2)]">字号</div>
                      <div className="text-[10px] text-[color:var(--cm-ink-3)] tabular-nums">{Math.round(textScale * 100)}%</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0.7}
                        max={1.8}
                        step={0.05}
                        value={textScale}
                        style={{ ["--cm-range-pct" as any]: `${textScalePct}%` }}
                        onChange={(e) => {
                          const v = Number.parseFloat(e.target.value);
                          if (Number.isFinite(v)) setTextScale(v);
                        }}
                        className="cm-slider w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setTextScale(1)}
                        className="h-8 px-3 rounded-lg text-xs font-medium border-2 border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))] whitespace-nowrap"
                      >
                        重置
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--cm-ink-3)]" />
                      <input 
                        type="text" 
                        value={location}
                        onChange={(e) => { locationManuallyEditedRef.current = true; setLocation(e.target.value); }}
                        placeholder="地点"
                        className="w-full pl-10 pr-10 py-2 bg-[color:var(--cm-paper)] border-2 border-[color:var(--cm-border-strong)] rounded-lg text-sm appearance-none shadow-none focus:outline-none focus:!border-transparent focus:ring-2 focus:ring-[color:var(--cm-brass)]"
                      />
                      {location.trim() && (
                        <button
                          type="button"
                          onClick={() => { locationManuallyEditedRef.current = true; setLocation(""); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] flex items-center justify-center border border-[color:var(--cm-border)] z-10"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--cm-ink-3)]" />
                      <input 
                        type="text" 
                        value={date}
                        onChange={(e) => { dateManuallyEditedRef.current = true; setDate(e.target.value); }}
                        placeholder="时间"
                        className="w-full pl-10 pr-10 py-2 bg-[color:var(--cm-paper)] border-2 border-[color:var(--cm-border-strong)] rounded-lg text-sm appearance-none shadow-none focus:outline-none focus:!border-transparent focus:ring-2 focus:ring-[color:var(--cm-brass)]"
                      />
                      {date.trim() && (
                        <button
                          type="button"
                          onClick={() => { dateManuallyEditedRef.current = true; setDate(""); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] flex items-center justify-center border border-[color:var(--cm-border)] z-10"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className={cn("cm-subpanel hidden lg:block p-3 bg-[color:var(--cm-paper)] rounded-xl border border-[color:var(--cm-border)]", isCropMode && "relative z-50")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-xs font-medium text-[color:var(--cm-ink-2)] whitespace-nowrap">✂️ 照片裁剪</div>
                      <div className="text-[10px] text-[color:var(--cm-ink-3)] truncate">拖动/滚轮/双指调整</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPickerMode(null);
                          setIsCropMode((v) => {
                            const next = !v;
                            cropModeWantedRef.current = next;
                            return next;
                          });
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                          isCropMode
                            ? "border-transparent ring-2 ring-[color:var(--cm-brass)] bg-[color:color-mix(in_srgb,var(--cm-brass)_12%,transparent)] text-[color:var(--cm-ink)]"
                            : "border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                        )}
                      >
                        {isCropMode ? "退出裁剪" : "进入裁剪"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCrop(DEFAULT_CROP)}
                        className={cn(
                          "h-8 px-3 rounded-lg text-xs font-medium border-2 bg-[color:var(--cm-surface)] whitespace-nowrap",
                          crop.x !== DEFAULT_CROP.x || crop.y !== DEFAULT_CROP.y || crop.scale !== DEFAULT_CROP.scale
                            ? "border-[color:var(--cm-border-strong)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                            : "border-[color:var(--cm-border)] text-[color:var(--cm-ink-3)] cursor-not-allowed"
                        )}
                      >
                        重置
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex lg:col-span-5 lg:col-start-8 lg:row-start-2">
            <button
              disabled={isCropMode || isRangeMode}
              onClick={() => {
                if (isCropMode || isRangeMode) return;
                downloadImage();
              }}
              className={cn(
                "w-full items-center justify-center gap-2 bg-[color:var(--cm-btn)] hover:bg-[color:var(--cm-btn-hover)] active:bg-[color:var(--cm-btn-active)] text-[color:var(--cm-btn-text)] py-3 rounded-xl transition-colors text-sm font-semibold border border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border))] shadow-sm flex",
                (isCropMode || isRangeMode) && "opacity-60 cursor-not-allowed hover:bg-[color:var(--cm-btn)] active:bg-[color:var(--cm-btn)]"
              )}
            >
              <Download className="w-4 h-4" />
              导出成品
            </button>
          </div>
        </>
      )}
      {exportPreviewUrl && (
        <div className="fixed inset-0 z-[120] lg:hidden bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[color:var(--cm-surface)] rounded-2xl overflow-hidden shadow-2xl border border-[color:var(--cm-border)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--cm-border)]">
              <div className="text-sm font-medium text-[color:var(--cm-ink-2)]">导出预览（长按图片保存）</div>
              <button
                type="button"
                onClick={() => setExportPreviewUrl("")}
                className="w-8 h-8 rounded-full bg-[color:var(--cm-surface-2)] text-[color:var(--cm-ink-2)] text-lg leading-none flex items-center justify-center"
              >
                ×
              </button>
            </div>
            <div className="p-3">
              <img src={exportPreviewUrl} alt="导出预览" className="w-full h-auto rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* Hidden Canvas for rendering */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas
        ref={colorPickerCanvasRef}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
      />
    </div>
  );
}
