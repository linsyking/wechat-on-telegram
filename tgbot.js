import TelegramBot from "node-telegram-bot-api"
import { config } from './config.js'

const token = config.token

const bot = new TelegramBot(token, { polling: true });

bot.on('message',  async function(msg){
    // Get chat id
    console.log(msg.chat.id)
});
