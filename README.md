# tg-triviabot
triviabot for Telegram

## setup

1. Setup your bot with BotFather, grab your token and write it into
   `~/.triviabot/token.js` (see `token.example.js` for example)
2. Make sure you have MongoDB setup on your machine. Then:

    npm install
    node populate_db.js <path-to-questions>.json
    npm start
