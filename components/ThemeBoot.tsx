"use client";

import { useEffect } from "react";
import { getSettings } from "@/lib/storage";

export default function ThemeBoot() {
  useEffect(() => {
    const s = getSettings();
    document.documentElement.setAttribute("data-theme", s.darkMode ? "dark" : "light");
  }, []);
  return null;
}
