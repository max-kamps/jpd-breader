import { jsxCreateElement } from '../util.js';

const toastContainer = <div></div>;
const shadow = toastContainer.attachShadow({ mode: 'closed' });
shadow.append(
    <link rel='stylesheet' href={browser.runtime.getURL('/themes.css')} />,
    <link rel='stylesheet' href={browser.runtime.getURL('/common.css')} />,
    <link rel='stylesheet' href={browser.runtime.getURL('/content/toast.css')} />,
);
document.body.append(toastContainer);

export function showToast(kind: string, message: string, buttonCallback?: () => void) {
    const toast = (
        <div class='toast'>
            <span class='kind'>{kind}:</span>
            <span class='message'>{message}</span>
            <span class='buttons'>
                {buttonCallback ? (
                    <button class='action' onclick={buttonCallback}>
                        o
                    </button>
                ) : undefined}
                <button
                    class='close'
                    onclick={() => {
                        shadow.removeChild(toast);
                        clearTimeout(timeout);
                    }}>
                    x
                </button>
            </span>
        </div>
    );

    const timeout = setTimeout(() => {
        shadow.removeChild(toast);
    }, 3000);

    shadow.append(toast);
}

export function showError(error: Error | { message: string; stack: string | undefined }) {
    console.error(error);
    showToast('Error', error.message, () => {
        navigator.clipboard.writeText(`$`);
    });
}
