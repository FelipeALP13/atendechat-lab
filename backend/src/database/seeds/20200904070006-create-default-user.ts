import { QueryInterface } from "sequelize";
import { hash } from "bcryptjs";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error(
        "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set before running the default user seed"
      );
    }

    return queryInterface.sequelize.transaction(async t => {
      const userExists = await queryInterface.rawSelect('Users', {
        where: {
          id: 1,
        },
      }, ['id']);

      if (!userExists) {
        const passwordHash = await hash(adminPassword, 8);
        return queryInterface.bulkInsert('Users', [{
          name: "Admin",
          email: adminEmail,
          profile: "admin",
          passwordHash,
          companyId: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          super: true
        }], { transaction: t });
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.bulkDelete("Users", { id: 1 });
  }
};
