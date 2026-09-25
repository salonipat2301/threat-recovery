export interface PageSignals {
    hasPasswordField: boolean;
    hasEmailField: boolean;
    hasPaymentField: boolean;
    hasFileUpload: boolean;
}

export function collectPageSignals(): PageSignals {
    const passwordFields =
        document.querySelectorAll('input[type="password"]');

    const emailFields =
        document.querySelectorAll('input[type="email"]');

    const fileUploads =
        document.querySelectorAll('input[type="file"]');

    const paymentFields =
        document.querySelectorAll(
            'input[autocomplete="cc-number"], ' +
            'input[autocomplete="cc-exp"], ' +
            'input[autocomplete="cc-csc"]'
        );

    return {
        hasPasswordField: passwordFields.length > 0,
        hasEmailField: emailFields.length > 0,
        hasPaymentField: paymentFields.length > 0,
        hasFileUpload: fileUploads.length > 0,
    };
}