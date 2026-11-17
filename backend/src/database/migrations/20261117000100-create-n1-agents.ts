import { QueryInterface, DataTypes } from "sequelize";

/**
 * Agente N1 (Claude): configuração por empresa e estado do agente em cada atendimento.
 * - N1Agents: liga/desliga, conexões onde atua, fila do N2, instruções, chaves (criptografadas).
 * - Tickets.n1Status: "active" (N1 conversando), "handed_off" (passou para a equipe) ou null.
 * - Tickets.n1Turns: quantas mensagens do cliente o N1 já respondeu neste atendimento.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("N1Agents", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      companyId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "Companies", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      name: { type: DataTypes.STRING, allowNull: false, defaultValue: "Assistente" },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      whatsappIds: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      handoffQueueId: { type: DataTypes.INTEGER, allowNull: true, references: { model: "Queues", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
      instructions: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      apiKey: { type: DataTypes.TEXT, allowNull: true },
      model: { type: DataTypes.STRING, allowNull: false, defaultValue: "claude-opus-5-5" },
      effort: { type: DataTypes.STRING, allowNull: false, defaultValue: "medium" },
      maxTurns: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 8 },
      portalUrl: { type: DataTypes.STRING, allowNull: true },
      portalKey: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("N1Agents", ["companyId"], { unique: true, name: "n1_agents_company_unique" });
    await queryInterface.addColumn("Tickets", "n1Status", { type: DataTypes.STRING, allowNull: true });
    await queryInterface.addColumn("Tickets", "n1Turns", { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tickets", "n1Turns");
    await queryInterface.removeColumn("Tickets", "n1Status");
    await queryInterface.dropTable("N1Agents");
  }
};
