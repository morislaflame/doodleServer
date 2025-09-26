// botInstance.js
require("dotenv").config();
const { Bot, GrammyError, HttpError, InlineKeyboard } = require("grammy");

const bot = new Bot(process.env.TELEGRAM_TOKEN);
const keyboard = new InlineKeyboard().url(
  "Играть",
  "https://t.me/doodlekitty_bot?startapp"
);

// Здесь же настраиваем обработчики
(async () => {
  try {
    await bot.api.setMyCommands([
      { command: "/start", description: "" },
    ]);
  } catch (err) {
    console.error("Failed to set bot commands:", err);
  }
})();

bot.command("start", async (ctx) => {
  try {
    await ctx.replyWithPhoto(
      "https://i.pinimg.com/736x/db/5c/f8/db5cf822892449074d7b6bbfb68b1d1e.jpg",
      {
        caption: "Готовь лапки и ставь рекорды в игре!",
        reply_markup: keyboard,
      }
    );
  } catch (err) {
    if (err.error_code === 403) {
      console.warn(`User ${ctx.from?.id} blocked the bot`);
    } else {
      console.error("Failed to send /start photo:", err);
    }
  }
});

bot.command("help", async (ctx) => {
  try {
    await ctx.reply("Support: @Rocket_Raffle");
  } catch (err) {
    console.error(`Failed to send help message to user ${ctx.from?.id}:`, err);
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true);
  } catch (err) {
    console.error("answerPreCheckoutQuery failed:", err);
    try {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: "Something went wrong with your order",
      });
    } catch (fallbackErr) {
      console.error("Failed to reject pre-checkout properly:", fallbackErr);
    }
  }
});

bot.on("message:successful_payment", async (ctx) => {
  try {
    const sp = ctx.message?.successful_payment;
    if (!sp) return;

    const { invoice_payload, telegram_payment_charge_id } = sp;
    let data = {};
    try {
      data = JSON.parse(invoice_payload);
    } catch (parseErr) {
      console.warn("Failed to parse invoice payload:", parseErr);
    }

    const orderId = data.orderId;
    if (!orderId) {
      console.warn("No orderId in payload:", data);
      return;
    }

    const { Order, User, AttemptTransaction, UserCase, Case } = require("../models/models");
    const order = await Order.findByPk(orderId);
    if (!order) {
      console.warn("Order not found:", orderId);
      return;
    }

    if (order.status !== "initial") {
      console.log("Order already processed:", orderId);
      return;
    }

    // Mark as paid
    order.status = "paid";
    order.telegramPaymentChargeId = telegram_payment_charge_id;
    await order.save();

    // Проверяем тип заказа
    const metadata = order.metadata || {};
    
    if (metadata.type === 'case_purchase') {
      // Обработка покупки кейса
      const caseId = metadata.caseId;
      const quantity = metadata.quantity || 1;
      const caseItem = await Case.findByPk(caseId);
      
      if (!caseItem) {
        console.warn("Case not found:", caseId);
        return;
      }
      
      // Создаем записи о покупке кейса пользователем
      const userCases = [];
      for (let i = 0; i < quantity; i++) {
        userCases.push({
          userId: order.userId,
          caseId: caseId,
          paymentType: 'stars',
          pricePaid: order.price / quantity
        });
      }
      
      await UserCase.bulkCreate(userCases);
      
      // Notify user
      try {
        const message = quantity === 1 
          ? `You've successfully purchased the case "${caseItem.name}"! Open it in the app!`
          : `You've successfully purchased ${quantity} cases "${caseItem.name}"! Open them in the app!`;
        
        await ctx.reply(message);
      } catch (notifyErr) {
        if (notifyErr.error_code === 403) {
          console.warn(`User ${ctx.from?.id} blocked the bot, couldn't notify`);
        } else {
          console.error("Failed to notify user after payment:", notifyErr);
        }
      }
    } else {
      // Стандартная обработка для покупки попыток
      const user = await User.findByPk(order.userId);
      if (!user) {
        console.warn("User not found for order:", order.userId);
        return;
      }

      user.attempts += order.attemptsPurchased;
      await user.save();

      // Log transaction
      await AttemptTransaction.create({
        userId: user.id,
        amount: order.attemptsPurchased,
        type: "purchase",
        attemptsAfter: user.attempts,
      });

      // Notify user
      try {
        await ctx.reply(
          `Payment successful! You now have ${user.attempts} attempts!`
        );
      } catch (notifyErr) {
        if (notifyErr.error_code === 403) {
          console.warn(`User ${ctx.from?.id} blocked the bot, couldn't notify`);
        } else {
          console.error("Failed to notify user after payment:", notifyErr);
        }
      }
    }
  } catch (err) {
    console.error("Error handling successful payment:", err);
  }
});

bot.on("message", async (ctx) => {
  try {
    await ctx.reply("Запускай и играй! (Кнопка внизу)");
  } catch (err) {
    console.error("Failed to send default message:", err);
  }
});

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(
    `Error while handling update ${ctx?.update?.update_id || "unknown"}:`
  );
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Grammy error:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Telegram HTTP error:", e);
  } else {
    console.error("Unknown bot error:", e);
  }
});

module.exports = { bot };
