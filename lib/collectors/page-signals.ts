export interface PageSignals {
    hasUsernameField: boolean;
    hasPasswordField: boolean;
    hasOtpField: boolean;
    hasPaymentField: boolean;
    hasFileUpload: boolean;
}

export function collectPageSignals(): PageSignals {

    const usernameField =
        document.querySelector(`
      input[type="email"],
      input[autocomplete~="username"],
      input[name*="user" i],
      input[id*="user" i],
      input[name*="login" i],
      input[id*="login" i]
    `);

    const passwordField =
        document.querySelector(`
      input[type="password"],
      input[autocomplete~="current-password"],
      input[autocomplete~="new-password"]
    `);

    const otpField =
        document.querySelector(`
      input[autocomplete~="one-time-code"],
      input[name*="otp" i],
      input[id*="otp" i],
      input[name*="verification" i],
      input[id*="verification" i]
    `);

    const paymentField =
        document.querySelector(`
      input[autocomplete~="cc-number"],
      input[autocomplete~="cc-exp"],
      input[autocomplete~="cc-csc"],
      input[autocomplete~="cc-name"]
    `);

    const fileUpload =
        document.querySelector(
            'input[type="file"]'
        );

    return {
        hasUsernameField:
            Boolean(usernameField),

        hasPasswordField:
            Boolean(passwordField),

        hasOtpField:
            Boolean(otpField),

        hasPaymentField:
            Boolean(paymentField),

        hasFileUpload:
            Boolean(fileUpload),
    };
}