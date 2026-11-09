/**
 * Acesso ao banco do Agente N1. `Run` executa SQL com parâmetros $1, $2… e devolve as linhas.
 * Em produção usa o Sequelize do sistema; nos testes, um pool do pg. Toda consulta filtra por companyId.
 */
export type Run = (sql: string, params?: unknown[]) => Promise<any[]>;

export interface Store {
  companyId: number;
  run: Run;
}

export const makeStore = (companyId: number, run: Run): Store => ({ companyId, run });

export const one = async <T = any>(s: Store, sql: string, params: unknown[] = []): Promise<T | undefined> => (await s.run(sql, params))[0];
