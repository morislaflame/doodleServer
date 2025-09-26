const ApiError = require("../errors/ApiError");
const { validate, parse } = require("@telegram-apps/init-data-node");
const sequelize = require("../db");
const {
  User,
} = require("../models/models");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const generateJwt = (user) => {
  const payload = {
    id: user.id,
    role: user.role,
  };

  if (user.email) {
    payload.email = user.email;
  }

  if (user.username) {
    payload.username = user.username;
  }

  if (user.telegramId) {
    payload.telegramId = user.telegramId;
  }

  return jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "24h" });
};

class UserController {
  async registration(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { email, password, telegramId } = req.body;

      if (!email || !password) {
        await transaction.rollback();
        return next(ApiError.badRequest("Incorrect email or password"));
      }

      const candidate = await User.findOne({ where: { email }, transaction });

      if (candidate) {
        await transaction.rollback();
        return next(ApiError.badRequest("User with this email already exists"));
      }

      const hashPassword = await bcrypt.hash(password, 5);

      // Create the user
      const user = await User.create(
        {
          email,
          password: hashPassword,
          role: "USER",
          telegramId,
        },
        { transaction }
      );

      await transaction.commit();

      const token = generateJwt(user);

      return res.json({ token });
    } catch (e) {
      await transaction.rollback();

      console.error("Error during registration:", e);
      next(ApiError.internal(e.message));
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return next(ApiError.badRequest("Email and password are required"));
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return next(ApiError.notFound("User not found"));
      }

      let comparePassword = bcrypt.compareSync(password, user.password);
      if (!comparePassword) {
        return next(ApiError.badRequest("Incorrect password"));
      }

      const token = generateJwt(user);

      return res.json({ token });
    } catch (e) {
      console.error("Error during login:", e);
      next(ApiError.internal(e.message));
    }
  }
  // === 1) Авторизация через Telegram MiniApp ===
  // controllers/userController.js

  // controllers/userController.js
  async telegramAuth(req, res, next) {
    const BOT_TOKEN = process.env.TELEGRAM_TOKEN;

    try {
      const { initData } = req.body;
      if (!initData) return next(ApiError.badRequest("initData is required"));

      let initDataParsed;
      try {
        validate(initData, BOT_TOKEN, { expiresIn: 3600 });
        initDataParsed = parse(initData);
        console.log(initDataParsed);
      } catch (error) {
        console.error("Telegram auth failed:", error);
        return next(ApiError.unauthorized("Invalid initData"));
      }

      const userData = initDataParsed.user;
      if (!userData?.id) return next(ApiError.badRequest("User data missing"));

      let user = await User.findOne({ where: { telegramId: userData.id } });
      let isNewUser = false;

      if (!user) {
        isNewUser = true;
        user = await User.create({
          telegramId: userData.id,
          username: userData.username || null,
          imageUrl: userData.photo_url || null,
          language: userData.language_code || null,
          role: "USER",
        });
      } else if (userData.photo_url && user.imageUrl !== userData.photo_url) {
        user.imageUrl = userData.photo_url;
        await user.save();
      }

      const token = generateJwt(user);
      return res.json({ token });
    } catch (error) {
      console.error("Telegram auth failed:", error);
      next(ApiError.internal("Telegram auth error"));
    }
  }

  async auth(req, res, next) {
    try {
      // Опционально: загрузить пользователя из базы данных для получения актуальных данных
      const user = await User.findOne({ where: { id: req.user.id } });

      if (!user) {
        return next(ApiError.notFound("User not found"));
      }

      const token = generateJwt(user);

      return res.json({ token });
    } catch (e) {
      next(ApiError.internal(e.message));
    }
  }

  async getMyInfo(req, res, next) {
    try {
      const user = await User.findOne({ where: { id: req.user.id } });
      if (!user) {
        return next(ApiError.notFound("User not found"));
      }

      return res.json(user);
    } catch (e) {
      next(ApiError.internal(e.message));
    }
  }

  async getTopUsers(req, res, next) {
    try {
      const topUsers = await User.findAll({
        attributes: ["id", "balance", "username"],
        order: [["balance", "DESC"]],
        limit: 50,
      });
      return res.json(topUsers);
    } catch (error) {
      console.error("Error in getTopUsers:", error);
      return next(
        ApiError.internal("Something went wrong while fetching top users")
      );
    }
  }
}

module.exports = new UserController();