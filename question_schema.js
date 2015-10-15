var mongoose = require('mongoose');

module.exports = mongoose.model('Question', {
    category: String,
    question: {
        type: String,
        index: true
    },
    answers: [String],
    rating: Number
});
