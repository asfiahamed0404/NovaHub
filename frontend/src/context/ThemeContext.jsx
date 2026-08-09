import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const THEME_STORAGE_KEY = "novahub_theme";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";
const THEME_PREFERENCES = new Set(["light", "dark", "system"]);
const THEME_COLORS = {
  light: "#f3f6fb",
  dark: "#070b14",
};

const ThemeContext = createContext(null);

function getSystemTheme() {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "dark";
  }

  return window.matchMedia(SYSTEM_THEME_QUERY).matches
    ? "dark"
    : "light";
}

function resolveTheme(theme) {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyResolvedTheme(resolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;

  let themeColorMeta = document.querySelector('meta[name="theme-color"]');

  if (!themeColorMeta) {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.setAttribute("name", "theme-color");
    document.head.appendChild(themeColorMeta);
  }

  themeColorMeta.setAttribute("content", THEME_COLORS[resolvedTheme]);
}

function getInitialThemeState() {
  let theme = "system";

  if (typeof window !== "undefined") {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

      if (THEME_PREFERENCES.has(storedTheme)) {
        theme = storedTheme;
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }
  }

  const resolvedTheme = resolveTheme(theme);
  applyResolvedTheme(resolvedTheme);

  return { theme, resolvedTheme };
}

function ThemeProvider({ children }) {
  const [{ theme, resolvedTheme }, setThemeState] = useState(
    getInitialThemeState
  );

  const setTheme = useCallback((nextTheme) => {
    if (!THEME_PREFERENCES.has(nextTheme)) {
      return;
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The in-memory preference still works when storage is unavailable.
    }

    setThemeState({
      theme: nextTheme,
      resolvedTheme: resolveTheme(nextTheme),
    });
  }, []);

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (
      theme !== "system" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined;
    }

    const systemTheme = window.matchMedia(SYSTEM_THEME_QUERY);
    const handleSystemThemeChange = (event) => {
      setThemeState((currentTheme) => {
        if (currentTheme.theme !== "system") {
          return currentTheme;
        }

        return {
          theme: "system",
          resolvedTheme: event.matches ? "dark" : "light",
        };
      });
    };

    systemTheme.addEventListener("change", handleSystemThemeChange);

    return () => {
      systemTheme.removeEventListener("change", handleSystemThemeChange);
    };
  }, [theme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [resolvedTheme, setTheme, theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}

// eslint-disable-next-line react-refresh/only-export-components -- Keep the provider and hook together in this focused context module.
export { ThemeProvider, useTheme };
