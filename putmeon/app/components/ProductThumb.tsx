import type { Category } from "@/lib/types";

// Lightweight, always-offline garment silhouette filled with the product color.
// Stands in for real product photography in the prototype.
export function ProductThumb({
  category,
  colorHex,
  className = "",
}: {
  category: Category;
  colorHex: string;
  className?: string;
}) {
  const stroke = "rgba(0,0,0,0.18)";
  const c = colorHex || "#cccccc";
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`${category} ${colorHex}`}
    >
      <defs>
        <linearGradient id={`bg-${category}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6f1ea" />
          <stop offset="100%" stopColor="#eadfd2" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#bg-${category})`} />
      {shape(category, c, stroke)}
    </svg>
  );
}

function shape(category: Category, c: string, stroke: string) {
  switch (category) {
    case "top":
    case "jacket":
      return (
        <path
          d="M35 22 L28 30 L22 40 L30 46 L33 42 L33 78 L67 78 L67 42 L70 46 L78 40 L72 30 L65 22 L58 26 Q50 32 42 26 Z"
          fill={c}
          stroke={stroke}
          strokeWidth="1.2"
        />
      );
    case "pants":
      return (
        <path
          d="M37 22 L63 22 L66 50 L60 82 L52 82 L50 52 L48 82 L40 82 L34 50 Z"
          fill={c}
          stroke={stroke}
          strokeWidth="1.2"
        />
      );
    case "dress":
      return (
        <path
          d="M40 22 Q50 28 60 22 L66 40 L62 46 L66 82 L34 82 L38 46 L34 40 Z"
          fill={c}
          stroke={stroke}
          strokeWidth="1.2"
        />
      );
    case "skirt":
      return (
        <path
          d="M36 36 L64 36 L72 78 L28 78 Z"
          fill={c}
          stroke={stroke}
          strokeWidth="1.2"
        />
      );
    case "bag":
      return (
        <g fill="none" stroke={stroke} strokeWidth="1.2">
          <path d="M38 40 Q50 24 62 40" />
          <rect x="32" y="40" width="36" height="36" rx="4" fill={c} />
        </g>
      );
    case "shoes":
      return (
        <path
          d="M24 56 L24 44 L38 44 L46 54 L74 60 Q80 62 80 68 L80 72 L24 72 Z"
          fill={c}
          stroke={stroke}
          strokeWidth="1.2"
        />
      );
    default:
      return <rect x="30" y="30" width="40" height="40" rx="6" fill={c} />;
  }
}
