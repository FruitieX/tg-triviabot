'use strict';

var _ = require('underscore');
var fs = require('fs');

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/triviabot');
var Question = require('./question_schema');

var mkdirp = require('mkdirp');
mkdirp(process.env.HOME + '/.triviabot');

var highScores = {};
try {
    highScores = JSON.parse(fs.readFileSync(process.env.HOME + '/.triviabot/highscores.json'));
} catch(e) {
    console.log('unable to find highscores, will start without them!');
}

var hintTime = 15000;
var intermissionTime = 10000;

var states = {};

var sendMessage = function(bot, msg, callback) {
    console.log(`sending message: ${msg.chat_id}: ${msg.text}`);
    bot.sendMessage(msg.chat_id, msg.text).then(callback);
};

var sendHint = function(chat) {
    var gs = states[chat];
    var answer = gs.question.answers[0];

    var remainingChars = _.difference(_.range(answer.length), gs.hintChars);
    remainingChars = _.shuffle(remainingChars);

    // reveal 1/4 of remaining characters
    var numChars = Math.ceil(remainingChars.length / 4);

    if (remainingChars.length > 1) {
        for (var i = 0; i < numChars; i++) {
            gs.hintChars.push(remainingChars[i]);
        }
    }

    var hint = answer;

    for (var i = 0; i < hint.length; i++) {
        // character is not in hintChars, obfuscate it
        if (gs.hintChars.indexOf(i) === -1) {
            hint = hint.substr(0, i) + '*' + hint.substr(i + 1);
        }
    }

    gs.numHints++;

    if (gs.numHints > 3) {
        sendMessage(bot, {
            text: 'Time\'s up! The answer was: "' + answer + '"',
            chat_id: chat
        });

        printStandings(chat);
        gs.active = false;
        gs.intermissionTimeout = setTimeout(function() {
            nextRound(chat);
        }, intermissionTime);
    } else {
        sendMessage(bot, {
            text: 'Hint: ' + hint,
            chat_id: chat
        });

        gs.hintTimeout = setTimeout(function() {
            sendHint(chat);
        }, hintTime);
    }
};

var printStandings = function(chat) {
    var gs = states[chat];

    if (!_.keys(gs.scores).length) {
        return;
    }

    var standings = '';

    var scores = [];

    _.each(_.keys(gs.scores), function(id) {
        scores.push(gs.scores[id]);
    });

    scores = _.sortBy(scores, 'score');
    scores.reverse();

    _.each(scores, function(score) {
        standings += score.firstName + ': ' + score.score + '\n';
    })

    sendMessage(bot, {
        text: 'Current standings: \n' + standings,
        chat_id: chat
    });
};

var nextRound = function(chat) {
    var gs = states[chat];

    clearTimeout(gs.hintTimeout);
    gs.hintTimeout = null;

    gs.round++;

    if (gs.round > 10) {
        var s = '';

        if (_.keys(gs.scores).length) {
            var standings = '';

            var scores = [];

            _.each(_.keys(gs.scores), function(id) {
                scores.push(gs.scores[id]);
            });

            scores = _.sortBy(scores, 'score');
            scores.reverse();

            if (!scores[0].score) {
                s += 'Nobody scored any points!\n';
            } else {
                var draw = false;
                if (scores[1] && scores[0].score === scores[1].score) {
                    s = 'It\'s a draw!\n';
                    draw = true;
                } else {
                    s = scores[0].firstName + ' wins the game!\n';
                }

                if (_.keys(gs.players).length >= 3) {
                    if (!highScores[chat]) {
                        highScores[chat] = {};
                    }
                    _.each(scores, function(score) {
                        if (!highScores[chat][score.id]) {
                            highScores[chat][score.id] = {
                                firstName: score.firstName,
                                lastName: score.lastName,
                                wins: 0,
                                score: 0
                            };
                        }
                        if (!draw && score.id === scores[0].id) {
                            highScores[chat][score.id].wins++;
                        }
                        highScores[chat][score.id].score += score.score;
                    });

                    fs.writeFileSync(process.env.HOME + '/.triviabot/highscores.json', JSON.stringify(highScores));
                } else {
                    s += 'Note: only ' + _.keys(gs.players).length + ' players played during this round.\n';
                    s += 'Need at least 3 active players for scores to count toward highscores!\n';
                }
            }

            if (_.keys(highScores[chat]).length) {
                var scores = [];

                _.each(_.keys(highScores[chat]), function(id) {
                    scores.push(highScores[chat][id]);
                });

                scores = _.sortBy(scores, 'score');
                scores.reverse();

                s += '\nHighscores for this group:\n\n';

                for (var i = 0; i < 10 && i < scores.length; i++) {
                    var score = scores[i];
                    s += (i + 1) + ': ' + score.firstName + ': ' + score.score + ' (wins: ' + score.wins + ')\n';
                }
            }
        } else {
            s += 'Nobody scored any points!\n';
        }

        sendMessage(bot, {
            text: 'Game over! ' + s,
            chat_id: chat
        });

        delete states[chat];
    } else {
        Question.count(function(err, questionCnt) {
            var skipCnt = Math.floor(Math.random() * questionCnt);
            Question.findOne().skip(skipCnt).exec(function(err, question) {
                // <br /> -> '\n'
                question.question = question.question.replace(/<br \/>/g, '\n');
                question.question = question.question.replace(/<br\/>/g, '\n');
                question.question = question.question.replace(/<br>/g, '\n');

                // set game state to active only after we've retrieved the next question
                gs.active = true;
                gs.question = question;
                gs.hintChars = [];

                // strip some weird characters from answers
                gs.question.answers.map(function(answer) {
                    // \" -> "
                    answer = answer.replace(/\\"/g, '"');

                    // \' -> '
                    answer = answer.replace(/\\'/g, "'");

                    // "blahblah" -> blahblah
                    if (answer[0] === '"' && answer[answer.length - 1] === '"') {
                        answer = answer.substr(1, answer.length - 2);
                    }

                    // <br /> -> '\n'
                    answer = answer.replace(/<br \/>/g, '\n');
                    answer = answer.replace(/<br\/>/g, '\n');
                    answer = answer.replace(/<br>/g, '\n');

                    // remove backslashes
                    answer = answer.replace(/\\/g, '');

                    return answer;
                });

                // add spaces to hint chars
                var answer = gs.question.answers[0];
                for (var i = 0; i < answer.length; i++) {
                    if (answer[i] === ' ' || answer[i] === '-' || answer[i] === '/' ||
                        answer[i] === '&' || answer[i] === '.' || answer[i] === ',' ||
                        answer[i] === '(' || answer[i] === ')' || answer[i] === '\\'||
                        answer[i] === '\'' ) {
                        gs.hintChars.push(i);
                    }
                }

                gs.numHints = 0;

                sendMessage(bot, {
                    text: 'Round: ' + gs.round + '/10:\nQuestion (' + (question.category || 'no category') + '): ' + question.question,
                    chat_id: chat
                });

                gs.hintTimeout = setTimeout(function() {
                    sendHint(chat);
                }, hintTime);
            });
        });
    }
};

var stopTrivia = function(chat, from) {
    var gs = states[chat];

    if (from.id !== gs.startedBy) {
        sendMessage(bot, {
            text: 'Trivia can only be stopped by whomever started it.',
            chat_id: chat
        });

        return;
    }

    clearTimeout(gs.hintTimeout);
    clearTimeout(gs.intermissionTimeout);

    sendMessage(bot, {
        text: 'Trivia stopped.',
        chat_id: chat
    });

    delete states[chat];
};

var startTrivia = function(chat, from) {
    if (states[chat]) {
        sendMessage(bot, {
            text: 'Trivia already started!',
            chat_id: chat
        });
        return;
    }

    states[chat] = {
        hintChars: [],
        startedBy: from.id,
        question: null,
        round: 0,
        scores: {},
        numHints: 0,
        active: false,
        hintTimeout: null,
        intermissionTimeout: null,
        players: {}
    };

    sendMessage(bot, {
        text: 'Trivia started!',
        chat_id: chat
    }, function() {
        nextRound(chat);
    });
};

var stripExtraChars = function(text) {
    text = text.toLowerCase();
    text = text.replace(/!/g, '');
    text = text.replace(/"/g, '');
    text = text.replace(/'/g, '');
    text = text.replace(/\(/g, '');
    text = text.replace(/\)/g, '');
    text = text.replace(/\\/g, '');
    text = text.replace(/^a\s/g, '');
    text = text.replace(/^an\s/g, '');
    text = text.replace(/^the\s/g, '');
    return text;
};

var verifyAnswer = function(chat, from, text) {
    var gs = states[chat];

    if (!gs.active) {
        return;
    }

    // for keeping track of players per round
    gs.players[from.id] = true;

    text = stripExtraChars(text);
    for (var i = 0; i < gs.question.answers.length; i++) {
        var origAnswer = gs.question.answers[i];
        var answer = stripExtraChars(gs.question.answers[i].toLowerCase());

        if (answer === text) {
            if (!gs.scores[from.id]) {
                gs.scores[from.id] = {
                    id: from.id,
                    firstName: from.first_name,
                    lastName: from.last_name,
                    score: 0
                }
            }

            gs.scores[from.id].score++;

            sendMessage(bot, {
                text: 'Points to ' + from.first_name + '! "' + origAnswer + '" is the correct answer!',
                chat_id: chat
            }, function() {
                printStandings(chat);
            });

            gs.active = false;
            clearTimeout(gs.hintTimeout);
            gs.intermissionTimeout = setTimeout(function() {
                nextRound(chat);
            }, intermissionTime);

            break;
        }
    }
};

var reportQuestion = function(chat) {
    var gs = states[chat];

    Question.findById(gs.question._id, function(err, question) {
        if (err) {
            console.log('error while reporting question!');
            console.log(err);
            return;
        }

        question.rating -= 1;

        question.save(function(err) {
            if (err) {
                console.log('error while saving question report!');
                console.log(err);
                return;
            }

            sendMessage(bot, {
                text: 'Reported question as bad.',
                chat_id: chat
            });
        });
    });
};

var bot;
var options = {
    polling: {
        interval: 1000
    }
};

Question.count(function(err, questionCnt) {
    if (!questionCnt) {
        console.log('no questions found in database!');
        console.log('please add some questions before launching triviabot.');
        process.exit(0);
    }

    var token = require(process.env.HOME + '/.triviabot/token.js');
    var Bot = require('node-telegram-bot-api');
    bot = new Bot(token, options)
    .on('message', function(msg) {
        if (msg.text) {
            console.log(`received message: ${msg.from.username || `${msg.from.first_name} ${msg.from.last_name}`}: ${msg.text}`);
            if (!msg.text.indexOf('/trivia')) {
                startTrivia(msg.chat.id, msg.from);
            } else if (states[msg.chat.id]) {
                if (!msg.text.indexOf('/stoptrivia')) {
                    stopTrivia(msg.chat.id, msg.from);
                } else if (!msg.text.indexOf('/badquestion')) {
                    reportQuestion(msg.chat.id);
                } else {
                    verifyAnswer(msg.chat.id, msg.from, msg.text);
                }
            }
        }
    });
});
