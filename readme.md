# keyword-count

Get the keyword frequency for a file or directory output as JSON.

## Install

For the module:
```
npm install keyword-count
```

For the command:
```
npm install -g keyword-count
```

## Example

**File to Analyze** - _path/to/myFile.txt_
```
'In that direction,' the Cat said, waving its right paw round, 'lives a Hatter: and in that direction,' waving the other paw, 'lives a March Hare. Visit either you like: they're both mad.'
'But I don't want to go among mad people,' Alice remarked.
'Oh, you can't help that,' said the Cat: 'we're all mad here. I'm mad. You're mad.'
'How do you know I'm mad?' said Alice.
'You must be,' said the Cat, 'or you wouldn't have come here.'
```

**JSON with Keywords** - _path/to/keywords.json_
```json
{
	"keywords": ["Alice", "Cat", "March Hare", "Hatter", "mad"]
}
```

**Usage**
```javascript
var keywordCount = require('keyword-count');

var options = {
    target: 'path/to/myFile.txt',
    keywordsList: 'path/to/keywords.json', // Can be filename or an array of strings, i.e. ["foo", "bar"]
    outputPath: 'path/to/results.json'    // Optional
};

keywordCount(options)
    .then(function(results) {
        // results written to path/to/results.json
        console.log(results);
    });
```

**Tada!** New file - _path/to/results.json_
```json
{
	"myFile": {
		"Cat": 3,
		"Hatter": 1,
		"March Hare": 1,
		"Alice": 2,
		"mad": 6
	}
}
```

## API

#### keywordCount(options)

Returns a promise that resolves with a `results` object. `results` matches the content written to your json file.

`results` will look like this:

```javascript
// Given search for keywords ['foo', 'bar'] in MyFile.html
{
	MyFile: {
		foo: 5,
		bar: 2
	}
}
```

##### options

* `target` _(string)_ Name of file or directory to inspect
* `keywordsList` _(string or array)_ Name of json file with list of keywords or array of keywords
* `outputPath` _(string)_ Optional. Path of where json output should be written. If not provided, defaults to `target/results.json`
* `keyName` _(string)_ Optional. Name of array of keywords in `keywordsList` json file. Default is "keywords"
* `ignoreCase` _(boolean)_ Optional. Whether search should ignore case. Default is false

#### Command usage

```
$ keyword-count <path/to/target-file-to-inspect> <path/to/keyword-list-json> {OPTIONS}

Options
	-i, --ignore-case  Ignore case of keywords
	-k, --key-name     Name of keyword array in json file
	-o, --output-file  Name of file for json output, i.e. -o path/to/output.json
```
