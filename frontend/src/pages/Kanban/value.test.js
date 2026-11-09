import { formatBRL, parseValue, sumTickets } from "./value";

const ticket = valor => ({ contact: { extraInfo: valor === null ? [] : [{ name: "valor", value: valor }] } });

test("aceita os jeitos que a pessoa digita o valor", () => {
  expect(parseValue("1500")).toBe(1500);
  expect(parseValue("1.500,50")).toBe(1500.5);
  expect(parseValue("1500.50")).toBe(1500.5);
  expect(parseValue("R$ 2.000,00")).toBe(2000);
  expect(parseValue("0,99")).toBe(0.99);
});

test("texto sem número não vira zero escondido", () => {
  expect(parseValue("abc")).toBeNull();
  expect(parseValue("")).toBeNull();
  expect(parseValue(null)).toBeNull();
});

test("mostra em reais no formato do Brasil", () => {
  expect(formatBRL(1500.5).replace(/ /g, " ")).toBe("R$ 1.500,50");
  expect(formatBRL(0).replace(/ /g, " ")).toBe("R$ 0,00");
});

test("soma da coluna ignora cartão sem valor e valor inválido", () => {
  expect(sumTickets([ticket("1.000,00"), ticket("500"), ticket(null), ticket("abc")])).toBe(1500);
  expect(sumTickets([])).toBe(0);
  expect(sumTickets([{ contact: {} }])).toBe(0);
});
