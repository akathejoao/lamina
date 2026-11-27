"use client";

import { useSyncExternalStore } from "react";

export type ThemePref = "dark" | "light" | "system";
export const THEME_KEY = "lamina-theme";
export const THEME_COLOR = { dark: "#0c0b10", light: "#f7f5fb" } as const;

// A página já abre no tema certo por public/theme-boot.js, que roda antes da pintura.
const listeners = new Set<() => void>();

function read(): ThemePref {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "system" ? value : "dark";
  } catch {
    return "dark";
  }
}

function resolve(pref: ThemePref): "dark" | "light" {
  if (pref === "system") return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  return pref;
}

function apply(pref: ThemePref) {
  const theme = resolve(pref);
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Sem armazenamento (janela privada): vale só nesta visita.
  }
  apply(pref);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onSystem = () => {
    if (read() === "system") apply("system");
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) {
      apply(read());
      listener();
    }
  };
  media.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, read, () => "dark");
}
