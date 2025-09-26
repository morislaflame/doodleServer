const sequelize = require("../db");
const { DataTypes } = require("sequelize");

const User = sequelize.define("user", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: true },
    username: { type: DataTypes.STRING, allowNull: true },
    telegramId: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: "USER" },
    avatar: { type: DataTypes.STRING, allowNull: true },
    balance: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

const Game = sequelize.define("game", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
});

User.hasMany(Game, { foreignKey: "user_id", as: "games" });
Game.belongsTo(User, { foreignKey: "user_id", as: "user" });



module.exports = {
    User,
    Game,
};