var async = require('async');
var fs = require('fs');

if (!process.argv[2]) {
    console.log('usage: populate_db.js <path-to-questions.json>');
    process.exit(1);
}

var questions = JSON.parse(fs.readFileSync(process.argv[2]));

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/triviabot');
var Question = require('./question_schema');

var cnt = 0;
async.eachSeries(questions, function(question, callback) {
    // question only contains single answer
    if (question.answer) {
        question.answers = [];

        // parentheses are treated as optional
        if (question.answer.indexOf('(') !== -1) {
            question.answers.push(question.answer.replace(/\s*\(.*\)\s*/g, ''));

            question.answer = question.answer.replace('(', '');
            question.answer = question.answer.replace(')', '');
        }

        question.answers.unshift(question.answer);
        delete question.answer;
    }

    question.rating = 0;
    var q = new Question(question);

    //console.log(q);
    cnt++;
    console.log('inserting question ' + cnt + '/' + questions.length);
    q.save(function(err) {
        if (err) {
            console.log(err);
        }
        callback();
    });
}, function() {
    process.exit(0);
});
