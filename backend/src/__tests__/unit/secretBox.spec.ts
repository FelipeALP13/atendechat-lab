process.env.SECRETS_KEY = "teste-chave-mestra-com-mais-de-32-caracteres-123";

import { decryptSecret, encryptSecret, isEncrypted, isMaskedOrEmpty, maskSecret, redactAiSettings } from "../../helpers/secretBox";

describe("secretBox", () => {
  it("criptografa e abre de volta", () => {
    const saved = encryptSecret("sk-teste-1234567890abcd") as string;
    expect(isEncrypted(saved)).toBe(true);
    expect(saved).not.toContain("sk-teste");
    expect(decryptSecret(saved)).toBe("sk-teste-1234567890abcd");
  });

  it("cada gravação gera um valor diferente (IV aleatório)", () => {
    expect(encryptSecret("mesma-chave")).not.toBe(encryptSecret("mesma-chave"));
  });

  it("não criptografa duas vezes", () => {
    const once = encryptSecret("abc") as string;
    expect(encryptSecret(once)).toBe(once);
  });

  it("lê chave antiga em texto puro (legado)", () => {
    expect(decryptSecret("sk-legado")).toBe("sk-legado");
    expect(decryptSecret("")).toBe("");
    expect(decryptSecret(null)).toBe("");
  });

  it("valor adulterado não abre", () => {
    const saved = encryptSecret("segredo") as string;
    const broken = saved.slice(0, -4) + (saved.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(decryptSecret(broken)).toBe("");
  });

  it("mascara mostrando só o fim", () => {
    expect(maskSecret(encryptSecret("sk-abcdefWXYZ"))).toBe("••••WXYZ");
    expect(maskSecret("")).toBe("");
    expect(isMaskedOrEmpty("••••WXYZ")).toBe(true);
    expect(isMaskedOrEmpty("  ")).toBe(true);
    expect(isMaskedOrEmpty(undefined)).toBe(true);
    expect(isMaskedOrEmpty("sk-nova")).toBe(false);
  });

  it("tira a chave das configurações de IA do atendimento", () => {
    const data = { type: "openai", settings: { model: "gpt", apiKey: "enc:v1:x" } };
    const safe = redactAiSettings(data);
    expect(safe.settings.apiKey).toBe("••••");
    expect(safe.settings.model).toBe("gpt");
    expect(data.settings.apiKey).toBe("enc:v1:x"); // não altera o original
    expect(redactAiSettings({ variables: { a: "1" } })).toEqual({ variables: { a: "1" } });
    expect(redactAiSettings(null)).toBeNull();
  });
});
