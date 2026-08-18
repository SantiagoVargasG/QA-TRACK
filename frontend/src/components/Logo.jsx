// Isotipo genérico para QA Tracker: un cuadrado con contraste según el tema
function LogoIsotipo({ className = '', variant = 'dark' }) {
  const color = variant === 'light' ? '#ffffff' : '#6c2cc9';
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect x="10" y="10" width="80" height="80" fill={color} rx="8" />
    </svg>
  );
}

// Wordmark "TRACKER": mayúsculas, tracking amplio, extra bold, Montserrat (font-headline)
function Wordmark({ className = '', colorTexto }) {
  return (
    <span className={`font-headline font-extrabold uppercase leading-none tracking-[0.25em] ${colorTexto} ${className}`}>
      Tracker
    </span>
  );
}

// Logo editable con dos layouts: inline (ícono + texto en fila) y stacked (ícono arriba, texto abajo)
// `variant="light"` es para fondos oscuros — el isotipo tiene contraste propio, solo el wordmark se adapta
// `size="sm"` (navbar, más compacto) vs `size="md"` (default, encabezados)
function Logo({ className = '', variant = 'dark', layout = 'inline', size = 'md' }) {
  const colorTexto = variant === 'light' ? 'text-white' : 'text-on-surface';

  if (layout === 'stacked') {
    return (
      <span className={`flex flex-col items-start ${className}`}>
        <LogoIsotipo className="h-10 w-auto" variant={variant} />
        <Wordmark className="mt-2 text-sm" colorTexto={colorTexto} />
      </span>
    );
  }

  const iconoAlto = size === 'sm' ? 'h-4' : 'h-6';
  const gap = size === 'sm' ? 'gap-1.5' : 'gap-2';
  const textoTamano = size === 'sm' ? 'text-xs' : 'text-label-md';
  // El isotipo tiene su masa visual (las crestas de la onda) por encima del centro
  // geométrico de su propio bounding box, aunque el bbox en sí esté centrado — el texto,
  // centrado por bbox, termina viéndose "bajo" respecto al ícono. Se compensa subiendo el
  // wordmark un poco en vez de perseguir un centrado geométrico que no coincide con el
  // centrado óptico.
  const nudge = size === 'sm' ? '-translate-y-[2px]' : '-translate-y-[3px]';

  return (
    <span className={`flex items-center ${gap} ${className}`}>
      <LogoIsotipo className={`${iconoAlto} w-auto`} variant={variant} />
      <Wordmark className={`${textoTamano} ${nudge}`} colorTexto={colorTexto} />
    </span>
  );
}

export default Logo;
