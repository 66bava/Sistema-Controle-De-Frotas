export function criarAssinatura(canvas, aoMudar) {
  const events = new AbortController();
  const ctx = canvas.getContext('2d');
  let enabled = true,
    drawing = false,
    pointer = null,
    last = null,
    comprimento = 0,
    w = 0,
    h = 0;
  function limpar() {
    drawing = false;
    pointer = null;
    last = null;
    comprimento = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const rect = canvas.getBoundingClientRect();
    ctx.setTransform(canvas.width / rect.width, 0, 0, canvas.height / rect.height, 0, 0);
    ctx.strokeStyle = '#172b41';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    aoMudar(false);
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const width = Math.min(1600, Math.round(rect.width * (window.devicePixelRatio || 1)));
    const height = Math.min(800, Math.round(rect.height * (window.devicePixelRatio || 1)));
    if (width === w && height === h) return;
    w = width;
    h = height;
    canvas.width = width;
    canvas.height = height;
    limpar();
  }
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (!enabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      drawing = true;
      pointer = event.pointerId;
      last = point(event);
      canvas.setPointerCapture(pointer);
    },
    { signal: events.signal }
  );
  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (!drawing || !enabled || event.pointerId !== pointer) return;
      event.preventDefault();
      const next = point(event);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      comprimento += Math.hypot(next.x - last.x, next.y - last.y);
      last = next;
      aoMudar(comprimento >= 20);
    },
    { signal: events.signal }
  );
  function stop(event) {
    if (event.pointerId === pointer) {
      drawing = false;
      pointer = null;
      last = null;
    }
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    canvas.addEventListener(name, stop, { signal: events.signal });
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  return {
    limpar,
    habilitar(value) {
      enabled = value;
      canvas.setAttribute('aria-disabled', String(!value));
      if (!value) drawing = false;
    },
    exportar() {
      if (comprimento < 20) throw new Error('Desenhe sua assinatura antes de confirmar.');
      return canvas.toDataURL('image/png');
    },
    destruir() {
      events.abort();
      observer.disconnect();
    },
  };
}
