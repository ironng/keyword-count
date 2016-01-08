#!/usr/bin/env node

var meow = require('meow');
var analyze = require('./../index.js');

var cli = meow([
        'Usage',
        '  keyword-count <file-to-read> <json-file-with-keywords>',
        '',
        'Options',
        '  -i, --ignore-case  Ignore case of keywords',
        '  -k, --key-name     Name of keyword array in json file',
        '  -o, --output-file  Name of file for json output, i.e. -o path/to/output.json'
    ],{
        alias: {
            i: 'ignore-case',
            k: 'key-name',
            o: 'output-file'
        }
    });

var input = cli.input;

if (!input && process.stdin.isTTY) {
    console.error('Specify a file to analyze');
    process.exit(1);
}

if (input.length < 2) {
    console.error('Specify a keyword list');
    process.exit(1);
}

analyze({
    target: input[0],
    keywordsList: input[1],
    ignoreCase: cli.flags.ignoreCase,
    keyName: cli.flags.keyName,
    outputPath: cli.flags.outputFile
});
