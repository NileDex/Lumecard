import { CircleDollarSign, LayoutGrid, type LucideIcon } from "lucide-react";

/** Stellar-only: the tokens the Lumecard gift contract allows. */
export type AssetCategory = "crypto" | "stablecoin";

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  category: AssetCategory;
  popular?: boolean;
  /** Short glyph rendered inside the icon tile */
  glyph: string;
  /** Tailwind gradient classes for the icon tile */
  gradient: string;
  /** Text colour on the tile */
  fg?: string;
  /** Official token logo (served from /public/tokens) */
  icon?: string;
  /** Mock USD price, display only */
  price: number;
}

// Prices are display-only placeholders until live prices are wired in.
export const ASSETS: Asset[] = [
  { id: "usdc", name: "USD Coin", symbol: "USDC", category: "stablecoin", popular: true, glyph: "$", gradient: "from-sky-500 to-blue-600", price: 1.0, icon: "/tokens/usdc.svg" },
  { id: "xlm", name: "Stellar Lumens", symbol: "XLM", category: "crypto", popular: true, glyph: "✦", gradient: "from-neutral-800 to-black", price: 0.1684, icon: "/tokens/xlm.png" },
  { id: "eurc", name: "Euro Coin", symbol: "EURC", category: "stablecoin", popular: true, glyph: "€", gradient: "from-cyan-600 to-blue-800", price: 1.1, icon: "/tokens/eurc.svg" },
];

export const CATEGORY_FILTERS: { id: "all" | "popular" | AssetCategory; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "stablecoin", label: "Stablecoins", icon: CircleDollarSign },
];

export const DESCRIPTIONS: Record<string, string> = {
  xlm: "Stellar Lumens (XLM) is the native coin of the Stellar network, built for fast, cheap payments across borders.",
  usdc: "USDC is a digital dollar on Stellar. It's always worth $1 and easy to send worldwide.",
  eurc: "EURC is a digital euro on Stellar, issued by Circle. It's always worth €1.",
};

export const fmtPrice = (p: number) =>
  p >= 1 ? `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${p.toPrecision(3)}`;

export const getAsset =(id: string) => ASSETS.find((a) => a.id === id);

export const formatUnits = (usd: number, asset: Asset) => {
  const units = usd / asset.price;
  return units >= 1 ? units.toFixed(4) : units.toPrecision(4);
};
