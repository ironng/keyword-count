'use strict';

var DEFAULT_OUTPUT_PATH = 'target/results.json';
var DEFAULT_KEY_NAME = 'keywords';

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var Transform = require('stream').Transform;
var grep = require('grep1');
var mkdirp = Promise.promisify(require('mkdirp'));
var path = require('path');
var parsePath = require('parse-filepath');
var titleCase = require('title-case');


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

Analyzer.prototype.stringifier = function() {
    var transformer = new Transform({objectMode: true});
    transformer._transform = function(data, encoding, done) {
        var output = JSON.stringify(data, null, 4);
        this.push(output);

        done();
    };

    return transformer;
};

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

Analyzer.prototype.getKey = function(word, map) {
    if (!this.ignoreCase) {
        return word;
    }

    return Object.keys(map).filter(function(key) {
        return key.toUpperCase() === word.toUpperCase();
    })[0];
};

module.exports = Analyzer;