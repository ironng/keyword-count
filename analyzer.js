'use strict';

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var Transform = require('stream').Transform;
var grep = require('grep1');
var mkdirp = Promise.promisify(require('mkdirp'));
var path = require('path');
var parsePath = require('parse-filepath');


/**
 * Default file path that the analyzer results are written to.
 * @type {String}
 */
var DEFAULT_OUTPUT_PATH = 'target/results.json';

/**
 * Default name of keyword array in keyword json.
 * @type {String}
 */
var DEFAULT_KEY_NAME = 'keywords';


/**
 * Analyzes a directory or file for keywords and writes the results
 * to a JSON file
 * @param {Object} opts    Configuration object
 */
function Analyzer(opts) {
    opts = opts ? opts : {};

    this.target = opts.target || '';
    this.keywordsList = opts.keywordsList || '';
    this.outputPath = opts.outputPath || DEFAULT_OUTPUT_PATH;
    this.keyName = opts.keyName || DEFAULT_KEY_NAME;
    this.ignoreCase = opts.ignoreCase || false;

    this.keywords = [];
    this.resultsMap = {};
}

/**
 * Runs the text analysis of the target file against the keywordList to produce
 * a map of keywords and their respective count
 * @return {Object}    A promise that resolves with the results map
 */
Analyzer.prototype.analyze = function() {
    var self = this;
    var target = self.target;
    var setup = [];

    setup.push(fs.lstatAsync(target));
    setup.push(self.getKeywords());

    return Promise.all(setup)
        .then(function(results) {
            var stats = results[0];

            self.keywords = results[1];

            if (stats.isFile()) {
                return self.grepFile(target);
            } else if (stats.isDirectory()) {
                return self.grepDir(target);
            }
        })
        .then(function() {
            return Promise.resolve(self.resultsMap);
        });
};

/**
 * Performs a grep for the keywords in all files in a directory
 * @return {Object}     A promise
 */
Analyzer.prototype.grepDir = function() {
    var self = this;
    var grepped = [];

    return fs.readdirAsync(self.target)
        .then(function(files) {
            files.forEach(function(file) {
                var filename = self.target + '/' + file;
                grepped.push(self.grepFile(filename));
            });

            return Promise.all(grepped);
        });
};

/**
 * Runs a grep on a file for keywords
 * @param  {String} file    File name
 * @return {Object}         A promise
 */
Analyzer.prototype.grepFile = function(file) {
    var self = this;
    var stringify = self.stringifier();
    var mapper = self.mapper(file);

    return new Promise(function(resolve, reject) {
        self.prepOutputPath()
            .then(function() {
                var writable = fs.createWriteStream(self.outputPath);
                var flags = (self.ignoreCase) ? '-Eio' : '-Eo';
                var search = grep([flags, self.keywords.join('|'), file]);

                search
                    .pipe(mapper)
                    .pipe(stringify)
                    .pipe(writable)
                    .on('finish', function() {
                        resolve();
                    });

                search.on('error', function(err) {
                    console.error(err);
                    reject(err);
                });
            })
            .catch(function(err) {
                console.error(err)
            });
    });
};

/**
 * Gets the keywords.
 * Returns a promise that resolves with the keyword array from
 * parsed json or the provided array if `keywordList` is already an array.
 * @return {Object}    A promise
 */
Analyzer.prototype.getKeywords = function() {
    var keywordsList = this.keywordsList;
    var keyName = this.keyName;

    if (!keywordsList) {
        return Promise.reject(new Error("Keyword list not provided"));
    }

    if (Array.isArray(keywordsList)) {
        return Promise.resolve(keywordsList);
    } else {
        return fs.readFileAsync(keywordsList, 'utf8')
            .then(function(data) {
                if (!data) {
                    return Promise.reject(new Error("Keyword JSON file is empty"));
                }

                return Promise.resolve(JSON.parse(data)[keyName]);
            });
    }
};

/**
 * Creates an instance of a Transform stream that transforms data into formatted JSON
 * @return {Object}    A Transform stream
 */
Analyzer.prototype.stringifier = function() {
    var transformer = new Transform({objectMode: true});
    transformer._transform = function(data, encoding, done) {
        var output = JSON.stringify(data, null, 4);
        this.push(output);

        done();
    };

    return transformer;
};

/**
 * Creates an instance of a Transform stream that parses through grep results
 * to create a map of keyword data for a given file
 * @param  {String} file    File name
 * @return {Object}         A Transform stream
 */
Analyzer.prototype.mapper = function(file) {
    var self = this;
    var transformer = new Transform({objectMode: true});

    transformer._transform = function(data, encoding, done) {
        var bufferString = data.toString();
        var split = bufferString.split('\n');
        var map = {};
        var filename = parsePath(file).name;

        self.keywords.forEach(function(word) {
            map[word] = 0;
        });

        split.forEach(function(word) {
            var key;

            if (word) {
                key = self.getKey(word, map);

                if (key) {
                    map[key] = map[key] + 1;
                }
            }
        });

        self.resultsMap[filename] = map;

        this.push(self.resultsMap);

        done();
    };

    return transformer;
};

/**
 * Prepares the output path by checking if the entire file path exists,
 * and creates it if it doesn't
 * @return {Object}    A promise
 */
Analyzer.prototype.prepOutputPath = function() {
    var self = this;
    var dirName = path.dirname(self.outputPath);

    return mkdirp(dirName)
        .then(function() {
            return fs.openAsync(self.outputPath, 'w+');
        })
        .catch(function(err) {
            console.error(err);
        });
};

/**
 * Gets correct key in a map to match the provided word. If `ignoreCase` is true,
 * a case-insensitve search for the key is performed.
 * @param  {String} word         Word to match the key against
 * @param  {Object} map          Object with keys to inspect
 * @return {String|undefined}    Matched key or undefined if no match is found
 */
Analyzer.prototype.getKey = function(word, map) {
    if (!this.ignoreCase) {
        return word;
    }

    return Object.keys(map).filter(function(key) {
        return key.toUpperCase() === word.toUpperCase();
    })[0];
};

module.exports = Analyzer;
