export function getThemeObject(theme?: "light" | "dark") {
  const isDark = theme === "dark";
  return {
    colors: {
      brand: {
        DEFAULT: "#7f56d9",
        50: "#f9f5ff",
        600: "#7f56d9",
        700: "#6941c6",
      },
      foreground: isDark ? "#ffffff" : "#101828",
      muted: isDark ? "#98a2b3" : "#475467",
      background: isDark ? "#1d2939" : "#ffffff",
      border: isDark ? "#344054" : "#eaecf0",
    },
  };
}
