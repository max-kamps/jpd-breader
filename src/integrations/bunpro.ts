// @reader content-script

import { showError } from '../content/toast.js';
import { addedObserver, parseVisibleObserver } from './common.js';

try {
    const visible = parseVisibleObserver();

    const added = addedObserver('div.bp-quiz-question.relative', elements => {
        for (const element of elements) {
            const childDiv = element.querySelector('div.text-center');
            if (childDiv !== null && childDiv.children.length > 0) {
                visible.observe(childDiv);
            }
        }
    });

    added.observe(document.body, {
        subtree: true,
        childList: true,
    });
} catch (error) {
    showError(error);
}
