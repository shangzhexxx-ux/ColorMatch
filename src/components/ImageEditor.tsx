"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Upload, Download, RefreshCw, MapPin, Calendar, Pipette, Palette, Type as TypeIcon } from "lucide-react";
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
  cssVar: string;
}

type MobileTab = 'presets' | 'colors' | 'text';

const FONT_OPTIONS: FontOption[] = [
  { name: '衬线', value: 'Playfair Display', style: 'italic', cssVar: 'var(--font-playfair)' },
  { name: '现代', value: 'Montserrat', style: 'normal', cssVar: 'var(--font-montserrat)' },
  { name: '优雅', value: 'Cormorant Garamond', style: 'italic', cssVar: 'var(--font-cormorant)' },
  { name: '简约', value: 'Lora', style: 'italic', cssVar: 'var(--font-lora)' },
  { name: '文艺', value: 'EB Garamond', style: 'italic', cssVar: 'var(--font-eb-garamond)' },
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
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string>("");
  const [mobileUiNonce, setMobileUiNonce] = useState<number>(0);
  
  useEffect(() => {
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
    } else if (schemes.length >= 5) {
      const newSchemes = schemes.slice(0, 5);
      newSchemes.push(customScheme);
      setSchemes(newSchemes);
      setSelectedSchemeIndex(5);
    } else {
      setSchemes([...schemes, customScheme]);
      setSelectedSchemeIndex(schemes.length);
    }
  }, [customBgColor, customTextColor]);
  
  const mobileImgRef = useRef<HTMLImageElement>(null);
  const desktopImgRef = useRef<HTMLImageElement>(null);
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
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const mobileControlsRef = useRef<HTMLDivElement>(null);
  const mobilePreviewRef = useRef<HTMLDivElement>(null);
  const lastMobileFocusActiveRef = useRef(false);
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

  const getActiveImgEl = () => {
    const candidates = [desktopImgRef.current, mobileImgRef.current];
    for (const el of candidates) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return el;
    }
    return desktopImgRef.current || mobileImgRef.current;
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

      const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
      if (!res.ok) return null;
      const data: any = await res.json();
      const pick = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : null);
      const city = pick(data && data.city);
      const locality = pick(data && data.locality);
      return city || locality;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const getDeviceLocationCity = async () => {
    if (typeof navigator === "undefined") return null;
    const geo: any = (navigator as any).geolocation;
    if (!geo || typeof geo.getCurrentPosition !== "function") return null;

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
        void (async () => {
          if (locationRequestIdRef.current !== locationRequestId) return;
          if (locationManuallyEditedRef.current) return;
          const current = typeof locationValueRef.current === "string" ? locationValueRef.current.trim() : "";
          if (current) return;
          const city = await getDeviceLocationCity();
          if (locationRequestIdRef.current !== locationRequestId) return;
          if (locationManuallyEditedRef.current) return;
          if (city) setLocation(city);
        })();
      };

      setTimeout(() => {
        fallbackToDevice();
      }, 1200);

      void (async () => {
        try {
          const { default: EXIF } = await import("exif-js");
          EXIF.getData(file as any, function (this: any) {
          const dateTime =
            EXIF.getTag(this, "DateTimeOriginal") ||
            EXIF.getTag(this, "DateTimeDigitized") ||
            EXIF.getTag(this, "DateTime");
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

          const gpsLat = EXIF.getTag(this, "GPSLatitude");
          const gpsLatRef = EXIF.getTag(this, "GPSLatitudeRef");
          const gpsLon = EXIF.getTag(this, "GPSLongitude");
          const gpsLonRef = EXIF.getTag(this, "GPSLongitudeRef");

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
        });
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

  const sampleHexAtClientPoint = (clientX: number, clientY: number) => {
    const img = getActiveImgEl();
    if (!img || !colorPickerCanvasRef.current) return;
    
    const canvas = colorPickerCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = img.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    
    const natX = Math.floor(x * scaleX);
    const natY = Math.floor(y * scaleY);

    if (natX < 0 || natY < 0 || natX >= img.naturalWidth || natY >= img.naturalHeight) return;
    
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
    }
    
    const pixel = ctx.getImageData(natX, natY, 1, 1).data;
    const hexColor = rgbToHex(pixel[0], pixel[1], pixel[2]);
    return hexColor;
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
      return `rgb(${tr}, ${tg}, ${tb})`;
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
      return `rgb(${tr}, ${tg}, ${tb})`;
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

      const accentRaw = pickFromBins(
        accentCandidates.length ? accentCandidates : sortedByAtmosphere,
        (b) => b.richRgb,
        55,
        46
      );
      registerBg(accentRaw);
      newSchemes.push(createScheme(accentRaw, "明亮色彩", 'tinted'));
      
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

    const previewScale = (() => {
      try {
        const rect = img.getBoundingClientRect();
        if (!rect || rect.width <= 0) return 1;
        const previewCardWidth = isPortrait ? rect.width / 0.68 : rect.width;
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

    if (isPortrait) {
      const stripW = Math.round(targetWidth * 0.32);
      ctx.fillStyle = selectedColor;
      ctx.fillRect(0, 0, stripW, targetHeight);
      const imgX = stripW;
      const imgW = targetWidth - stripW;
      const imgH = targetHeight;

      const areaRatio = imgW / imgH;
      let dW: number, dH: number, dX: number, dY: number;

      if (imageRatio > areaRatio) {
        dH = imgH;
        dW = imgH * imageRatio;
        dX = imgX + (imgW - dW) / 2;
        dY = 0;
      } else {
        dW = imgW;
        dH = imgW / imageRatio;
        dX = imgX;
        dY = (imgH - dH) / 2;
      }
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
      const fontWeight = "400";
      const basePreviewFontPx = 13;
      const fontPx = getExportFontPx(basePreviewFontPx);
      const spacingRatio = exportTextIsLong ? 0.12 : 0.18;
      ctx.font = `${selectedFont.style} ${fontWeight} ${fontPx}px "${selectedFont.value}", serif`;
      const spacingPx = fontPx * spacingRatio;
      drawTextWithSpacing(displayStr, 0, 0, spacingPx);
      ctx.restore();
    } else {
      // Landscape Layout: Image on Bottom (50%), Text on Top (50%)
      const stripH = Math.round(targetHeight * 0.5);
      ctx.fillStyle = selectedColor;
      ctx.fillRect(0, 0, targetWidth, stripH);

      const imgAreaHeight = targetHeight * 0.5;
      const imgAreaTop = targetHeight * 0.5;
      
      // Draw image to fill the bottom 50% (object-cover)
      const areaRatio = targetWidth / imgAreaHeight;
      let dW, dH, dX, dY;
      
      if (imageRatio > areaRatio) {
        // Image is wider than area
        dH = imgAreaHeight;
        dW = imgAreaHeight * imageRatio;
        dX = (targetWidth - dW) / 2;
        dY = imgAreaTop;
      } else {
        // Image is taller than area
        dW = targetWidth;
        dH = targetWidth / imageRatio;
        dX = 0;
        dY = imgAreaTop + (imgAreaHeight - dH) / 2;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, imgAreaTop, targetWidth, imgAreaHeight);
      ctx.clip();
      ctx.drawImage(img, dX, dY, dW, dH);
      ctx.restore();

      // Text on Top (centered in the top 50%)
      ctx.fillStyle = textColor;
      const selectedFont = FONT_OPTIONS[selectedFontIndex];
      const fontWeight = "400";
      const basePreviewFontPx = 17;
      const fontPx = getExportFontPx(basePreviewFontPx);
      const spacingRatio = exportTextIsLong ? 0.1 : 0.16;
      ctx.font = `${selectedFont.style} ${fontWeight} ${fontPx}px "${selectedFont.value}", serif`;
      const spacingPx = fontPx * spacingRatio;
      drawTextWithSpacing(displayStr, targetWidth / 2, targetHeight * 0.25, spacingPx);
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

  const isPortrait = imageRatio < 1;
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
  const pickerPortal =
    typeof document !== "undefined" && isPickerMode
      ? createPortal(
          <>
            {mousePos && (
              <div
                className="fixed pointer-events-none z-[9999] transform -translate-x-1/2 -translate-y-[130%] lg:-translate-y-1/2"
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
            <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+94px)] z-[9999] pointer-events-none lg:hidden">
              <div className="bg-black/80 text-white px-4 py-2 rounded-lg text-xs font-medium backdrop-blur-sm flex items-center gap-2">
                <Pipette className="w-4 h-4" />
                {isPickerMode === "bg" ? "触摸拾取背景色" : "触摸拾取文字色"}
                <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded">{hoverColor.toUpperCase()}</span>
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div ref={editorRootRef} className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-8 items-start lg:items-stretch">
      {pickerPortal}
      {!image && (
        <div className="lg:col-span-12 bg-[color:var(--cm-surface)] p-10 rounded-2xl shadow-sm border border-[color:var(--cm-border)] flex flex-col items-center justify-center gap-6 min-h-[260px]">
          <div className="flex flex-col items-center gap-4 text-[color:var(--cm-ink-2)]">
            <div className="w-16 h-16 rounded-full bg-[color:var(--cm-paper)] flex items-center justify-center border-2 border-dashed border-[color:var(--cm-border)]">
              <Upload className="w-8 h-8" />
            </div>
            <div className="text-sm font-medium">上传照片开始制作</div>
          </div>
          <div className="w-full max-w-[420px]">
            <label className="cm-upload-btn">
              <span className="inline-flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                上传照片
              </span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="sr-only" />
            </label>
          </div>
        </div>
      )}
      {image && (
        <>
        <div className="lg:hidden fixed inset-0 z-[60] bg-[color:var(--cm-paper)] flex flex-col">
                  <div
                    ref={mobileScrollRef}
                    className="flex-1 overflow-y-auto overscroll-contain"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    <div className="px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+104px)] flex flex-col items-center gap-2">
                      <div
                        ref={mobilePreviewRef}
                        className="w-[92vw] max-w-[420px] sm:max-w-[430px] mx-auto flex justify-center bg-[color:var(--cm-surface)] p-2 sm:p-3 rounded-2xl shadow-sm border border-[color:var(--cm-border)] items-center"
                      >
                        <div
                          className="relative h-[50svh] max-h-[520px] aspect-[3/4] shadow-2xl rounded-lg overflow-hidden bg-[color:var(--cm-surface)] flex flex-col sm:flex-row"
                          style={{ flexDirection: isPortrait ? "row" : "column" }}
                        >
                          <div
                              className={cn(
                                "relative flex items-center justify-center shrink-0",
                                isPortrait ? "w-[32%] h-full" : "w-full h-[50%]"
                              )}
                            style={{ backgroundColor: selectedColor }}
                          >
                            <div
                              className={cn(
                                "text-center px-4 transition-colors duration-200",
                                isPortrait
                                  ? cn(
                                      "rotate-90 whitespace-nowrap",
                                      previewTextIsLong ? "text-[13px] tracking-[0.12em]" : "text-[13px] tracking-[0.18em]"
                                    )
                                  : cn(previewTextIsLong ? "text-[17px] tracking-[0.1em]" : "text-[17px] tracking-[0.16em]")
                              )}
                              style={{
                                color: textColor,
                                fontFamily: FONT_OPTIONS[selectedFontIndex].cssVar,
                                fontStyle: FONT_OPTIONS[selectedFontIndex].style,
                              }}
                            >
                              {previewTextLine}
                            </div>
                          </div>

                          <div
                            className={cn(
                              "relative overflow-hidden bg-zinc-50 flex items-center justify-center grow touch-pan-y",
                              isPickerMode && "touch-none",
                              isPortrait ? "h-full" : "w-full h-[50%]"
                            )}
                          >
                            <img
                              ref={mobileImgRef}
                              src={image || FALLBACK_PIXEL}
                              alt="Uploaded"
                              className={cn("w-full h-full object-cover", isPickerMode && "cursor-none touch-none select-none")}
                              style={isPickerMode ? { touchAction: "none" } : undefined}
                              onLoad={onImageLoad}
                              onError={() => {
                                setIsProcessing(false);
                              }}
                              onPointerDown={(e) => {
                                if (!isPickerMode) return;
                                if (e.pointerType === "touch") return;
                                try {
                                  e.preventDefault();
                                } catch {}
                                handlePickerStartAtClientPoint(e.clientX, e.clientY);
                              }}
                              onPointerMove={(e) => {
                                if (!isPickerMode) return;
                                if (e.pointerType === "touch") return;
                                handlePickerMoveAtClientPoint(e.clientX, e.clientY);
                              }}
                              onPointerUp={(e) => {
                                if (!isPickerMode) return;
                                if (e.pointerType === "touch") return;
                                try {
                                  e.preventDefault();
                                } catch {}
                                handlePickerPickAtClientPoint(e.clientX, e.clientY);
                              }}
                              onPointerLeave={() => setMousePos(null)}
                              onTouchStart={(e) => {
                                if (!isPickerMode) return;
                                const t = e.touches && e.touches[0] ? e.touches[0] : null;
                                if (!t) return;
                                try {
                                  e.preventDefault();
                                } catch {}
                                handlePickerStartAtClientPoint(t.clientX, t.clientY);
                              }}
                              onTouchMove={(e) => {
                                if (!isPickerMode) return;
                                const t = e.touches && e.touches[0] ? e.touches[0] : null;
                                if (!t) return;
                                try {
                                  e.preventDefault();
                                } catch {}
                                handlePickerMoveAtClientPoint(t.clientX, t.clientY);
                              }}
                              onTouchEnd={(e) => {
                                if (!isPickerMode) return;
                                try {
                                  e.preventDefault();
                                } catch {}
                                const p = pickerPointRef.current || mousePos;
                                if (p) handlePickerPickAtClientPoint(p.x, p.y);
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div
                        ref={mobileControlsRef}
                        className="bg-[color:var(--cm-surface)] w-[92vw] max-w-[420px] sm:max-w-[430px] mt-0.5 rounded-2xl shadow-sm border border-[color:var(--cm-border)] p-4 space-y-3"
                      >
                        <div className="flex bg-[color:var(--cm-surface-2)] rounded-xl p-0.5 gap-1">
                          <button
                            onClick={() => setMobileTab("presets")}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                              mobileTab === "presets" ? "bg-[color:var(--cm-surface)] text-[color:var(--cm-ink)] shadow-sm" : "text-[color:var(--cm-ink-2)]"
                            )}
                          >
                            智能配色
                          </button>
                          <button
                            onClick={() => setMobileTab("colors")}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                              mobileTab === "colors" ? "bg-[color:var(--cm-surface)] text-[color:var(--cm-ink)] shadow-sm" : "text-[color:var(--cm-ink-2)]"
                            )}
                          >
                            自定义颜色
                          </button>
                          <button
                            onClick={() => setMobileTab("text")}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                              mobileTab === "text" ? "bg-[color:var(--cm-surface)] text-[color:var(--cm-ink)] shadow-sm" : "text-[color:var(--cm-ink-2)]"
                            )}
                          >
                            文字样式
                          </button>
                        </div>

                        <div className="space-y-3">
                          {mobileTab === "presets" && (
                            <div className="tab-panel space-y-2">
                            <div className="scheme-scroll flex gap-2 overflow-x-auto py-2 -mx-1 px-1">
                                {schemes
                                  .map((scheme, schemeIndex) => ({ scheme, schemeIndex }))
                                  .filter(({ scheme }) => scheme.name !== "自定义")
                                  .slice(0, 5)
                                  .map(({ scheme, schemeIndex }) => {
                                    const isSelected = selectedSchemeIndex === schemeIndex;
                                    return (
                                      <button
                                        key={`${scheme.name}-${scheme.bg}-${scheme.text}`}
                                        onClick={() => setSelectedSchemeIndex(schemeIndex)}
                                        className={cn(
                                          "flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all w-[78px] shrink-0 outline-none focus:outline-none focus-visible:outline-none",
                                          isSelected
                                            ? "border-[color:var(--cm-brass)] bg-[color:color-mix(in_srgb,var(--cm-brass)_12%,transparent)]"
                                            : "border-transparent bg-[color:var(--cm-surface)] hover:bg-[color:color-mix(in_srgb,var(--cm-brass)_8%,transparent)] active:scale-[0.99]"
                                        )}
                                      >
                                        <div
                                          className="w-full aspect-square rounded-lg shadow-inner relative flex items-center justify-center overflow-hidden"
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
                                    onChange={(e) => setCustomBgColor(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                </div>
                              </label>
                              <button
                                onClick={() => {
                                  setPickerTarget("bg");
                                  setIsPickerMode("bg");
                                }}
                                className={cn(
                                  "w-[52px] h-[52px] rounded-xl border-2 transition-all flex items-center justify-center",
                                  isPickerMode === "bg"
                                    ? "border-transparent ring-2 ring-[color:var(--cm-brass)] bg-[color:color-mix(in_srgb,var(--cm-brass)_12%,transparent)]"
                                    : "border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                                )}
                              >
                                <Pipette className={cn("w-5 h-5", isPickerMode === "bg" ? "text-[color:var(--cm-brass)]" : "text-[color:var(--cm-ink-3)]")} />
                              </button>
                              <input
                                type="text"
                                value={customBgColor}
                                onChange={(e) => setCustomBgColor(e.target.value)}
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
                                    onChange={(e) => setCustomTextColor(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                </div>
                              </label>
                              <button
                                onClick={() => {
                                  setPickerTarget("text");
                                  setIsPickerMode("text");
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
                                onChange={(e) => setCustomTextColor(e.target.value)}
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

                        <div className="px-4 py-2 bg-[color:color-mix(in_srgb,var(--cm-brass)_10%,transparent)] border border-[color:color-mix(in_srgb,var(--cm-brass)_40%,var(--cm-border))] rounded-xl">
                          <p className="text-xs text-[color:var(--cm-ink-2)] text-center">✨ 颜色将实时应用到预览中</p>
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
                                  ? "border-transparent ring-2 ring-[color:var(--cm-brass)] bg-[color:var(--cm-ink)] text-[color:var(--cm-surface)]"
                                  : "border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                              )}
                              style={{ fontFamily: font.cssVar, fontStyle: font.style }}
                            >
                              {font.name}
                            </button>
                          ))}
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
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[color:var(--cm-surface-2)] text-[color:var(--cm-ink-2)] text-lg leading-none flex items-center justify-center"
                            >
                              ×
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
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[color:var(--cm-surface-2)] text-[color:var(--cm-ink-2)] text-lg leading-none flex items-center justify-center"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

              <div
                className="fixed left-0 right-0 bottom-0 z-[110] bg-[color:color-mix(in_srgb,var(--cm-paper)_92%,transparent)] backdrop-blur border-t border-[color:var(--cm-border)]"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                <div className="mx-auto w-full max-w-[430px] px-4 py-3 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="cm-upload-btn h-12">
                      <span className="inline-flex items-center justify-center gap-2">
                        <Upload className="w-5 h-5" />
                        上传照片
                      </span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="sr-only" />
                    </label>
                    <button
                      onClick={downloadImage}
                      className="w-full h-12 flex items-center justify-center gap-2 bg-[color:var(--cm-btn)] hover:bg-[color:var(--cm-btn-hover)] active:bg-[color:var(--cm-btn-active)] active:scale-[0.99] text-[color:var(--cm-btn-text)] rounded-xl text-sm font-medium transition-colors duration-150 border border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border))] shadow-sm"
                    >
                      <Download className="w-5 h-5" />
                      导出成品
                    </button>
                  </div>
                </div>
              </div>
            </div>

          <div className="hidden lg:block lg:col-span-7 lg:sticky lg:top-3">
                <div className="w-full">
                  <div className="bg-[color:var(--cm-surface)] p-4 rounded-2xl shadow-sm border border-[color:var(--cm-border)]">
                    <div
                      className={cn(
                        "relative w-full max-w-[520px] aspect-[3/4] shadow-2xl rounded-lg overflow-hidden bg-[color:var(--cm-surface)] mx-auto",
                        isPortrait ? "grid grid-cols-[32%_1fr]" : "grid grid-rows-[1fr_1fr]"
                      )}
                    >
                      <div
                        className={cn(
                          "relative flex items-center justify-center",
                          isPortrait ? "h-full" : "w-full"
                        )}
                        style={{ backgroundColor: selectedColor }}
                      >
                        <div
                          className={cn(
                            "text-center px-4 transition-colors duration-200",
                            isPortrait
                              ? cn(
                                  "rotate-90 whitespace-nowrap",
                                  previewTextIsLong ? "text-[13px] tracking-[0.12em]" : "text-[13px] tracking-[0.18em]"
                                )
                              : cn(previewTextIsLong ? "text-[17px] tracking-[0.1em]" : "text-[17px] tracking-[0.16em]")
                          )}
                          style={{
                            color: textColor,
                            fontFamily: FONT_OPTIONS[selectedFontIndex].cssVar,
                            fontStyle: FONT_OPTIONS[selectedFontIndex].style,
                          }}
                        >
                          {previewTextLine}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "relative overflow-hidden bg-[color:var(--cm-paper)] flex items-center justify-center",
                          isPortrait ? "h-full" : "w-full"
                        )}
                      >
                        <img
                          ref={desktopImgRef}
                          src={image || FALLBACK_PIXEL}
                          alt="Uploaded"
                          className={cn("w-full h-full object-cover", isPickerMode && "cursor-none touch-none select-none")}
                          style={isPickerMode ? { touchAction: "none" } : undefined}
                          onLoad={onImageLoad}
                          onError={(e) => {
                            setIsProcessing(false);
                          }}
                          onPointerDown={(e) => {
                            if (!isPickerMode) return;
                            if (e.pointerType === "touch") return;
                            try {
                              e.preventDefault();
                            } catch {}
                            handlePickerStartAtClientPoint(e.clientX, e.clientY);
                          }}
                          onPointerMove={(e) => {
                            if (!isPickerMode) return;
                            if (e.pointerType === "touch") return;
                            handlePickerMoveAtClientPoint(e.clientX, e.clientY);
                          }}
                          onPointerUp={(e) => {
                            if (!isPickerMode) return;
                            if (e.pointerType === "touch") return;
                            try {
                              e.preventDefault();
                            } catch {}
                            handlePickerPickAtClientPoint(e.clientX, e.clientY);
                          }}
                          onPointerLeave={() => setMousePos(null)}
                          onTouchStart={(e) => {
                            if (!isPickerMode) return;
                            const t = e.touches && e.touches[0] ? e.touches[0] : null;
                            if (!t) return;
                            try {
                              e.preventDefault();
                            } catch {}
                            handlePickerStartAtClientPoint(t.clientX, t.clientY);
                          }}
                          onTouchMove={(e) => {
                            if (!isPickerMode) return;
                            const t = e.touches && e.touches[0] ? e.touches[0] : null;
                            if (!t) return;
                            try {
                              e.preventDefault();
                            } catch {}
                            handlePickerMoveAtClientPoint(t.clientX, t.clientY);
                          }}
                          onTouchEnd={(e) => {
                            if (!isPickerMode) return;
                            try {
                              e.preventDefault();
                            } catch {}
                            const p = pickerPointRef.current || mousePos;
                            if (p) handlePickerPickAtClientPoint(p.x, p.y);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
          </div>

          <div className="hidden lg:flex lg:col-span-5 flex flex-col gap-6 lg:h-full pb-[calc(env(safe-area-inset-bottom)+96px)] lg:pb-0">
            <div className="bg-[color:var(--cm-surface)] p-4 lg:p-4 rounded-2xl shadow-sm border border-[color:var(--cm-border)] flex flex-col gap-4 lg:gap-4 flex-1">
              <label className="cm-upload-btn">
                <span className="inline-flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" />
                  上传照片
                </span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="sr-only" />
              </label>

              <div className="space-y-4 lg:space-y-4">
                <label className="hidden lg:flex text-sm font-medium text-[color:var(--cm-ink-2)] flex items-center gap-2">
                  <RefreshCw className={cn("w-3 h-3", isProcessing && "animate-spin")} />
                  智能方案预设
                </label>
                
                <div className="hidden lg:block">
                  <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 lg:mx-0 lg:px-0 lg:pb-0 lg:grid lg:grid-cols-5 lg:gap-3 lg:overflow-visible">
                    {schemes
                      .map((scheme, schemeIndex) => ({ scheme, schemeIndex }))
                      .filter(({ scheme }) => scheme.name !== "自定义")
                      .slice(0, 5)
                      .map(({ scheme, schemeIndex }) => {
                      const isSelected = selectedSchemeIndex === schemeIndex;
                      return (
                      <button
                        key={`${scheme.name}-${scheme.bg}-${scheme.text}`}
                        onClick={() => setSelectedSchemeIndex(schemeIndex)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all w-[78px] shrink-0 lg:w-auto outline-none focus:outline-none focus-visible:outline-none",
                          isSelected
                            ? "border-[color:var(--cm-brass)] bg-[color:color-mix(in_srgb,var(--cm-brass)_12%,transparent)]"
                            : "border-transparent bg-[color:var(--cm-surface)] hover:bg-[color:color-mix(in_srgb,var(--cm-brass)_8%,transparent)] active:scale-[0.99]"
                        )}
                      >
                        <div className="w-full aspect-square rounded-lg shadow-inner relative flex items-center justify-center overflow-hidden" style={{ backgroundColor: scheme.bg }}>
                          <span className="font-serif italic text-lg select-none" style={{ color: scheme.text }}>Aa</span>
                        </div>
                        <span className="text-[10px] font-medium text-[color:var(--cm-ink-2)]">{scheme.name}</span>
                      </button>
                      );
                    })}
                  </div>
                </div>
                
                <div className="hidden lg:block mt-4 p-4 bg-[color:var(--cm-paper)] rounded-xl border border-dashed border-[color:var(--cm-border)]">
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
                              onChange={(e) => setCustomBgColor(e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div 
                              className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-md overflow-hidden z-20"
                              style={{ backgroundColor: customBgColor || '#e5e5e5' }}
                            />
                          </div>
                        </label>
                        <button
                          onClick={() => { setPickerTarget('bg'); setIsPickerMode('bg'); }}
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
                          onChange={(e) => setCustomBgColor(e.target.value)}
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
                              onChange={(e) => setCustomTextColor(e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div 
                              className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-md overflow-hidden z-20"
                              style={{ backgroundColor: customTextColor || '#171717' }}
                            />
                          </div>
                        </label>
                        <button
                          onClick={() => { setPickerTarget('text'); setIsPickerMode('text'); }}
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
                          onChange={(e) => setCustomTextColor(e.target.value)}
                          placeholder="#000000"
                          className="flex-1 h-10 px-3 bg-[color:var(--cm-surface)] border-2 border-[color:var(--cm-border-strong)] rounded-lg text-sm font-mono uppercase appearance-none shadow-none focus:outline-none focus:!border-transparent focus:ring-2 focus:ring-[color:var(--cm-brass)]"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 px-4 py-2 bg-[color:color-mix(in_srgb,var(--cm-brass)_10%,transparent)] border border-[color:color-mix(in_srgb,var(--cm-brass)_40%,var(--cm-border))] rounded-lg">
                    <p className="text-[10px] text-[color:var(--cm-ink-2)] text-center">
                      ✨ 颜色将实时应用到预览中，无需点击确认
                    </p>
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
                            ? "border-transparent ring-2 ring-[color:var(--cm-brass)] bg-[color:var(--cm-ink)] text-[color:var(--cm-surface)]"
                                  : "border-[color:var(--cm-border-strong)] bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] hover:border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border-strong))]"
                        )}
                        style={{ fontFamily: font.cssVar, fontStyle: font.style }}
                      >
                        {font.name}
                      </button>
                    ))}
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
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] text-lg leading-none flex items-center justify-center border border-[color:var(--cm-border)] z-10"
                        >
                          ×
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
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[color:var(--cm-surface)] text-[color:var(--cm-ink-2)] text-lg leading-none flex items-center justify-center border border-[color:var(--cm-border)] z-10"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={downloadImage}
              className="hidden lg:flex w-full items-center justify-center gap-2 bg-[color:var(--cm-btn)] hover:bg-[color:var(--cm-btn-hover)] active:bg-[color:var(--cm-btn-active)] text-[color:var(--cm-btn-text)] py-3 rounded-xl transition-colors text-sm font-medium border border-[color:color-mix(in_srgb,var(--cm-brass)_44%,var(--cm-border))] shadow-sm"
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
