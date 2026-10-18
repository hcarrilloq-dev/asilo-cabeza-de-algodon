// Marca del asilo: una mota de algodón dibujada con círculos suaves.
export default function Algodon({ className = '', color = 'currentColor' }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" fill="none">
      <circle cx="22" cy="26" r="12" fill={color} />
      <circle cx="40" cy="22" r="13" fill={color} />
      <circle cx="44" cy="38" r="11" fill={color} />
      <circle cx="26" cy="40" r="11" fill={color} />
      <circle cx="33" cy="31" r="10" fill={color} />
      <path d="M33 46 L33 60 M33 54 L26 50 M33 52 L40 48" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
