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

async.eachLimit(questions, 10, function(question, callback) {
    console.log(question);
    var q = new Question(question);
    q.save(function(err) {
        if (err) {
            console.log(err);
        }
        callback();
    });
}, function() {
    process.exit(0);
});
