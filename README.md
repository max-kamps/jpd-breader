# JPDB Web Reader Extension

A browser extension that parses any text in your browser using JPDB, and allows you to mine new vocabulary from any page!

## Is this ready to use yet?

Not really. It works, but it is buggy and the interface is quite ugly.

## Current limitations and known bugs

-   Always adds furigana
-   Overwrites existing furigana (including gikun)
-   Probably has many other bugs (take a look at the issues tab)

## Features currently in progress:

-   Add Mokuro integration
-   Add customization options for furigana
-   Add Wikipedia integration
-   Make the UI nicer (particularly the mining dialog)
-   Add visual customization options that don't require entering custom CSS directly
-   Make it work with a non-persistent background page

## Installation

### Chrome and other Chromium-based browsers
1.  Download the latest `.zip` file from the releases page
2.  Unpack the zip file in a location of your choosing
3.  Open up your browser and navigate to `chrome://extensions/`
4.  Check the `Developer mode` switch at the top right of your window
5.  Click the `Load unpacked` button at the top left
6.  In the file picker dialog, navigate to the folder you unpacked earlier. You should see a file called `manifest.json` inside the folder
7.  Click select/open/choose to exit the dialog and load the extension

### Firefox
1.  Download the latest `.xpi` file from the releases page
2.  Firefox should automatically ask you if you want to add the extension

That's it, you are done. If this method does not work for you, you can try this alternate approach:

1.  Download the latest `.xpi` file from the releases page
2.  Open Firefox and navigate to `about:addons`
3.  Click on the little gear icon to the right of `Manage Your Extensions`
4.  Click `Install Add-on from File...`
5.  In the file picker dialog, select the `.xpi` file

### Mobile browsers (Firefox for Android, Kiwi Browser)
Currently not supported. If you're feeling adventurous and want to try installing them on your own anyway, please report all issues you encounter here on GitHub.
Your contributions will prove invaluable to supporting mobile browsers in the future.

## Building

You can run the following command to build a zip file:
The resulting file will be located in the `dist` folder
```sh
$ npm install
$ npm run build
```

For development, you can also run the build in watch mode:
```sh
$ npm install
$ npm run watch
```
This will continuously rebuild the source code as it changes, and place the output in the `build` folder.
It can be loaded as an unpacked extension from there.
Please remember to reload the extension on the "manage extensions" page before testing your changes.
Also, please look at the Contributing section if you plan on contributing your changes.

## Usage

On ttu reader: Parts of the text are automatically parsed just before they scroll into view.

On all other pages: Select some text, right click, click "Parse ... with jpdb".

Words will be colored according to their state. Hover over words to see their meaning, and to mine or review them.

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

Issues with feedback or ideas for new features are very welcome. You can also message me on the JPDB Discord server (@hmry#6502).

The following commands may be of interest to you:
*  `npm run check`: Checks your code for formatting issues, linter warnings and type errors. This gets run in CI, so your pull request will only be accepted if this passes. You can use eslint ignore comments if you get false positives, but leave a comment explaining why you think the error is false and safe to ignore.
*  `npm run format`: Reformats your code, as well as fixing any fixable lint issues. Note, if your editor has a `prettier` plugin, installing that and turning on "format on save" will be more convenient.
*  `npm run build`: Compiles the code, putting the compiled code into `build/`, and the finished zip file into `dist/`
*  `npm run watch`: Automatically recompiles code when it changes, putting the output into `build/`. Using this is recommended during development.

Please note the following:
*  All coroutines must be awaited. All top-level code must be wrapped in try/catch that calls `showError(error)`. This is because extensions do not support the `error` and `unhandledrejection` events, and so any errors not caught explicitly would get ignored and not shown to the user.
*  Event handlers added with `on<event>=` in JSX automatically get awaited and wrapped in a try/catch.

(Don't worry *too* much about this. If you forget, I will (probably) notice during code review and fix it after merging.)

If your change is large, or adds new dependencies, please consider opening an issue beforehand so we can discuss.
Otherwise, I may choose to reject your pull request. Sorry.

For contributing, you can use any editor you want, of course. I use VSCode, and have included my `.code-workspace` file with recommended project-specific settings if you want it. You may need to open it using the `File > Open Workspace from File` menu option. To make full use of it, you will need to install the Prettier (`esbenp.prettier-vscode`) and ESlint (`dbaeumer.vscode-eslint`) extensions.
No matter which editor you choose, having Prettier format on save is something you might find worth setting up.

This project uses ttypescript to automatically transform files. Any module with a leading `@reader content-script` comment, such as
```js
// @reader content-script
import { nonNull } from '../util.js'
nonNull(12);
```
gets transformed into a file that can be used as a browser content script, like this:
```js
(async () => {
    "use strict";
    const $browser = globalThis.browser ?? globalThis.chrome,
          $import = path => import($browser.runtime.getURL(path));

    const { nonNull } = await $import("/util.js");
    nonNull(12);
})();
```

## License

[MIT](https://choosealicense.com/licenses/mit/)
