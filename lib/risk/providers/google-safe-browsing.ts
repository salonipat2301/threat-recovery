import type { ThreatVerdict } from "../../types/threat-verdict";

const THREAT_TYPE_NAMES: Record<number, string> = {
  1: "MALWARE",
  2: "SOCIAL_ENGINEERING",
  3: "UNWANTED_SOFTWARE",
  4: "POTENTIALLY_HARMFUL_APPLICATION",
};

export async function checkGoogleSafeBrowsing(
  url: string,
): Promise<ThreatVerdict> {
  const apiKey = import.meta.env.WXT_GOOGLE_SAFE_BROWSING_API_KEY;

  if (!apiKey) {
    return {
      status: "LOOKUP_FAILED",
      provider: "GOOGLE_SAFE_BROWSING",
      threatTypes: [],
      error: "Missing Safe Browsing API key",
    };
  }

  try {
    const endpoint = new URL(
      "https://safebrowsing.googleapis.com/v5/urls:search",
    );
    endpoint.searchParams.set("key", apiKey);
    endpoint.searchParams.append("urls", url);

    const response = await fetch(endpoint.toString(), {
      headers: { Accept: "application/x-protobuf" },
    });

    if (!response.ok) {
      throw new Error(`Safe Browsing returned ${response.status}`);
    }

    const threatTypes = decodeThreatTypes(
      new Uint8Array(await response.arrayBuffer()),
    );

    return {
      status: threatTypes.length > 0 ? "KNOWN_THREAT" : "NO_KNOWN_THREAT",
      provider: "GOOGLE_SAFE_BROWSING",
      threatTypes,
    };
  } catch (error) {
    console.error("Safe Browsing lookup failed:", error);

    return {
      status: "LOOKUP_FAILED",
      provider: "GOOGLE_SAFE_BROWSING",
      threatTypes: [],
      error: error instanceof Error ? error.message : "Unknown lookup error",
    };
  }
}

function decodeThreatTypes(data: Uint8Array): string[] {
  const threatTypes = new Set<string>();
  let offset = 0;

  while (offset < data.length) {
    const tag = readVarint(data, offset);
    offset = tag.offset;
    const fieldNumber = tag.value >>> 3;
    const wireType = tag.value & 0b111;

    if (fieldNumber === 1 && wireType === 2) {
      const field = readLengthDelimited(data, offset);
      offset = field.offset;
      decodeThreatUrl(field.value, threatTypes);
    } else {
      offset = skipField(data, offset, wireType);
    }
  }

  return [...threatTypes];
}

function decodeThreatUrl(data: Uint8Array, threatTypes: Set<string>): void {
  let offset = 0;

  while (offset < data.length) {
    const tag = readVarint(data, offset);
    offset = tag.offset;
    const fieldNumber = tag.value >>> 3;
    const wireType = tag.value & 0b111;

    if (fieldNumber === 2 && wireType === 0) {
      const value = readVarint(data, offset);
      offset = value.offset;
      threatTypes.add(
        THREAT_TYPE_NAMES[value.value] ?? `UNKNOWN_THREAT_TYPE_${value.value}`,
      );
    } else if (fieldNumber === 2 && wireType === 2) {
      const field = readLengthDelimited(data, offset);
      offset = field.offset;
      let packedOffset = 0;

      while (packedOffset < field.value.length) {
        const value = readVarint(field.value, packedOffset);
        packedOffset = value.offset;
        threatTypes.add(
          THREAT_TYPE_NAMES[value.value] ?? `UNKNOWN_THREAT_TYPE_${value.value}`,
        );
      }
    } else {
      offset = skipField(data, offset, wireType);
    }
  }
}

function readVarint(
  data: Uint8Array,
  start: number,
): { value: number; offset: number } {
  let value = 0;
  let shift = 0;
  let offset = start;

  while (offset < data.length && shift < 35) {
    const byte = data[offset++];
    value |= (byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      return { value: value >>> 0, offset };
    }

    shift += 7;
  }

  throw new Error("Invalid Safe Browsing protobuf response");
}

function readLengthDelimited(
  data: Uint8Array,
  start: number,
): { value: Uint8Array; offset: number } {
  const length = readVarint(data, start);
  const end = length.offset + length.value;

  if (end > data.length) {
    throw new Error("Invalid Safe Browsing protobuf response");
  }

  return { value: data.subarray(length.offset, end), offset: end };
}

function skipField(data: Uint8Array, start: number, wireType: number): number {
  switch (wireType) {
    case 0:
      return readVarint(data, start).offset;
    case 1:
      return requireBytes(data, start, 8);
    case 2:
      return readLengthDelimited(data, start).offset;
    case 5:
      return requireBytes(data, start, 4);
    default:
      throw new Error("Invalid Safe Browsing protobuf response");
  }
}

function requireBytes(data: Uint8Array, start: number, count: number): number {
  const end = start + count;

  if (end > data.length) {
    throw new Error("Invalid Safe Browsing protobuf response");
  }

  return end;
}
