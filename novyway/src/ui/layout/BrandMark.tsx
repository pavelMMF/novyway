// Знак бренда «Новый Путь» — восходящий путь из подтверждённых узлов-ступеней
// к красной стреле вперёд. Тот же знак используется в favicon и PWA-иконках.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} width="100%" height="100%" viewBox="0 0 64 64" role="img" aria-label="Новый Путь">
      <defs><clipPath id="brand-np-mark"><path d="M0 0H64V50L50 64H0Z" /></clipPath></defs>
      <g clipPath="url(#brand-np-mark)">
        <rect width="64" height="64" fill="#111816" />
        <rect x="10" y="42" width="11" height="11" fill="#00a9bd" />
        <rect x="28" y="30" width="11" height="11" fill="#d4a017" />
        <path d="M15 47 34 35 50 22" fill="none" stroke="#f8faf7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M40 22H50V32" fill="none" stroke="#e64232" strokeWidth="4" strokeLinecap="square" />
      </g>
    </svg>
  )
}
