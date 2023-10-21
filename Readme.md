# Wechat on Telegram

Sending/Receiving text/photos/images from wechat in telegram.

## Deploy Steps

0. Create a telegram bot (Add `@BotFather` on Telegram and follow the instructions).
1. Clone this repo.
2. Prepare the dependencies:
```bash
# On enter the repo
pnpm i
```
3. `cp config.js.tmp config.js`.
4. Modify `config.js`. `token` is what you get from BotFather, to get chatid, you can run `tgbot.js`.
5. Run! (`node bot.js`)

## Usage

### On TG

![](docs/p1.png)

![](docs/p2.png)

### On Wechat

![](docs/we.jpg)
