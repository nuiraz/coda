"use strict";
// Photo de chaque carte pays : article Wikipédia (fr) d'un lieu emblématique, souvent la capitale
const PHOTOS_PAYS = {
  // Afrique
  DZ: "Alger", AO: "Luanda", BJ: "Porto-Novo", BW: "Gaborone", BF: "Ouagadougou",
  BI: "Gitega", CV: "Praia", CM: "Yaoundé", CF: "Bangui", TD: "N'Djaména",
  KM: "Moroni", CG: "Brazzaville", CD: "Kinshasa", CI: "Yamoussoukro", DJ: "Djibouti (ville)",
  EG: "Pyramide de Khéops", GQ: "Malabo", ER: "Asmara", SZ: "Mbabane", ET: "Addis-Abeba",
  GA: "Libreville", GM: "Banjul", GH: "Accra", GN: "Conakry", GW: "Bissau",
  KE: "Nairobi", LS: "Maseru", LR: "Monrovia", LY: "Tripoli", MG: "Antananarivo",
  MW: "Lilongwe", ML: "Bamako", MR: "Nouakchott", MU: "Port-Louis (Maurice)", MA: "Rabat",
  MZ: "Maputo", NA: "Windhoek", NE: "Niamey", NG: "Abuja", RW: "Kigali",
  ST: "São Tomé (ville)", SN: "Dakar", SC: "Victoria (Seychelles)", SL: "Freetown", SO: "Mogadiscio",
  ZA: "Le Cap", SS: "Djouba", SD: "Khartoum", TZ: "Kilimandjaro", TG: "Lomé",
  TN: "Tunis", UG: "Kampala", ZM: "Chutes Victoria", ZW: "Harare",
  // Europe
  AL: "Tirana", AD: "Andorre-la-Vieille", AT: "Vienne (Autriche)", BY: "Minsk", BE: "Bruxelles",
  BA: "Sarajevo", BG: "Sofia", HR: "Dubrovnik", CY: "Nicosie", CZ: "Prague",
  DK: "Copenhague", EE: "Tallinn", FI: "Helsinki", FR: "Paris", DE: "Berlin",
  GR: "Athènes", HU: "Budapest", IS: "Reykjavik", IE: "Dublin", IT: "Rome",
  LV: "Riga", LI: "Vaduz", LT: "Vilnius", LU: "Luxembourg (ville)", MT: "La Valette",
  MD: "Chișinău", MC: "Monaco", ME: "Kotor", NL: "Amsterdam", MK: "Skopje",
  NO: "Oslo", PL: "Varsovie", PT: "Lisbonne", RO: "Bucarest", RU: "Moscou",
  SM: "Saint-Marin (ville)", RS: "Belgrade", SK: "Bratislava", SI: "Ljubljana", ES: "Madrid",
  SE: "Stockholm", CH: "Berne", UA: "Kiev", GB: "Londres", VA: "Basilique Saint-Pierre",
  // Asie
  AF: "Kaboul", AM: "Erevan", AZ: "Bakou", BH: "Manama", BD: "Dacca",
  BT: "Thimphou", BN: "Bandar Seri Begawan", KH: "Angkor Vat", CN: "Pékin", GE: "Tbilissi",
  IN: "Taj Mahal", ID: "Jakarta", IR: "Téhéran", IQ: "Bagdad", IL: "Jérusalem",
  JP: "Tokyo", JO: "Pétra", KZ: "Astana", KW: "Koweït (ville)", KG: "Bichkek",
  LA: "Vientiane", LB: "Beyrouth", MY: "Kuala Lumpur", MV: "Malé", MN: "Oulan-Bator",
  MM: "Rangoun", NP: "Katmandou", KP: "Pyongyang", OM: "Mascate", PK: "Islamabad",
  PS: "Ramallah", PH: "Manille", QA: "Doha", SA: "Riyad", SG: "Singapour",
  KR: "Séoul", LK: "Sigiriya", SY: "Damas", TJ: "Douchanbé", TH: "Bangkok",
  TL: "Dili", TR: "Istanbul", TM: "Achgabat", AE: "Dubaï", UZ: "Samarcande",
  VN: "Hanoï", YE: "Sanaa",
  // Amériques
  AG: "Saint John's (Antigua-et-Barbuda)", BS: "Nassau (Bahamas)", BB: "Bridgetown", BZ: "Belmopan", CA: "Ottawa",
  CR: "San José (Costa Rica)", CU: "La Havane", DM: "Roseau (Dominique)", DO: "Saint-Domingue", SV: "San Salvador",
  GD: "Saint-Georges (Grenade)", GT: "Guatemala (ville)", HT: "Port-au-Prince", HN: "Tegucigalpa", JM: "Kingston (Jamaïque)",
  MX: "Mexico", NI: "Managua", PA: "Panama (ville)", KN: "Basseterre", LC: "Castries",
  VC: "Kingstown", TT: "Port-d'Espagne", US: "Washington (district de Columbia)", AR: "Buenos Aires", BO: "La Paz",
  BR: "Rio de Janeiro", CL: "Santiago (Chili)", CO: "Bogota", EC: "Quito", GY: "Georgetown (Guyana)",
  PY: "Asuncion", PE: "Machu Picchu", SR: "Paramaribo", UY: "Montevideo", VE: "Caracas",
  // Océanie
  AU: "Opéra de Sydney", FJ: "Suva", KI: "Tarawa-Sud", MH: "Majuro", FM: "Palikir",
  NR: "Yaren", NZ: "Wellington", PW: "Ngerulmud", PG: "Port Moresby", WS: "Apia",
  SB: "Honiara", TO: "Nuku'alofa", TV: "Funafuti", VU: "Port-Vila"
};
