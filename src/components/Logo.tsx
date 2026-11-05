/** Logo image lives at client/public/logo.png — replace that file to change the logo everywhere. */
export const LOGO_SRC = "/logo.png";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return <img src={LOGO_SRC} alt="" aria-hidden className={`object-contain ${className}`} />;
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className={`text-2xl font-semibold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Lumecard
      </span>
    </span>
  );
}
