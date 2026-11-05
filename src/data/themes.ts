export interface CardTheme {
  id: string;
  label: string;
  /** Tailwind background classes; "asset" means use the asset's own gradient */
  bg: string;
  tagline?: string;
}

export const CARD_THEMES: CardTheme[] = [
  { id: "asset", label: "Classic", bg: "asset" },
  { id: "love", label: "With Love", bg: "bg-gradient-to-br from-rose-400 via-pink-500 to-red-500", tagline: "With love" },
  { id: "thanks", label: "Thank You", bg: "bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500", tagline: "Thank you" },
  { id: "anniversary", label: "Anniversary", bg: "bg-gradient-to-br from-rose-400 via-yellow-300 to-pink-400", tagline: "Happy Anniversary" },
  { id: "birthday", label: "Birthday", bg: "bg-gradient-to-br from-orange-400 via-rose-400 to-blue-700", tagline: "Happy Birthday" },
  { id: "holiday", label: "Holiday", bg: "bg-gradient-to-br from-red-700 via-red-600 to-amber-500", tagline: "Happy Holidays" },
];
