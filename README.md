# JPDB Web Reader Extension

A browser extension that parses any text in your browser using JPDB, and allows you to mine new vocabulary from any page!

## Is this ready to use yet?

No

## Current Limitations

-   Does not work with the current jpdb API
-   Only supports Firefox
-   Does not support adding cards to decks or mining sentences yet
-   Probably has many bugs

## Ongoing Work

-   Port to Chrome
-   Make it work with a non-persistent background page
-   Package for installation
-   Add mining
-   Finalize ttu integration
-   Add Wikipedia integration
-   Add customization menus that don't require entering custom CSS directly
-   Automatically update parsed words when their state changes

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

## Contributing

Issues with feedback or ideas are welcome. You can also message me on the JPDB Discord server.

Because this project is still very early in development, the code will likely move too fast to meaningfully contribute to.
If that does not disuade you, feel free to submit pull requests anyway.

## License

[MIT](https://choosealicense.com/licenses/mit/)
