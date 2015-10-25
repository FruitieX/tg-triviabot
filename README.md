# tg-triviabot
triviabot for Telegram

## setup

1. Setup your bot with BotFather, grab your token and write it into
   `~/.triviabot/token.js` (see `token.example.js` for example)
2. Use the `/setprivacy` command with BotFather to allow the bot to see every
   message
3. Find a bunch of trivia questions from somewhere, for example
   [here](https://www.reddit.com/r/datasets/comments/1uyd0t/200000_jeopardy_questions_in_a_json_file/). Make sure they are of the same format as the [example](https://github.com/FruitieX/tg-triviabot/blob/master/exampleQuestions.json),
   or that they can be parsed by [populate_db.js](https://github.com/FruitieX/tg-triviabot/blob/master/populate_db.js)
4. Make sure you have MongoDB setup on your machine. Then:

         npm install
         node populate_db.js <path-to-questions>.json
         npm start
