export interface CommunitySession {
  regionFr: string;
  regionEn: string;
  dateFr: string;
  dateEn: string;
  timeFr: string;
  timeEn: string;
  buildings: string[];
  meetingAddressFr: string;
  meetingAddressEn: string;
}

export const COMMUNITY_SESSIONS: CommunitySession[] = [
  {
    regionFr: "DDO/Pointe-Claire/Lachine",
    regionEn: "DDO/Pointe-Claire/Lachine",
    dateFr: "Lundi 23 février 2026",
    dateEn: "Monday, February 23, 2026",
    timeFr: "10 h 00 à 12 h 00",
    timeEn: "10:00 AM to 12:00 PM",
    buildings: [
      "1177-1185 55e Avenue",
      "1125 50th Avenue",
      "5000 rue Fairway & 1645 50e Avenue",
      "1600 50th Avenue",
      "2580 Dollard Avenue",
    ],
    meetingAddressFr: "5020 Fairway, unité 234, Lachine, Qc H8T 1B3",
    meetingAddressEn: "5020 Fairway, unit 234, Lachine, QC H8T 1B3",
  },
  {
    regionFr: "Laval – Le Corbusier",
    regionEn: "Laval – Le Corbusier",
    dateFr: "Lundi 23 février 2026",
    dateEn: "Monday, February 23, 2026",
    timeFr: "14 h 00 à 16 h 00",
    timeEn: "2:00 PM to 4:00 PM",
    buildings: ["2995 Le Corbusier"],
    meetingAddressFr: "1177 Autoroute 440, unité 200/400, Laval, Qc J5Z 4W8",
    meetingAddressEn: "1177 Autoroute 440, unit 200/400, Laval, QC J5Z 4W8",
  },
  {
    regionFr: "Vaudreuil-Dorion",
    regionEn: "Vaudreuil-Dorion",
    dateFr: "Mardi 24 février 2026",
    dateEn: "Tuesday, February 24, 2026",
    timeFr: "10 h 00 à 12 h 00",
    timeEn: "10:00 AM to 12:00 PM",
    buildings: ["401 Rue Marie-Curie"],
    meetingAddressFr: "401 Marie Curie, unité A, Vaudreuil-Dorion, J7V 5V5",
    meetingAddressEn: "401 Marie Curie, Unit A, Vaudreuil-Dorion, J7V 5V5",
  },
  {
    regionFr: "Corridor Trans-Canada et secteur Est",
    regionEn: "Trans-Canada Corridor & East End",
    dateFr: "Mardi 24 février 2026",
    dateEn: "Tuesday, February 24, 2026",
    timeFr: "13 h 00 à 17 h 00",
    timeEn: "1:00 PM to 5:00 PM",
    buildings: [
      "5500 Trans-Canada Highway",
      "7350 Trans-Canada Highway",
      "7800 Trans-Canada Highway",
      "117 Hymus Boulevard",
      "2900 Avenue André",
      "2520 Marie-Curie",
      "5685 Rue Cypihot",
      "3665 Boulevard Poirier",
      "700 McCaffrey Road",
    ],
    meetingAddressFr:
      "Novotel Hotel, 2599 Alfred Nobel, Montréal, QC (Salle « Pierrefonds B »)",
    meetingAddressEn:
      'Novotel Hotel, 2599 Alfred Nobel, Montreal, QC (Room "Pierrefonds B")',
  },
  {
    regionFr: "Laval – Chomedey",
    regionEn: "Laval – Chomedey",
    dateFr: "Mercredi 25 février 2026",
    dateEn: "Wednesday, February 25, 2026",
    timeFr: "10 h 00 à 12 h 00",
    timeEn: "10:00 AM to 12:00 PM",
    buildings: ["1313 Autoroute Chomedey"],
    meetingAddressFr:
      "Hotel Sheraton Laval, 2440 Autoroute des Laurentides, Laval, QC H7T 1X5 (Salle GIOTTO2, Rez-De-Chaussée)",
    meetingAddressEn:
      "Hotel Sheraton Laval, 2440 Laurentian Autoroute, Laval, QC H7T 1X5 (Room GIOTTO2, Ground Floor)",
  },
  {
    regionFr: "Boucherville / Rive-Sud",
    regionEn: "Boucherville / South Shore",
    dateFr: "Mercredi 25 février 2026",
    dateEn: "Wednesday, February 25, 2026",
    timeFr: "14 h 00 à 16 h 00",
    timeEn: "2:00 PM to 4:00 PM",
    buildings: [
      "2350 de la Province",
      "333 Chemin du Tremblay",
      "1500 rue Nobel",
    ],
    meetingAddressFr:
      "Centre multifonctionnel Francine-Gadbois, 1075 Rue Lionel-Daunais Studio 1, Boucherville, QC J4B 8N5 (Salle 7, 2e étage)",
    meetingAddressEn:
      "Centre multifonctionnel Francine-Gadbois, 1075 Rue Lionel-Daunais Studio 1, Boucherville, QC J4B 8N5 (Room 7, 2nd Floor)",
  },
  {
    regionFr: "Terrebonne",
    regionEn: "Terrebonne",
    dateFr: "Jeudi 26 février 2026",
    dateEn: "Thursday, February 26, 2026",
    timeFr: "10 h 00 à 12 h 00",
    timeEn: "10:00 AM to 12:00 PM",
    buildings: ["3055 rue Anderson, Terrebonne"],
    meetingAddressFr:
      "Centre d'affaires 1150, 1150 rue Lévis, Terrebonne, QC J6W 5S6 (Grande Salle)",
    meetingAddressEn:
      "Centre d'affaires 1150, 1150 rue Lévis, Terrebonne, QC J6W 5S6 (Main Hall)",
  },
  {
    regionFr: "Rivière des Prairies",
    regionEn: "Rivière des Prairies",
    dateFr: "Jeudi 26 février 2026",
    dateEn: "Thursday, February 26, 2026",
    timeFr: "14 h 00 à 16 h 00",
    timeEn: "2:00 PM to 4:00 PM",
    buildings: ["8000 Blaise-Pascal, Rivière des Prairies"],
    meetingAddressFr: "8000 Blaise Pascal, Montréal, QC H1E 2S7",
    meetingAddressEn: "8000 Blaise Pascal, Montreal, QC H1E 2S7",
  },
];
