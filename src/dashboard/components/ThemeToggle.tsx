import React from "react";

interface Props {
  theme: "light" | "dark" | "system";
  onCycle: () => void;
}

const icons: Record<string, React.ReactNode> = {
  light: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" strokeWidth="1.5" />
      <path strokeWidth="1.5" strokeLinecap="round" d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  dark: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  ),
  system: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
    </svg>
  ),
};

const labels: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle({ theme, onCycle }: Props) {
  return (
    <button
      onClick={onCycle}
      className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
      title={`Theme: ${labels[theme]}`}
    >
      {icons[theme]}
    </button>
  );
}
