# JPDB Web Reader Extension

A browser extension that parses any text in your browser using JPDB, and allows you to mine new vocabulary from any page!

## Is this ready to use yet?

No

## Current Limitations

-   Probably has many bugs
-   Does not support reviewing or forqing yet

## Ongoing Work

-   Make it work with a non-persistent background page
-   Package for installation
-   Finalize ttu integration
-   Add Wikipedia integration
-   Add customization menus that don't require entering custom CSS directly

## Installation

I have not yet packaged this for installation, so you will have to install it unpacked.

## Building

```sh
$ npm install
$ npm run build
```

TODO add a better explanation

## Usage

On ttu reader (and Wikipedia, eventually): Parsing begins automatically on page load.

On all other pages: Select some text, right click, click "Parse with jpdb".

Words will be colored according to their state. Hover over words to see their meaning.

## Can I set it to only color new words?

Yes, paste this into the Custom Word CSS box in the settings:
```css
.jpdb-word.unparsed     { }
.jpdb-word.locked       { color: inherit; }
.jpdb-word.redundant    { color: inherit; }
.jpdb-word.not-in-deck  { color: rgb(126, 173, 255); }
.jpdb-word.new          { color: rgb(75, 141, 255); }
.jpdb-word.learning     { color: inherit; }
.jpdb-word.known        { color: inherit; }
.jpdb-word.never-forget { color: inherit; }
.jpdb-word.due          { color: inherit; }
.jpdb-word.failed       { color: inherit; }
.jpdb-word.suspended    { color: inherit; }
.jpdb-word.blacklisted  { color: inherit; }
```

## Contributing

Issues with feedback or ideas are welcome. You can also message me on the JPDB Discord server.

Because this project is still very early in development, the code will likely move too fast to meaningfully contribute to.
If that does not disuade you, feel free to submit pull requests anyway.

## License

[MIT](https://choosealicense.com/licenses/mit/)
