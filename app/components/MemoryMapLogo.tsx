import type { SVGProps } from "react";

type MemoryMapLogoProps = Omit<SVGProps<SVGSVGElement>, "title"> & {
  size?: number;
  title?: string;
  decorative?: boolean;
  variant?: "default" | "dark" | "light" | "monochrome";
};

export default function MemoryMapLogo({
  size = 44,
  className = "",
  title,
  decorative = true,
  variant = "default",
  ...props
}: MemoryMapLogoProps) {
  const isAccessible = !decorative || Boolean(title);

  return (
    <svg
      {...props}
      aria-hidden={isAccessible ? undefined : true}
      aria-label={isAccessible ? title ?? "MemoryMap logo" : undefined}
      className={`memorymap-logo memorymap-logo--${variant} ${className}`.trim()}
      width={size}
      height={size * 0.75}
      viewBox="0 0 64 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      role={isAccessible ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      <path
        className="memorymap-logo__form"
        fill="currentColor"
        d="M7 40V12.5C7 9.6 8.7 8 11.5 8H15.6C17.1 8 18.3 8.6 19.3 9.8L32 27.5L44.7 9.8C45.7 8.6 46.9 8 48.4 8H52.5C55.3 8 57 9.6 57 12.5V40H49V20.7L35.4 35.5C33.6 37.6 30.4 37.6 28.6 35.5L15 20.7V40H7Z"
      />
      <path
        className="memorymap-logo__pin"
        d="M52.5 1.5C48.85 1.5 46 4.32 46 7.8C46 12.25 52.5 16.5 52.5 16.5S59 12.25 59 7.8C59 4.32 56.15 1.5 52.5 1.5Z"
        fill="var(--mm-logo-node)"
      />
      <circle className="memorymap-logo__pin-hole" cx="52.5" cy="7.7" r="1.7" fill="var(--mm-logo-pin-hole)" />
    </svg>
  );
}
