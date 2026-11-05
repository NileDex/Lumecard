import type { Asset } from "../data/assets";
import type { CardTheme } from "../data/themes";
import { AssetIcon } from "./AssetIcon";
import { LogoMark } from "./Logo";

interface Props {
  asset: Asset;
  theme: CardTheme;
  amount?: number;
  showValue?: boolean;
  className?: string;
}

export function GiftCard({ asset, theme, amount, showValue = false, className = "" }: Props) {
  const isAsset = theme.bg === "asset";
  const bg = isAsset ? `bg-gradient-to-br ${asset.gradient}` : theme.bg;

  return (
    <div className={`relative aspect-[1.8/1] w-full overflow-hidden rounded-2xl ${bg} ${className}`}>
      {/* decorative diagonal streaks */}
      <div className="pointer-events-none absolute inset-0 opacity-25">
        <div className="absolute -left-10 top-6 h-10 w-[140%] -rotate-[35deg] rounded-full bg-white/30" />
        <div className="absolute -right-24 bottom-10 h-16 w-[80%] -rotate-[35deg] rounded-full bg-black/20" />
      </div>

      <div className="absolute left-4 top-3 flex items-center gap-1.5 text-white/90">
        <LogoMark className="h-5 w-5" />
        <span className="text-xs font-semibold tracking-wide">Lumecard</span>
      </div>

      <div className="absolute inset-0 grid place-items-center">
        {isAsset ? (
          <AssetIcon asset={asset} size="fill" className="ring-4 ring-white/25 sm:ring-8" />
        ) : (
          <div className="text-center text-white drop-shadow">
            <p className="text-3xl font-bold tracking-tight sm:text-4xl">{theme.tagline}</p>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm font-medium opacity-90">
              <AssetIcon asset={asset} size="sm" className="ring-2 ring-white/60" />
              {asset.name}
            </div>
          </div>
        )}
      </div>

      {showValue && amount !== undefined && (
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-lg bg-neutral-100/95 px-3 py-2 backdrop-blur">
          <div>
            <p className="text-[10px] text-neutral-500">Gift Card Value</p>
            <p className="text-sm font-bold">
              ${amount} of {asset.symbol}
            </p>
          </div>
          <AssetIcon asset={asset} size="md" />
        </div>
      )}
    </div>
  );
}

// Bow colours: the brand orange, with a darker shade for depth and a lighter one for the loops.
const RIBBON = "#E4560C";
const DARK = "#BD420A";
const LOOP = "#F26B21";
const HIGHLIGHT = "#F5834A";
const OUTLINE = "rgba(80,20,0,.28)";
const EDGE = "rgba(0,0,0,.10)";

/** One half of the bow (left loop and tail). The right half is this, mirrored. */
function BowSide() {
  return (
    <>
      <path d="M67.4 53.6 L51.4 97.6 L60.7 92.5 L64.6 102.4 L80.6 58.4 Z" fill={DARK} stroke={OUTLINE} strokeWidth="1" strokeLinejoin="round" />
      <path d="M78 54 C68 24 36 4 18 20 C4 34 24 62 78 54 Z" fill={LOOP} stroke={OUTLINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M71 51 C64 33 42 20 29 28 C21 36 34 49 71 51 Z" fill={DARK} />
      <path d="M26 17 C38 10 58 20 68 36" fill="none" stroke={HIGHLIGHT} strokeWidth="2" strokeLinecap="round" opacity=".5" />
    </>
  );
}

/** Wrapped state shown before the recipient (or sender) reveals the card */
export function WrappedCard({ className = "" }: { className?: string }) {
  return (
    <div className={`relative aspect-[1.8/1] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white ${className}`}>
      {/* One picture for ribbon and bow, so they stay aligned at any size. */}
      <svg viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        {/* ribbon cross */}
        <rect x="160" y="-10" width="40" height="220" fill={RIBBON} />
        <rect x="-10" y="80" width="380" height="40" fill={RIBBON} />
        <rect x="160" y="-10" width="40" height="220" fill="none" stroke={EDGE} />
        <rect x="-10" y="80" width="380" height="40" fill="none" stroke={EDGE} />

        {/* bow, centred on the crossing */}
        <g transform="translate(100 44)">
          <BowSide />
          <g transform="translate(160 0) scale(-1 1)">
            <BowSide />
          </g>
          <rect x="68" y="40" width="24" height="24" rx="8" fill={DARK} stroke={OUTLINE} />
          <path d="M72 46 C76 43 84 43 88 46" fill="none" stroke={HIGHLIGHT} strokeWidth="2" strokeLinecap="round" opacity=".55" />
        </g>
      </svg>

      <div className="absolute left-4 top-3 flex items-center gap-1.5 text-neutral-900">
        <LogoMark className="h-5 w-5" />
        <span className="text-xs font-semibold tracking-wide">Lumecard</span>
      </div>
    </div>
  );
}
