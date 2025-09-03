const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const { User, Game } = require("../models/models");

class GameController {
    // Создание новой игры
    async createGame(req, res, next) {
        const transaction = await sequelize.transaction();
        
        try {
            const userId = req.user.id;
            
            // Проверяем существование пользователя
            const user = await User.findByPk(userId, { transaction });
            if (!user) {
                await transaction.rollback();
                return next(ApiError.notFound("User not found"));
            }
            
            // Создаем новую игру
            const game = await Game.create({
                user_id: userId,
                points: 0
            }, { transaction });
            
            await transaction.commit();
            
            return res.json({
                id: game.id,
                points: game.points,
                createdAt: game.createdAt
            });
        } catch (error) {
            await transaction.rollback();
            console.error("Error creating game:", error);
            next(ApiError.internal("Failed to create game"));
        }
    }
    
    // Сохранение очков игры
    async saveScore(req, res, next) {
        const transaction = await sequelize.transaction();
        
        try {
            const { gameId, points } = req.body;
            const userId = req.user.id;
            
            if (!gameId || points === undefined || points < 0) {
                await transaction.rollback();
                return next(ApiError.badRequest("Game ID and valid points are required"));
            }
            
            // Находим игру и проверяем принадлежность пользователю
            const game = await Game.findOne({
                where: { 
                    id: gameId,
                    user_id: userId 
                },
                transaction
            });
            
            if (!game) {
                await transaction.rollback();
                return next(ApiError.notFound("Game not found or access denied"));
            }
            
            // Обновляем очки только если новые очки больше текущих
            if (points > game.points) {
                await game.update({ points }, { transaction });
                
                // Обновляем баланс пользователя (можно добавить логику начисления)
                const user = await User.findByPk(userId, { transaction });
                const pointsEarned = points - game.points;
                await user.update({ 
                    balance: user.balance + pointsEarned 
                }, { transaction });
            }
            
            await transaction.commit();
            
            return res.json({
                id: game.id,
                points: Math.max(points, game.points),
                updatedAt: new Date()
            });
        } catch (error) {
            await transaction.rollback();
            console.error("Error saving score:", error);
            next(ApiError.internal("Failed to save score"));
        }
    }
    
    // Получение лучших игр пользователя
    async getUserGames(req, res, next) {
        try {
            const userId = req.user.id;
            const { limit = 10, offset = 0 } = req.query;
            
            const games = await Game.findAll({
                where: { user_id: userId },
                order: [['points', 'DESC'], ['createdAt', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
                attributes: ['id', 'points', 'createdAt', 'updatedAt']
            });
            
            return res.json(games);
        } catch (error) {
            console.error("Error fetching user games:", error);
            next(ApiError.internal("Failed to fetch games"));
        }
    }
    
    // Получение лучшего результата пользователя
    async getBestScore(req, res, next) {
        try {
            const userId = req.user.id;
            
            const bestGame = await Game.findOne({
                where: { user_id: userId },
                order: [['points', 'DESC']],
                attributes: ['id', 'points', 'createdAt']
            });
            
            if (!bestGame) {
                return res.json({ points: 0 });
            }
            
            return res.json(bestGame);
        } catch (error) {
            console.error("Error fetching best score:", error);
            next(ApiError.internal("Failed to fetch best score"));
        }
    }
    
    // Получение глобального лидерборда
    async getLeaderboard(req, res, next) {
        try {
            const { limit = 50 } = req.query;
            
            const leaderboard = await Game.findAll({
                attributes: [
                    [sequelize.fn('MAX', sequelize.col('points')), 'bestScore'],
                    'user_id'
                ],
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'telegramId']
                }],
                group: ['user_id', 'user.id'],
                order: [[sequelize.fn('MAX', sequelize.col('points')), 'DESC']],
                limit: parseInt(limit)
            });
            
            return res.json(leaderboard);
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
            next(ApiError.internal("Failed to fetch leaderboard"));
        }
    }
}

module.exports = new GameController();