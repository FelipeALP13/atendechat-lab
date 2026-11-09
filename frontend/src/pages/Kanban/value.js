/** Valor da oportunidade: aceita 1500, 1.500,50 ou 1500.50 e mostra em reais. */
export const parseValue = raw => {
  const t = String(raw == null ? "" : raw).trim();
  if (!t) return null;
  const n = Number(t.replace(/\s|R\$/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const formatBRL = n =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Soma os valores dos tickets de uma coluna. */
export const sumTickets = tickets =>
  (tickets || []).reduce((acc, ticket) => {
    const field = ((ticket.contact && ticket.contact.extraInfo) || []).find(f => f.name === "valor");
    return acc + (field ? parseValue(field.value) || 0 : 0);
  }, 0);
