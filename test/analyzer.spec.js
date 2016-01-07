var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var Analyzer = require('./../analyzer');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var Transform = require('stream').Transform;
var del = require('delete');
var StreamTest = require('streamtest')['v2'];
var walk = require('walk');
var proxyquire = require('proxyquire');

chai.use(sinonChai);

var MOCK_CONFIG = {
    target: './test/mocks/subjects',
    keywordsList: './test/mocks/keywords.json',
    outputPath: './test/mocks/output/results.json'
};

describe('Analyzer', function() {
    var analyzer;

    beforeEach(function() {
        analyzer = new Analyzer(MOCK_CONFIG);
    });

    afterEach(function(done) {
        del.promise(MOCK_CONFIG.outputPath)
            .then(function() {
                done();
            })
            .catch(function(err) {
                console.error(err);
                done();
            });
    });

    describe('analyze()', function() {
        it('should return a promise', function() {
            var result = analyzer.analyze();
            expect(result).to.be.an.instanceof(Promise);
        });

        it('should check the file/dir status of the target to be analyzed', function() {
            var spy = sinon.spy(fs, 'lstat');

            analyzer.analyze();

            expect(spy).to.have.been.calledWith(analyzer.target);
        });

        it('should reject with an error if target doesn\'t exist', function(done) {
            analyzer.target = './fake';
            analyzer.analyze()
                .catch(function(err) {
                    expect(err).to.be.instanceof(Error);
                    done();
                });
        });

        it('should resolve with a results object with a key for each file analyzed', function(done) {
            analyzer.analyze()
                .then(function(results) {
                    expect(results).to.be.instanceof(Object);
                    expect(results.foo).to.be.defined;
                    expect(results.bar).to.be.defined;
                    done();
                });
        });

        it('should work when analyzing a single file', function(done) {
            analyzer.target = MOCK_CONFIG.target + '/foo.txt';
            analyzer.analyze()
                .then(function(results) {
                    expect(results.foo).to.be.defined;
                    expect(results.bar).to.be.undefined;
                    done();
                });
        });
    });

    describe('grepDir()', function() {
        it('should return a promise', function() {
            var result = analyzer.grepDir();
            expect(result).to.be.an.instanceof(Promise);
        });

        it('should read the contents of the target directory', function(done) {
            var spy = sinon.spy(fs, 'readdir');

            analyzer.grepDir()
                .then(function() {
                    expect(spy).to.have.been.calledWith(analyzer.target);
                    done();
                });
        });

        it('should grep though each file contained in the target directory', function(done) {
            var stub = sinon.stub(analyzer, 'grepFile', function() {
                return Promise.resolve();
            });

            analyzer.grepDir()
                .then(function() {
                    expect(stub).to.have.callCount(2);
                    done();
                });
        });
    });

    describe('grepFile()', function() {
        var mockFile = MOCK_CONFIG.target + '/foo.txt';
        var grepStub;

        beforeEach(function() {
            grepStub = sinon.stub().returns(StreamTest.fromObjects(['foo\nbar']));

            Analyzer = proxyquire('./../analyzer', {
                'grep1': grepStub
            });

            analyzer = new Analyzer(MOCK_CONFIG);
        });

        it('should return a promise', function() {
            var result = analyzer.grepFile(mockFile);
            expect(result).to.be.an.instanceof(Promise);
        });

        it('should prep the output path before performing the grep', function(done) {
            var spy = sinon.spy(analyzer, 'prepOutputPath');
            analyzer.grepFile(mockFile)
                .then(function() {
                    expect(spy).to.have.been.calledOnce;
                    done();
                });
        });

        it('should perform a grep for exact keywords', function(done) {
            var mock_keywords = ['Alice'];
            var expectedFlags = '-Eo';

            analyzer.keywords = mock_keywords;

            analyzer.grepFile(mockFile)
                .then(function() {
                    expect(grepStub).to.have.been.calledWith([expectedFlags, mock_keywords.join(), mockFile]);
                    done();
                });
        });

        it('should perform a grep for keywords and ignore case', function(done) {
            var mock_keywords = ['Alice'];
            var expectedFlags = '-Eio';

            analyzer.keywords = mock_keywords;
            analyzer.ignoreCase = true;

            analyzer.grepFile(mockFile)
                .then(function() {
                    expect(grepStub).to.have.been.calledWith([expectedFlags, mock_keywords.join(), mockFile]);
                    done();
                });
        });

        it('should utilize the mapper and stringifier transforms', function(done) {
            var mapperSpy = sinon.spy(analyzer, 'mapper');
            var stringifierSpy = sinon.spy(analyzer, 'stringifier');

            analyzer.grepFile(mockFile)
                .then(function() {
                    expect(mapperSpy).to.have.been.calledOnce;
                    expect(stringifierSpy).to.have.been.calledOnce;
                    done();
                });
        });

        it('should create a write stream', function(done) {
            var spy = sinon.spy(fs, 'createWriteStream');
            analyzer.grepFile(mockFile)
                .then(function() {
                    expect(spy).to.have.been.calledOnce;
                    done();
                });
        });
    });

    describe('getKeywords()', function() {
        it('should return a promise', function() {
            var result = analyzer.getKeywords();
            expect(result).to.be.an.instanceof(Promise);
        });

        it('should reject with an error if keywordsList was not provided', function(done) {
            analyzer.keywordsList = null;

            analyzer.getKeywords()
                .catch(function(err) {
                    expect(err).to.be.an.instanceof(Error);
                    done();
                });
        });

        it('should resolve an array equal to keywordsList if keywordsList was provided as an array', function(done) {
            var mock = ['foo', 'bar'];
            analyzer.keywordsList = mock;

            analyzer.getKeywords()
                .then(function(keywords) {
                    expect(keywords).to.equal(mock);
                    done();
                });
        });

        it('should reject with an error if the keywordsList file provided is empty', function(done) {
            analyzer.keywordsList = './test/mocks/empty.txt';

            analyzer.getKeywords()
                .catch(function(err) {
                    expect(err).to.be.an.instanceof(Error);
                    done();
                });
        });

        it('should resolve with an array if the keywordsList json can be parsed successfully', function(done) {
            analyzer.getKeywords()
                .then(function(keywords) {
                    expect(Array.isArray(keywords)).to.be.true;
                    done();
                });
        });
    });

    describe('stringifier()', function() {
        it('should return an instance of a Transform Stream', function() {
            var stringifier = analyzer.stringifier();
            expect(stringifier).to.be.an.instanceof(Transform);
        });

        describe('_transform()', function() {
            it('should stringify an object and format output with a white space of 4', function(done) {
                var expected = {
                    foo: 1,
                    bar: 2
                };

                var spy = sinon.spy(JSON, 'stringify');
                var rstream = fs.createReadStream('./test/mocks/mock.json');

                var parser = new Transform({objectMode: true});
                parser._transform = function(data, encoding, done) {
                    var bufferString = data.toString();
                    this.push(JSON.parse(bufferString));
                    done();
                };

                var stringifier = analyzer.stringifier();

                rstream
                    .pipe(parser)
                    .pipe(stringifier)
                    .on('finish', function() {
                        expect(spy).to.have.been.calledWith(expected, null, 4);

                        done();
                    })
                    .on('error', function(err) {
                        console.error(err);

                        done();
                    });
            });
        });
    });

    describe('mapper()', function() {
        it('should return an instance of a Transform Stream', function() {
            var mapper = analyzer.mapper();
            expect(mapper).to.be.an.instanceof(Transform);
        });

        describe('_transform()', function() {
            it('should create a word count map associated with a file name', function(done) {
                var expectedBuffer = ['little\nbunny\nfoo\nfoo'];
                var mockPath = 'path/to/myFile.txt';

                var inputStream = StreamTest.fromObjects(expectedBuffer.slice(0));
                var mapper = analyzer.mapper(mockPath);

                var expectedMap = {
                    myFile: {
                        little: 1,
                        bunny: 1,
                        foo: 2,
                        forest: 0
                    }
                };

                analyzer.keywords = ['little', 'bunny', 'foo', 'forest'];

                inputStream
                    .pipe(mapper)
                    .on('finish', function() {
                        expect(expectedMap).to.eql(analyzer.resultsMap);

                        done();
                    })
                    .on('error', function(err) {
                        console.error(err);

                        done();
                    });
            });
        });
    });

    describe('prepOutputPath()', function() {
        var mkDirSpy;
        var fakePath = './fake.txt';

        beforeEach(function() {
            mkDirSpy = sinon.spy();

            Analyzer = proxyquire('./../analyzer', {
                'mkdirp': function(dir, cb) {
                    mkDirSpy.apply(this);
                    return cb(null, true);
                }
            });

            analyzer = new Analyzer(MOCK_CONFIG);
        });

        afterEach(function(done) {
            del.promise(fakePath)
                .then(function() {
                    done();
                })
                .catch(function(err) {
                    console.error(err);
                    done();
                });
        });

        it('should return a promise', function() {
            var result = analyzer.prepOutputPath();
            expect(result).to.be.an.instanceof(Promise);
        });

        it('should check if the outputPath directory exists and create it if not', function(done) {
            analyzer.prepOutputPath()
                .then(function() {
                    expect(mkDirSpy).to.have.been.calledOnce;
                    done();
                });
        });

        it('should try to create the output path file if it doesn\'t exist', function(done) {
            var spy = sinon.spy(fs, 'open');

            analyzer.outputPath = fakePath;

            fs.lstatAsync(analyzer.outputPath)
                .catch(function(err) {
                    expect(err).to.be.an.instanceof(Error);
                });

            analyzer.prepOutputPath()
                .then(function() {
                    expect(spy).to.have.been.calledWith(analyzer.outputPath, 'w+');
                    fs.lstatAsync(analyzer.outputPath)
                        .then(function(stats) {
                            expect(stats.isFile()).to.be.true;
                            done();
                        });
                });
        });
    });

    describe('getKey()', function() {
        it('should return the same word provided as an argument if ignoreCase is false', function() {
            var expected = 'foo';
            var result = analyzer.getKey('foo', {});

            expect(result).to.equal(expected);
        });

        it('should do a case-insensitive search for a key in map if ignoreCase is true', function() {
            var expected = 'FOO';
            var result;

            analyzer.ignoreCase = true;
            result = analyzer.getKey('foo', { FOO: 1, bar: 1});

            expect(result).to.equal(expected);
        });

        it('should return undefined if no matching key is found in the provided map and ignoreCase is true', function() {
            var expected = undefined;
            var result;

            analyzer.ignoreCase = true;
            result = analyzer.getKey('hello', { foo: 1, bar: 1});

            expect(result).to.equal(expected);
        });
    });

});