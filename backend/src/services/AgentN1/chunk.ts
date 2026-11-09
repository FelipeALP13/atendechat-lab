export interface Chunk {
  heading: string;
  text: string;
}

/**
 * Divide uma página em trechos de ~1.600 caracteres (cerca de 400 tokens), respeitando títulos.
 * Cada trecho leva o caminho completo no início, porque o mesmo nome de tela existe em módulos diferentes.
 */
export function chunkPage(path: string, title: string, body: string, max = 1600): Chunk[] {
  const out: Chunk[] = [];
  const head = `${path} > ${title}`;
  // Junta seções pequenas no mesmo trecho; os títulos continuam no texto.
  const sections = body.split(/\n(?=#{1,4}\s)/).map((x) => x.trim()).filter(Boolean);
  let buf = "";
  let first = title;
  const flush = () => {
    if (buf.trim()) out.push({ heading: first, text: `${head}\n${buf.trim()}` });
    buf = "";
  };
  for (const sec of sections) {
    const h = ((sec.match(/^#{1,4}\s+(.*)/) || [])[1] || "").trim() || title;
    if (buf && buf.length + sec.length > max) flush();
    if (!buf) first = h;
    if (sec.length > max) {
      // seção grande: quebra por parágrafos
      for (const p of sec.split(/\n{2,}/)) {
        if (buf && buf.length + p.length > max) flush();
        buf += (buf ? "\n\n" : "") + p;
      }
    } else buf += (buf ? "\n\n" : "") + sec;
  }
  flush();
  return out;
}
