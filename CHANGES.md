# Version 13

It's been a while since the last update, hasn't it...

-   Replaced annoying browser popups with toast (hehe) notifications
    -   Toasts close automatically after some time, and can also be closed manually with the x button
    -   Feedback on the mobile experience wanted
-   Added experimental support for parsing YouTube subtitles Thanks @xyaman)
-   Added support for the ZXY101 Mokuro fork (thanks @rymiel)
-   Bugfixes:
    -   Several

# Version 12.1

-   Bugfixes:
    -   Fix permission-related bugs that stop custom CSS from working in Chrome, among other things

# Version 12.0

-   Add Bunpro integration (thanks @7w1)
-   Bugfixes:
    -   Fixed popups being positioned incorrectly, especially on pages with vertical text

# Version 11.0

-   Show new part of speech information in the word popup
-   Limit popup height, make it scrollable
-   Allow mouse buttons to be chosen as hotkeys
-   Add support for showing popup without hotkey (thanks @xyaman)
-   Add experimental mobile support (thanks @xyaman and @Calonca)
-   Add a button to parse the whole page in the reader menu (thanks @Calonca)
-   Add a button to select text when parsing websites through the reader menu (useful on mobile) (thanks @Calonca)
-   Add exSTATIc integration (thanks @asayake-b5)
-   Add renji-xd integration (thanks @asayake-b5)
-   Add YouTube subtitle integration (thanks @xyaman)
-   Completely redone visual design
-   Change to a more useful version numbering scheme
-   Rename plugin to jpd-breader to avoid confusing people on the Discord
-   Bugfixes:
    -   Fixed selection parsing not working on certain webpages due to "Reached end of document" errors
    -   Fixed parsing not working on certain webpages due to "Unknown display value -webkit-box" errors

## Breaking changes

Popup CSS: `.mine-buttons` has now been split into `#mine-buttons` and `#review-buttons`

## Note

This version adds support for the new jpdb API position encoding system. If you do not update to this version, your extension will stop working.

# Version 0.0.10

-   Added functionality to import and export settings
-   Bugfixes, notably:
    -   Fixed incorrect pitch rendering for words with a rise/fall immediately followed by a fall/rise
    -   Fixed custom CSS not reloading properly sometimes after saving settings

# Version 0.0.9

-   Added hotkeys for quick mining and showing the advanced mining dialog
-   Added pitch accent to the popup
-   Bugfixes (notably #13, and incorrect spacing on justified text in Chrome)

# Version 0.0.8

-   New "Add" button in the popup that adds a word to your mining deck in one click
-   Moved old modal dialog to a new "Edit, add and review..." button
-   Added new settings to control whether the Add button should add to forq, and how many sentences it should mine
-   Bugfixes (notably #26)

# Version 0.0.7

-   Added Readwok integration (thank you @sdbversini)
-   Parsing, especially while scrolling, should now send fewer API request
-   Added support for more epubs in ttu
-   Bugfixes (notably #24 and #25)

# Version 0.0.6

-   Hotkeys are now keyboard layout independent
-   You can hit escape to clear a hotkey (no hover mode yet though)
-   Bugfixes

## Manual intervention required

The format hotkeys are saved in has changed. Installing this version will reset all of your hotkeys.

# Version 0.0.5

-   Added integrations for Wikipedia, Mokuro, and Texthookers (Thanks @sdbversini)
-   Bugfixes (notably #8, #20)

# Version 0.0.4

-   Popup now closes when you press the hotkey again while not hovering over a word
-   Bugfixes (notably #16)

# Version 0.0.3

-   Added frequency information to the popup (thanks @nico-abram)
-   Reworked the settings page to be much more usable
-   Added hotkeys for blacklisting, never-forgetting, reviewing
-   Popup now only shows up when holding down a hotkey
-   Bugfixes (including #2, #3, #5, #6, #7, #10)

# Version 0.0.2

-   Reduced the time that adding reviews takes
-   Bugfixes

# Version 0.0.1

-   Initial release
