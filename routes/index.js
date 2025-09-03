const Router = require('express');

const userRouter = require('./userRouter');
const gameRouter = require('./gameRouter');

const router = new Router();

router.use('/user', userRouter);
router.use('/game', gameRouter);

module.exports = router;

