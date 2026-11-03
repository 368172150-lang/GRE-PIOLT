import { useState, useEffect } from "react";
import type { Language } from "../types";
export function usePreferences() {
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem("gp:language") === "en" ? "en" : "zh",
  );
  const [dark, setDark] = useState(
    () => localStorage.getItem("gp:theme") === "dark",
  );
  useEffect(() => {
    localStorage.setItem("gp:language", language);
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);
  useEffect(() => {
    localStorage.setItem("gp:theme", dark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return {
    language,
    setLanguage,
    dark,
    setDark,
    t: (zh: string, en: string) => (language === "zh" ? zh : en),
  };
}
