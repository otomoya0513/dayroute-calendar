import { NextRequest, NextResponse } from "next/server";

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
    osm_id?: number;
  };
};

const typeLabels: Record<string, string> = {
  railway: "駅・鉄道",
  station: "駅",
  halt: "駅",
  building: "建物",
  amenity: "施設",
  shop: "店舗",
  tourism: "観光・宿泊",
  leisure: "レジャー施設",
  office: "オフィス",
  place: "地域",
  highway: "道路",
  aeroway: "空港・航空",
};

const fallbackPlaces = [
  { id: "fallback-tokyo-dome", name: "東京ドーム", area: "文京区", address: "東京都文京区後楽1丁目3-61", type: "レジャー施設", lat: 35.7056, lng: 139.752 },
  { id: "fallback-tokyo-station", name: "東京駅", area: "千代田区", address: "東京都千代田区丸の内1丁目", type: "駅", lat: 35.6812, lng: 139.7671 },
  { id: "fallback-shibuya-station", name: "渋谷駅", area: "渋谷区", address: "東京都渋谷区道玄坂1丁目", type: "駅", lat: 35.658, lng: 139.7016 },
  { id: "fallback-shinjuku-station", name: "新宿駅", area: "新宿区", address: "東京都新宿区新宿3丁目", type: "駅", lat: 35.6896, lng: 139.7006 },
  { id: "fallback-yokohama-station", name: "横浜駅", area: "横浜市", address: "神奈川県横浜市西区高島2丁目", type: "駅", lat: 35.4657, lng: 139.6223 },
  { id: "fallback-ariake-arena", name: "有明アリーナ", area: "江東区", address: "東京都江東区有明1丁目11-1", type: "レジャー施設", lat: 35.6445, lng: 139.7947 },
];

function fallbackSearch(query: string) {
  const normalized = query.replace(/[\s　]/g, "").toLowerCase();
  return fallbackPlaces.filter((place) => `${place.name}${place.address}${place.type}`.replace(/[\s　]/g, "").toLowerCase().includes(normalized));
}

function placeType(key = "", value = "") {
  if (value === "station" || value === "halt") return "駅";
  return typeLabels[key] ?? typeLabels[value] ?? "場所";
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) return NextResponse.json({ places: [] });

  const endpoint = new URL("https://photon.komoot.io/api/");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", "8");
  endpoint.searchParams.set("countrycode", "JP");
  endpoint.searchParams.set("lat", "35.6812");
  endpoint.searchParams.set("lon", "139.7671");
  endpoint.searchParams.set("zoom", "5");

  try {
    const response = await fetch(endpoint, {
      headers: { "Accept-Language": "ja" },
    });
    if (!response.ok) throw new Error(`Place search failed: ${response.status}`);
    const data = (await response.json()) as { features?: PhotonFeature[] };
    const seen = new Set<string>();
    const places = (data.features ?? []).flatMap((feature) => {
      const properties = feature.properties;
      const coordinates = feature.geometry?.coordinates;
      if (!properties?.name || !coordinates) return [];
      const [lng, lat] = coordinates;
      const addressParts = [
        [properties.street, properties.housenumber].filter(Boolean).join(" "),
        properties.locality,
        properties.district,
        properties.city,
        properties.state,
      ].filter((value, index, values) => value && values.indexOf(value) === index);
      const key = `${properties.name}-${lat.toFixed(5)}-${lng.toFixed(5)}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        id: `${properties.osm_key ?? "place"}-${properties.osm_id ?? key}`,
        name: properties.name,
        area: properties.city ?? properties.district ?? properties.locality ?? properties.state ?? "日本",
        address: addressParts.join("、") || properties.country || "日本",
        type: placeType(properties.osm_key, properties.osm_value),
        lat,
        lng,
      }];
    });
    return NextResponse.json({ places }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    console.error("Place search error", error);
    return NextResponse.json({ places: fallbackSearch(query), limited: true });
  }
}
