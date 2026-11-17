process.env.SECRETS_KEY = "teste-chave-mestra-com-mais-de-32-caracteres-123";

// O ambiente do Jest deste projeto não expõe fetch; a biblioteca da OpenAI pede este ajuste no Node.
import "openai/shims/node";

import { asksForHuman, customerFirstName, openAiClient } from "../../services/IntegrationsServices/aiShared";
import { encryptSecret } from "../../helpers/secretBox";

describe("aiShared", () => {
  it("primeiro nome mantém acentos", () => {
    expect(customerFirstName("José da Silva")).toBe("José");
    expect(customerFirstName("Márcia")).toBe("Márcia");
    expect(customerFirstName("  ")).toBe("Amigo(a)");
    expect(customerFirstName("😀 Ana")).toBe("Amigo(a)");
    expect(customerFirstName(null)).toBe("Amigo(a)");
  });

  it("só transfere com pedido claro de falar com uma pessoa", () => {
    expect(asksForHuman("Quero falar com um atendente")).toBe(true);
    expect(asksForHuman("pode me transferir? quero falar com alguém")).toBe(true);
    expect(asksForHuman("ATENDIMENTO HUMANO por favor")).toBe(true);
    // Antes estes três transferiam o cliente no meio da conversa:
    expect(asksForHuman("não entendi a segunda parte")).toBe(false);
    expect(asksForHuman("isso não funciona no meu celular, o que faço?")).toBe(false);
    expect(asksForHuman("não estou conseguindo entrar")).toBe(false);
  });

  it("reaproveita o cliente pela chave, e a chave criptografada vale o mesmo que a aberta", () => {
    const plain = openAiClient("sk-teste-reaproveitar");
    const again = openAiClient(encryptSecret("sk-teste-reaproveitar") as string);
    expect(again).toBe(plain);
    expect(openAiClient("sk-outra-chave")).not.toBe(plain);
  });
});
