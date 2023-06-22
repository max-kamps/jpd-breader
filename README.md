# JPDB Web Reader Extension

A browser extension that parses any text in your browser using JPDB, and allows you to mine new vocabulary from any page!

## Is this ready to use yet?

Maybe? Some parts of the interface are temporary and quite ugly, but otherwise it should mostly work.

## Installation

### Chrome and other Chromium-based browsers
1.  Download the latest `.zip` file from the releases page
2.  Unpack the zip file in a location of your choosing
3.  Open up your browser and navigate to `chrome://extensions/`
4.  Check the `Developer mode` switch at the top right of your window
5.  Click the `Load unpacked` button at the top left
6.  In the file picker dialog, navigate to the folder you unpacked earlier. You should see a file called `manifest.json` inside the folder
7.  Click select/open/choose to exit the dialog and load the extension
8.  Continue with the [Initial Setup](#initial-setup) section

### That sounds like a hassle. Why don't you upload the extension to the Chrome store instead?
The Chrome store is not accepting new manifest v2 extensions, only manifest v3. But there are several problems with Manifest v3:
-   It does not support HTML parsing in background workers (which would break the review and add to FORQ features)
-   Firefox does not support background workers yet (which would break everything on Firefox)
Unfortunately, developing separate v2 and v3 versions of the add-on would be too much work for me.

### Firefox
1.  Download the latest `.xpi` file from the releases page
2.  Firefox should automatically ask you if you want to add the extension. Click `Add`
3.  Continue with the [Initial Setup](#initial-setup) section

That's it, you are done. If this method does not work for you, you can try this alternate approach:

1.  Download the latest `.xpi` file from the releases page
2.  Open Firefox and navigate to `about:addons`
3.  Click on the little gear icon to the right of `Manage Your Extensions`
4.  Click `Install Add-on from File...`
5.  In the file picker dialog, select the `.xpi` file
6.  Continue with the [Initial Setup](#initial-setup) section

### Mobile browsers (Kiwi Browser)
Experimental Support:
Although the UI is not yet optimized for mobile usage, you can still make use of it.

To Parse a Page:
1. Click on the three dots located at the top right corner.
2. From the menu that appears, select the extension to display the reader menu.
3. Choose the option "Parse page" to initiate the parsing process.

To show the popup on tap activate the "Show the popup on hover" and "Touchscreen support" settings.


## Initial Setup
Open the settings page. You can find it by clicking on the reader icon (読) in the browser menu bar. It might be hidden behind the extension overflow menu, which looks like a little puzzle piece (🧩)
Here you will need to enter your jpdb API key. It can be found at the very bottom of the [jpdb settings page](https://jpdb.io/settings).
You can also change various hotkeys

## Usage

You can use the reader on any website. Just select some text, right click, and choose the "Parse ... with jpdb" option.
Words will be colored according to their state (known, new, etc.) Hover over words while holding to see their meaning, and to mine or review them.

The following pages require special support for technical reasons, and will therefore start parsing immediately:
-  [ッツ Reader](https://github.com/ttu-ttu/ebook-reader): [reader.ttsu.app](https://reader.ttsu.app), [ttu-ebook.web.app](https://ttu-ebook.web.app)
-  Texthooker pages: [anacreondjt texthooker](https://anacreondjt.gitlab.io/texthooker.html), [learnjapanese.moe texthooker](https://learnjapanese.moe/texthooker.html), [exSTATic tracker](https://kamwithk.github.io/exSTATic/tracker.html), [renji-xd texthooker](https://renji-xd.github.io/texthooker-ui/)
-  [Mokuro](https://github.com/kha-white/mokuro): **IMPORTANT**: File path must contain `mokuro`, and file name must end in `.html`. I would suggest putting all your mokuro files in a folder named `mokuro`.
-  Readwok: [app.readwok.com](https://app.readwok.com/)
-  [Wikipedia](https://ja.wikipedia.org/)
-  [YouTube subtitles](https://youtube.com/)
-  [Bunpro](https://bunpro.jp)


## Can I customize the colors? Can I customize which furigana get shown?

Customization is currently done with custom CSS, because that took the least amount of time to develop :)
If you need some help, please ask in the [jpdb Discord thread](https://discord.com/channels/799891866924875786/1083527692672057395).

Here are some common customizations you might want. Feel free to use multiple of them, and modify them to your liking.

Don't color words:
```css
.jpdb-word { color: inherit; /* inherit color from the website instead of using a custom color */ }
```

Only color new words:
```css
.jpdb-word { color: inherit; }
.jpdb-word.new { color: rgb(75, 141, 255); }
.jpdb-word.not-in-deck { color: rgb(126, 173, 255); }
```

Show an underline rather than changing the text color:
```css
.jpdb-word.new {
    color: inherit;
    text-decoration: underline 3px rgb(75, 141, 255);
}
```

Hide all jpdb furigana:
```css
.jpdb-furi { display: none; }
```

Hide jpdb furigana only for some classes of words:
```css
.jpdb-word:is(.never-forget, .known, .due, .failed) .jpdb-furi { display: none; }
```

Only show jpdb furigana while hovering:
```css
.jpdb-word:not(:hover) .jpdb-furi { visibility: hidden; }
```

Notes if you aren't super familiar with CSS:
- CSS supports many color formats, like hex `#a2ff0e` or `rgb(126, 230, 17)`. Pick whichever you find most convenient.
- Selectors with more classes are higher priority. For example, `.jpdb-word.new` will overwrite `.jpdb-word`.
- For selectors with the same number of classes, *lower/later lines* have higher priority.
- You can add `!important` after a property (like `color: red !important;`) to overwrite the priority system.
- You can use `:is(.class, .class)` to select any element that has *at least one* of those classes. For example, `.jpdb-word:is(.due, .failed)` selects all words that are due *or* failed.
- You can use `:not(.class)` to select any element that does *not* have that class. For example, `.jpdb-word:not(.new)` selects all words that are *not* new.

List of classes:
- `.jpdb-word` - Any part of the text that was run through the jpdb parser
- `.jpdb-furi` - Furigana added via jpdb. Note that these might not necessarily be correct, as they are machine-generated.
- `.unparsed` - Parts where jpdb could not identify any words
- `.not-in-deck` - Words that were not in any of your decks. Note that these are not necessarily new, they might have been reviewed before.
    jpdb does not track the state of words that are not in any decks.
- `.locked` - Locked words
- `.redundant` - Redundant words
- `.new` - New words
- `.learning` - Learning words
- `.known` - Known words
- `.never-forget` - Words that are marked as never forget, or are part of a deck that is marked never forget.
- `.due` - Due words (that is, words that are in the `Due` state. If you have failed your last review, the words will be `Failed` instead!)
- `.failed` - Failed words
- `.suspended` - Suspended words (for example, through the "Suspend words outside of a given top most common words" feature)
- `.blacklisted` - Blacklisted words (either individually, or through settings like "Blacklist particles", "Blacklist katakana loanwords", etc.)

## Building

You can run the following command to build the release zip file:
```sh
$ npm install
$ npm run build
```
The resulting file will be located in the `dist/` folder

For development, you can also run the build in watch mode:
```sh
$ npm install
$ npm run watch
```
This will continuously rebuild the source code as it changes, and place the output in the `build/` folder.
It can be loaded as an unpacked extension from there.
Please remember to wait until building is done, and reload the extension on the "manage extensions" page before testing your changes.
Also, please look at the [Contributing](#contributing) section if you plan on contributing your changes.

## Contributing

Issues with feedback or ideas for new features are very welcome. You can also message me on the JPDB Discord server (@hmry#6502).

The following commands may be of interest to you:
*  `npm run check`: Checks your code for formatting issues, linter warnings and type errors. The CI also runs this, so your pull request will only be accepted if it passes. You can use eslint ignore comments if you get false positives, but leave a comment explaining why you think the error is false and safe to ignore.
*  `npm run format`: Reformats your code, as well as fixing any fixable lint issues. Note, if your editor has a `prettier` plugin, installing that and turning on "format on save" will be more convenient.
*  `npm run build`: Compiles the code, putting the compiled code into `build/`, and the finished zip file into `dist/`
*  `npm run watch`: Automatically recompiles code when it changes, putting the output into `build/`. Using this is recommended during development.

Please note the following:
*  All coroutines must be awaited. All top-level code must be wrapped in try/catch that calls `showError(error)`. This is because extensions do not support the `error` and `unhandledrejection` events, so any errors not caught explicitly would get ignored and not shown to the user. (Working around browser bugs like this is annoying but necessary.)
*  Event handlers added with `on<event>=` in JSX automatically get awaited and wrapped in a try/catch.

(Don't worry *too* much about this. If you forget, I will (probably) notice during code review and fix it after merging.)

If your change is large, or adds new dependencies, please consider opening an issue beforehand, so we may discuss.
Otherwise, I may choose to reject your pull request. Sorry.

For contributing, you can of course use any editor you want. I use VSCode, and have included my `.code-workspace` file with recommended project-specific settings if you want it. You may need to open it using the `File > Open Workspace from File` menu option. To make full use of it, you will need to install the Prettier (`esbenp.prettier-vscode`) and ESlint (`dbaeumer.vscode-eslint`) extensions.
No matter which editor you choose, having Prettier format on save is something you might find worth setting up.

This project uses ttypescript to automatically transform files. Any module with a leading `@reader content-script` comment, such as
```js
// @reader content-script
import { nonNull } from '../util.js'
nonNull(12);
```
will get transformed into a file that can be used as a browser content script, like this:
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
