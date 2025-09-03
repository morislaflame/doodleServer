const Router = require("express");
const router = new Router();
const gameController = require("../controllers/gameController");
const authMiddleware = require("../middlewares/authMiddleware");

// Создание новой игры
router.post("/create", authMiddleware, gameController.createGame);

// Сохранение очков
router.post("/save-score", authMiddleware, gameController.saveScore);

// Получение игр пользователя
router.get("/my-games", authMiddleware, gameController.getUserGames);

// Получение лучшего результата пользователя
router.get("/best-score", authMiddleware, gameController.getBestScore);

// Глобальный лидерборд
router.get("/leaderboard", gameController.getLeaderboard);

module.exports = router;