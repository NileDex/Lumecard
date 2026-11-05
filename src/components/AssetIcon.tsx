import type { Asset } from "../data/assets";

type Size = "sm" | "md" | "lg" | "xl" | "fill";

const sizes: Record<Size, string> = {
  sm: "h-7 w-7 text-[11px] rounded-full",
  md: "h-9 w-9 text-xs rounded-full",
  lg: "h-[88px] w-[88px] text-2xl rounded-xl",
  xl: "h-36 w-36 text-5xl rounded-full",
  // Scales with its container (about 60% of its height), so it fits cards of any size.
  fill: "h-[60%] aspect-square text-4xl rounded-full",
};

export function AssetIcon({ asset, size = "md", className = "" }: { asset: Asset; size?: Size; className?: string }) {
  // Real token logo when we have one; the coloured tile is the fallback.
  if (asset.icon) {
    return (
      <img
        src={asset.icon}
        alt={asset.name}
        draggable={false}
        className={`inline-block shrink-0 rounded-full bg-white object-cover ${sizes[size].replace(/rounded-\S+/, "")} ${className}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br font-bold ${asset.gradient} ${
        asset.fg ?? "text-white"
      } ${sizes[size]} ${className}`}
      aria-label={asset.name}
    >
      {asset.glyph}
    </span>
  );
}
