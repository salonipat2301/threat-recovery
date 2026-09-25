export interface SiteObservation {
  url: string;
  domain: string;
  timestamp: number;
  protocol: "HTTP" | "HTTPS";
  usernameFieldDetected: boolean;
  passwordFieldDetected: boolean;
  otpFieldDetected: boolean;
  paymentFieldDetected: boolean;
  fileUploadDetected: boolean;
  cameraPermission: boolean;
  microphonePermission: boolean;
  locationPermission: boolean;
  notificationPermission: boolean;
}
