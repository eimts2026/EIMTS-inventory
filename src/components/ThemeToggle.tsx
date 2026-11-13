import { useEffect, useLayoutEffect, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import "./workspace-theme.css";

const preferenceKey = "eimts.inventory.theme";
const modes = [
  { value: "system", label: "Use device theme", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;
type Mode = (typeof modes)[number]["value"];
const normalize = (value: string | null): Mode =>
  value === "dark" || value === "light" ? value : "system";

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(() => {
    try { return normalize(localStorage.getItem(preferenceKey)); }
    catch { return "system"; }
  });
  useLayoutEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.workspaceTheme =
        mode === "system" ? (system.matches ? "dark" : "light") : mode;
    };
    apply();
    if (mode === "system") system.addEventListener("change", apply);
    return () => {
      system.removeEventListener("change", apply);
      delete document.documentElement.dataset.workspaceTheme;
    };
  }, [mode]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === preferenceKey || event.key === null) setMode(normalize(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function choose(value: string) {
    const next = normalize(value);
    setMode(next);
    try { localStorage.setItem(preferenceKey, next); }
    catch { /* Theme selection also works with storage disabled. */ }
  }
  const selected = modes.find(option => option.value === mode)!;
  return (
    <Select.Root value={mode} onValueChange={choose}>
      <Select.Trigger className="icon-button theme-toggle" aria-label={`Appearance, ${selected.label}`} title="Choose appearance">
        <selected.Icon size={18} />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" align="end" sideOffset={6} collisionPadding={8} className="select-content theme-menu">
          <Select.Viewport className="select-viewport">
            {modes.map(({value, label, Icon}) => (
              <Select.Item key={value} value={value} className="select-option">
                <Icon size={16} />
                <Select.ItemText>{label}</Select.ItemText>
                <Select.ItemIndicator><Check size={16} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
