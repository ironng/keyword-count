var Analyzer = require('./analyzer');

function analyzeKeywords(config) {
    var analyzer = new Analyzer(config);
    analyzer.analyze();
}

module.exports = analyzeKeywords;