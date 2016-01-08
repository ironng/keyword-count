var Analyzer = require('./analyzer');

function analyzeKeywords(config) {
    var analyzer = new Analyzer(config);
    return analyzer.analyze();
}

module.exports = analyzeKeywords;
