import { MonitorIcon, MoonIcon, SunIcon } from "./Icons.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

const themeOptions = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

function ThemeSelector({ compact = false }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <fieldset className={compact ? "shrink-0" : "min-w-0"}>
      <legend
        className={
          compact
            ? "sr-only"
            : "text-body mb-2 text-sm font-semibold"
        }
      >
        Appearance
      </legend>

      <div
        className={`theme-selector max-w-full ${
          compact ? "theme-selector-compact" : ""
        }`}
      >
        {themeOptions.map(({ value, label, Icon }) => {
          const isSelected = theme === value;
          const title =
            value === "system"
              ? `Use system theme (currently ${resolvedTheme})`
              : `Use ${label.toLowerCase()} theme`;

          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-label={`${label} theme`}
              aria-pressed={isSelected}
              title={title}
              className="theme-option"
            >
              <Icon className="size-4 shrink-0" />
              <span className={compact ? "sr-only" : "whitespace-nowrap"}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default ThemeSelector;
