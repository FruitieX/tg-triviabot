# tg-triviabot
triviabot for Telegram

## setup

1. Setup your bot with BotFather, grab your token and write it into
   `~/.triviabot/token.js` (see `token.example.js` for example)
2. Find a bunch of trivia questions from somewhere, for example
   [here](https://www.reddit.com/r/datasets/comments/1uyd0t/200000_jeopardy_questions_in_a_json_file/)
3. Make sure you have MongoDB setup on your machine. Then:

    npm install
    node populate_db.js <path-to-questions>.json
    npm start
