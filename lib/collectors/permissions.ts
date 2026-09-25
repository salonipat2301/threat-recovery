export interface PermissionSignals {
  camera:
    PermissionState | "unknown";

  microphone:
    PermissionState | "unknown";

  geolocation:
    PermissionState | "unknown";

  notifications:
    PermissionState | "unknown";
}

export async function collectPermissionSignals():
  Promise<PermissionSignals> {

  return {
    camera:
      await getPermissionState("camera"),

    microphone:
      await getPermissionState("microphone"),

    geolocation:
      await getPermissionState("geolocation"),

    notifications:
      await getPermissionState("notifications"),
  };
}

async function getPermissionState(
  name: PermissionName
): Promise<PermissionState | "unknown"> {

  try {

    const permission =
      await navigator.permissions.query({
        name,
      });

    return permission.state;

  } catch {

    return "unknown";
  }
}