import { browser } from '../util.js';
import { jsxCreateElement } from '../jsx.js';

const toastContainer = <div></div>;
const shadow = toastContainer.attachShadow({ mode: 'closed' });
shadow.append(
    <link rel='stylesheet' href={browser.runtime.getURL('/themes.css')} />,
    <link rel='stylesheet' href={browser.runtime.getURL('/common.css')} />,
    <link rel='stylesheet' href={browser.runtime.getURL('/content/toast.css')} />,
);
document.body.append(toastContainer);

export function showToast(
    kind: string,
    message: string,
    options: { timeout?: number; actionIcon?: string; action?: () => void } = {},
) {
    const toast = (
        <div class='toast'>
            <span class='kind'>{kind}:</span>
            <span class='message'>{message}</span>
            <span class='buttons'>
                {options.action ? (
                    <button class='action' onclick={options.action}>
                        {options.actionIcon ?? 'o'}
                    </button>
                ) : (
                    ''
                )}
                <button
                    class='close'
                    onclick={() => {
                        shadow.removeChild(toast);
                        clearTimeout(timeout);
                    }}>
                    ✕
                </button>
            </span>
        </div>
    );

    const timeout =
        options.timeout != Infinity
            ? setTimeout(() => {
                  shadow.removeChild(toast);
              }, options.timeout ?? 3000)
            : undefined;

    shadow.append(toast);
}

export function showError(error: Error | { message: string; stack: string | undefined }) {
    console.error(error);
    showToast('Error', error.message, {
        timeout: 5000,
        actionIcon: '⎘',
        action() {
            navigator.clipboard.writeText(`Error: ${error.message}\n${error.stack}`);
            showToast('Info', 'Error copied to clipboard!', { timeout: 1000 });
        },
    });
}
