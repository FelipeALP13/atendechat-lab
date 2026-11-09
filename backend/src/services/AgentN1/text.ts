/** Normalização simples para português: sem acento, minúsculo, "radical" de 6 letras. */
const STOP = new Set(
  "a o as os um uma uns umas de do da dos das em no na nos nas por para pra com sem sobre entre e ou mas que se qual quais quem onde quando como porque pq eu voce vc voces meu minha meus minhas seu sua nosso nossa ele ela eles elas isso isto esse essa esses essas este esta aquele aquela ja so tambem muito muita mais menos ser estar ter ha foi sao era vai vou posso pode podem preciso precisa quero queria gostaria fazer faco faz fazem dar da dou existe existem tem tenho temos algum alguma alguns algumas dois duas tres mesmo mesma mesmos mesmas favor oi ola bom boa dia tarde noite obrigado obrigada ajuda duvida sistema tela sge funciona usar uso cliente clientes quantos quantas coloco vai varios varias vez vezes errado errada avulso avulsa quem cada alguem tudo todo toda todos todas ainda agora aqui la ali depois antes".split(" "),
);

/** Verbos e termos que a equipe usa de formas diferentes. Aplicado igual na pergunta e na documentação. */
const GROUPS = [
  "alterar mudar trocar modificar editar atualizar corrigir",
  "gerar exportar emitir baixar",
  "enviar mandar disparar",
  "consultar ver visualizar localizar pesquisar buscar achar",
  "cancelar desfazer",
  "bloquear suspender",
  "cadastrar incluir criar registrar",
  "desativar inativar",
];
const CANON = new Map<string, string>();
for (const g of GROUPS) {
  const [head, ...rest] = g.split(" ");
  for (const w of [head, ...rest]) {
    CANON.set(w, head);
    // formas conjugadas comuns: usa o radical de 5 letras do verbo
    CANON.set(w.replace(/ar$/, "o"), head);
    CANON.set(w.replace(/ar$/, "ou"), head);
    CANON.set(w.replace(/ar$/, "ei"), head);
    CANON.set(w.replace(/ar$/, "a"), head);
    CANON.set(w.replace(/ar$/, "e"), head);
    CANON.set(w.replace(/ar$/, "ado"), head);
    CANON.set(w.replace(/ar$/, "ao"), head);
  }
}
CANON.set("ver", "consultar"); CANON.set("vejo", "consultar"); CANON.set("veja", "consultar");
CANON.set("mudo", "alterar"); CANON.set("gero", "gerar"); CANON.set("faco", "fazer");

export const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const STEM_LEN = Number(process.env.N1_STEM_LEN || 5);
export const stem = (w: string) => w.slice(0, STEM_LEN);

export function tokens(s: string): string[] {
  return (fold(s).match(/[a-z0-9]+/g) || []).map((t) => CANON.get(t) || t);
}

/** Termos úteis de uma pergunta: sem palavras vazias, já em radical. */
export function queryStems(s: string): string[] {
  return [...new Set(tokens(s).filter((t) => t.length > 2 && !STOP.has(t)).map(stem))];
}

export const stemText = (s: string) => tokens(s).map(stem).join(" ");

export function jaccard(a: string, b: string): number {
  const A = new Set(queryStems(a));
  const B = new Set(queryStems(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Remove dados pessoais antes de guardar uma resposta como conhecimento. */
export const anonymize = (text: string): string =>
  text
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ]")
    .replace(/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, "[TELEFONE]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]");
