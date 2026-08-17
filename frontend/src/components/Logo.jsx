// Isotipo de marca "Mi Oiko" (SVG provisto por el usuario). El trazo claro (`#aa90fe`)
// nunca cambia porque ya contrasta en cualquier fondo, pero el trazo oscuro (`#1b0826`) es
// casi idéntico a `--color-on-surface` (`#1c192c`), el arranque de `brand-panel-gradient` —
// sobre ese fondo la mitad del isotipo se volvía invisible. `variant="light"` pasa ese trazo
// a blanco para que el isotipo completo se vea sobre fondos oscuros.
// El copy del producto sigue siendo "Track" (ver Wordmark más abajo) — el logo completo
// "MI OIKO" que compartió el usuario es la referencia de qué TIPOGRAFÍA usar (mayúsculas,
// tracking amplio, extra bold), no de qué palabra mostrar.
function LogoIsotipo({ className = '', variant = 'dark' }) {
  const colorOscuro = variant === 'light' ? '#ffffff' : '#1b0826';
  return (
    <svg viewBox="130 720 1540 360" className={className} aria-hidden="true">
      <path
        fill={colorOscuro}
        d="m1401.68,1057.2c-69.57.48-139.16,1.24-208.71-.24-48.76-1.04-94.2-15.77-136.92-39.25-42.53-23.38-74.91-56.62-98.49-98.77-5.69-10.17-11.85-20.08-17.84-30.09-3.08-5.14-6.35-10.14-10.58-14.47-15.05-15.4-34.86-14.34-48.21,2.63-5.69,7.23-9.71,15.47-14.21,23.42-15.61,27.55-30,55.83-46.93,82.6-23.34,36.9-55.83,62.19-99.05,71.11-50.13,10.34-94.61-2.14-132.77-36.6-17.96-16.22-29.03-37.1-40.25-57.92-12.78-23.72-25.47-47.48-38.26-71.2-3.3-6.13-7.3-11.8-12.31-16.68-11.26-10.95-28.01-11.54-39.93-1.36-5.07,4.33-9.36,9.36-12.88,15.02-27.83,44.68-55.79,89.27-83.38,134.1-9.54,15.51-21.19,28.15-38.8,34.34-9.01,3.17-19.91,3.68-19.91,3.68-7.39.72-12.16.49-21.02.33-9.9-.18-19.81.04-29.71,0-13.2-.06-26.41,0-39.61,0h-61.89s24.27-39.11,30.47-49.07c51.08-82.07,56.34-87.26,98.53-151.92,10.67-16.36,20-33.68,32.35-48.85,40.16-49.32,92.03-71.81,155.35-63.19,48.77,6.64,85.65,33.14,110.37,75.53,15.87,27.22,30.38,55.22,45.53,82.85,1.59,2.9,3.29,5.75,5.17,8.47,13.67,19.67,36.62,20.63,51.86,2.17,8-9.68,13.06-21.16,19.25-31.94,13.58-23.63,25.53-48.19,40.4-71.08,38.01-58.46,114.97-83.24,180.11-58.24,24.98,9.59,45.93,24.76,63.63,44.63,1.25,1.4,2.61,2.71,3.92,4.06,7.29,9.08,13.78,18.74,20.14,28.47,14.98,22.91,30.19,45.63,48.74,65.9,5.51,6.02,10.5,12.59,17.84,16.64,1.94,3.28,4.31,6.18,7.16,8.74,17.63,15.84,36.5,30.06,56.64,42.52,47.74,29.52,98.91,51.36,152.56,67.61,1.53.46,3.02.89,4.63.68,3.23,1.24,6.38,2.81,9.72,3.67,22.59,5.84,45.1,11.98,68.13,15.99,9.76,1.7,19.62,2.97,29.18,5.75Z"
      />
      <path
        fill="#aa90fe"
        d="m1401.68,1057.2c-9.55-2.78-19.42-4.05-29.18-5.75-23.03-4.01-45.54-10.15-68.13-15.99-3.33-.86-6.48-2.43-9.72-3.67,13.86-4.26,27.97-7.58,41.77-12.12,44.98-14.82,87.97-33.9,128.02-59.26,18.52-11.72,36.82-23.87,52.35-39.54,10.5-10.59,14.18-23.65,11.51-38.25-4.62-25.22-28.63-44.73-55.41-44.77-90.53-.14-181.07-.1-271.6-.12-26.02,0-52.05-.23-78.07.1-30.74.39-67.79,31.96-49.56,74.41-7.34-4.05-12.33-10.62-17.84-16.64-18.54-20.27-33.76-42.99-48.74-65.9-6.36-9.73-12.85-19.39-20.14-28.47,10.48-13.13,23.59-23.17,37.91-31.63,30.31-17.89,63.27-26.68,98.37-26.77,95.91-.23,191.82-.21,287.72-.13,27.6.02,55.37-2.16,82.76,1.04,69.13,8.08,120.66,41.71,148.72,107.08,11.9,27.74,9.71,54.44-6.31,80.37-19.76,31.98-46.85,56.26-78.02,76.45-36.43,23.61-75.96,39.57-118.77,47.26-12.48,2.24-25.04,2.64-37.66,2.28Z"
      />
    </svg>
  );
}

// Wordmark "TRACK" con la misma tipografía que "MI OIKO" en el logo completo provisto por
// el usuario: mayúsculas, tracking amplio, extra bold, Montserrat (font-headline) — solo
// cambia la palabra, no el tratamiento tipográfico.
function Wordmark({ className = '', colorTexto }) {
  return (
    <span className={`font-headline font-extrabold uppercase leading-none tracking-[0.25em] ${colorTexto} ${className}`}>
      Track
    </span>
  );
}

// Placeholder editable: si el isotipo cambia, solo se reemplazan los <path> de arriba —
// el resto de la app referencia siempre este componente (TopBar, LoginPage,
// RegistroTenantPage — ver grep de "<Logo" en frontend/src), nunca un SVG inline duplicado,
// así el tamaño/tratamiento se ajusta en un solo lugar.
// `variant="light"` es para fondos oscuros (ej. el panel de marca de LoginPage/
// RegistroTenantPage) — el isotipo ya tiene contraste propio, solo el wordmark necesita
// pasar a blanco.
// `layout="inline"` (default, ícono + texto en fila — navbar, espacios angostos) vs
// `layout="stacked"` (ícono arriba, texto abajo, como el archivo de marca original — para
// los paneles grandes de Login/RegistroTenantPage). Ninguno de los dos fuerza el ícono a un
// cuadrado (solo se fija el alto, el ancho sigue el aspect-ratio real del SVG) para no
// distorsionarlo.
// `size="sm"` (topbar, ya logueado, más compacto) vs `size="md"` (default, encabezado móvil
// de login/registro) — mismo criterio que maneja el usuario en otras plataformas propias: el
// logo se ve más chico una vez dentro de la app que en las pantallas de autenticación.
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
