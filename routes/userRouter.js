const Router = require("express");
const router = new Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");
const detectAuth = require("../middlewares/detectAuthMiddleware");

router.post(
    "/registration",
    detectAuth,
    userController.registration
  );
  router.post("/login", detectAuth, userController.login);
  
  router.get("/auth", authMiddleware, userController.auth);
  
  router.post(
    "/auth/telegram",
    detectAuth,
    userController.telegramAuth
  );
  
  router.get("/me", authMiddleware, userController.getMyInfo);
  router.get("/top", userController.getTopUsers);

  module.exports = router;