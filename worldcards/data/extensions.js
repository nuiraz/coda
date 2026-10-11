"use strict";

// Extensions de cartes : Villes, Monuments, Nature et Événements Saisonniers
const VILLES_NOUVELLES = [
  ["kyoto", "Kyoto", "JP", 35.011, 135.768, "⛩️", "Ancienne capitale impériale du Japon pendant plus de mille ans, célèbre pour ses milliers de temples et ses sanctuaires shinto.", "Kyoto"],
  ["montreal", "Montréal", "CA", 45.501, -73.567, "🍁", "Deuxième plus grande ville francophone du monde après Paris, bâtie autour du mont Royal.", "Montréal"],
  ["istanbul", "Istanbul", "TR", 41.008, 28.978, "🕌", "Unique métropole au monde construite à cheval sur deux continents : l'Europe et l'Asie, séparés par le Bosphore.", "Istanbul"],
  ["reykjavik", "Reykjavik", "IS", 64.146, -21.942, "🌋", "Capitale la plus septentrionale du monde, entièrement alimentée par l'énergie géothermique naturelle.", "Reykjavik"],
  ["seoul", "Séoul", "KR", 37.566, 126.978, "⚡", "Mégalopole futuriste ultra-connectée abritant cinq grands palais royaux de la dynastie Joseon.", "Séoul"],
  ["marrakech", "Marrakech", "MA", 31.629, -7.981, "🏮", "La « ville rouge » impériale dont la place Jemaa el-Fna est classée au patrimoine culturel immatériel mondial.", "Marrakech"],
  ["sydney-ville", "Sydney", "AU", -33.868, 151.209, "🦘", "Bordée par l'une des plus belles baies du globe, célèbre pour son pont Harbour Bridge et ses plages de surf.", "Sydney"],
  ["le-caire", "Le Caire", "EG", 30.044, 31.235, "🏺", "La « cité aux mille minarets », plus grande agglomération du monde arabe située au seuil du delta du Nil.", "Le Caire"],
  ["rio", "Rio de Janeiro", "BR", -22.906, -43.172, "🎭", "La « Cidade Maravilhosa » avec le mont du Pain de Sucre, la plage de Copacabana et le plus grand carnaval de la planète.", "Rio de Janeiro"],
  ["prague", "Prague", "CZ", 50.075, 14.437, "🏰", "La « ville aux cent clochers », joyau de Bohême traversé par le pont Charles et dominé par son château colossal.", "Prague"],
  ["amsterdam", "Amsterdam", "NL", 52.367, 4.904, "🚲", "La « Venise du Nord » aux plus de 100 kilomètres de canaux et plus d'un million de vélos en circulation.", "Amsterdam"],
  ["singapour", "Singapour", "SG", 1.352, 103.819, "🦁", "Cité-État insulaire d'Asie du Sud-Est, renommée pour ses jardins futuristes Gardens by the Bay et son port géant.", "Singapour"],
  ["san-francisco", "San Francisco", "US", 37.774, -122.419, "🌁", "Célèbre pour ses collines escarpées, ses tramways historiques à câble et le majestueux Golden Gate Bridge.", "San Francisco"],
  ["barcelone", "Barcelone", "ES", 41.387, 2.168, "🎨", "Capitale de la Catalogne illuminée par les chefs-d'œuvre modernistes d'Antoni Gaudí.", "Barcelone"],
  ["dubrovnik", "Dubrovnik", "HR", 42.650, 18.094, "🌊", "La « perle de l'Adriatique », forteresse médiévale aux remparts intacts plongeant dans les eaux turquoise.", "Dubrovnik"],
  ["vancouver", "Vancouver", "CA", 49.282, -123.120, "🌲", "Cité côtière spectaculaire entourée par l'océan Pacifique et des montagnes aux sommets enneigés.", "Vancouver"],
  ["buenos-aires", "Buenos Aires", "AR", -34.603, -58.381, "💃", "Capitale passionnée du tango, marquée par sa célèbre avenue 9 de Julio et le quartier coloré de La Boca.", "Buenos Aires"],
  ["vienne", "Vienne", "AT", 48.208, 16.373, "🎻", "Capitale mondiale de la musique classique où ont composé Mozart, Beethoven, Schubert et Johann Strauss.", "Vienne (Autriche)"],
  ["florence", "Florence", "IT", 43.769, 11.255, "⚜️", "Berceau étincelant de la Renaissance italienne, dominé par la coupole magistrale de Brunelleschi.", "Florence"],
  ["edimbourg", "Édimbourg", "GB", 55.953, -3.188, "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Capitale écossaise bâtie sur d'anciens volcans éteints, dominée par son château millénaire.", "Édimbourg"],
];

const MONUMENTS_NOUVEAUX = [
  ["sagrada-familia", "Sagrada Família", "ES", 41.403, 2.174, "⛪", "legendaire", "Chef-d'œuvre absolu de Gaudí à Barcelone, basilique monumentale en chantier depuis 1882.", "Sagrada Família"],
  ["colisee", "Colisée de Rome", "IT", 41.890, 12.492, "🏛️", "legendaire", "Le plus grand amphithéâtre jamais construit dans l'Empire romain, pouvant accueillir 50 000 spectateurs.", "Colisée"],
  ["pyramides-gizeh", "Pyramides de Gizeh", "EG", 29.979, 31.134, "🔺", "legendaire", "La seule des sept merveilles du monde antique encore debout aujourd'hui, vieille de plus de 4 500 ans.", "Pyramide de Khéops"],
  ["machu-picchu", "Machu Picchu", "PE", -13.163, -72.544, "🦙", "legendaire", "Cité inca sacrée du XVe siècle perchée sur un promontoire rocheux à 2 430 m d'altitude dans les Andes.", "Machu Picchu"],
  ["parthenon", "Parthénon d'Athènes", "GR", 37.971, 23.726, "🏛️", "ultra-rare", "Temple dédié à la déesse Athéna au sommet de l'Acropole, symbole suprême de la Grèce antique.", "Parthénon"],
  ["opera-sydney-monu", "Opéra de Sydney", "AU", -33.856, 151.215, "⛵", "ultra-rare", "Chef-d'œuvre architectural du XXe siècle conçu par Jørn Utzon, évoquant de gigantesques voiles blanches.", "Opéra de Sydney"],
  ["tour-pise", "Tour de Pise", "IT", 43.723, 10.396, "📐", "rare", "Campanile célèbre pour son inclinaison involontaire de près de 4 degrés causée par un sol meuble.", "Tour de Pise"],
  ["big-ben-monu", "Big Ben & Westminster", "GB", 51.500, -0.124, "🕰️", "rare", "La légendaire tour de l'Horloge du palais de Westminster à Londres, symbole de la nation britannique.", "Big Ben"],
  ["alhambra-grenade", "Alhambra de Grenade", "ES", 37.177, -3.588, "🏰", "ultra-rare", "Somptueux ensemble palatial maure de l'émirat nasride, chef-d'œuvre de l'art hispano-mauresque.", "Alhambra (Grenade)"],
  ["angkor-wat", "Angkor Vat", "KH", 13.412, 103.866, "🛕", "legendaire", "Le plus grand monument religieux au monde, joyau de l'empire khmer étendu sur plus de 160 hectares.", "Angkor Vat"],
];

const NATURE_NOUVELLE = [
  ["grand-canyon", "Grand Canyon", "US", 36.106, -112.112, "🏜️", "legendaire", "Gorge titanesque creusée par le fleuve Colorado, profonde de 1 800 mètres et longue de 446 km.", "Grand Canyon"],
  ["baie-halong", "Baie d'Ha Long", "VN", 20.910, 107.183, "🛶", "ultra-rare", "Émeraude marine abritant près de 2 000 îlots karstiques recouverts de végétation tropicale.", "Baie d'Ha Long"],
  ["mont-blanc", "Mont Blanc", "FR", 45.832, 6.865, "🏔️", "ultra-rare", "Point culminant de la chaîne des Alpes et d'Europe occidentale à 4 808 mètres d'altitude.", "Mont Blanc"],
  ["mont-fuji", "Mont Fuji", "JP", 35.360, 138.727, "🗻", "legendaire", "Volcan sacré au cône parfait culminant à 3 776 mètres, immortalisé par les estampes d'Hokusai.", "Mont Fuji"],
  ["salar-uyuni", "Salar d'Uyuni", "BO", -20.133, -67.489, "🧂", "ultra-rare", "Le plus grand désert de sel au monde, se transformant en un gigantesque miroir céleste à la saison des pluies.", "Salar d'Uyuni"],
  ["chutes-victoria", "Chutes Victoria", "ZM", -17.924, 25.857, "🌊", "legendaire", "« La fumée qui gronde » : l'une des plus spectaculaires cataractes de la planète sur le fleuve Zambèze.", "Chutes Victoria"],
  ["mer-morte", "Mer Morte", "JO", 31.559, 35.473, "🌊", "rare", "Lac salé situé au point terrestre le plus bas du globe (-434 m), où sa salinité permet de flotter sans effort.", "Mer Morte"],
  ["barriere-corail", "Grande Barrière de Corail", "AU", -18.287, 147.699, "🐠", "legendaire", "La plus gigantesque structure vivante de la Terre, visible depuis l'espace sur plus de 2 300 kilomètres.", "Grande Barrière de corail"],
];

// CARTES SAISONNIÈRES EXCLUSIVES (Halloween & Noël)
const EVENEMENTS_SAISONNIERS = {
  halloween: {
    nom: "Halloween 🎃",
    theme: "Épouvante & Légendes",
    emoji: "🎃",
    couleur: "#e65100",
    cartes: [
      ["hallow_dracula", "Château de Bran (Dracula)", "RO", "🧛", "legendaire", "La légendaire forteresse gothique de Transylvanie associée au mythe du comte Dracula.", "Château de Bran"],
      ["hallow_catacombes", "Catacombes de Paris", "FR", "💀", "epique", "Labyrinthe souterrain abritant les ossements de plus de six millions de Parisiens sous la capitale.", "Catacombes de Paris"],
      ["hallow_salem", "Sorcières de Salem", "US", "🧹", "rare", "Ville historique du Massachusetts célèbre dans le monde entier pour ses procès en sorcellerie de 1692.", "Sorcières de Salem"],
      ["hallow_foret_noire", "Forêt Noire Hantée", "DE", "🌲", "rare", "Massif montagneux ténébreux d'Allemagne ayant inspiré les contes féeriques et mystérieux des frères Grimm.", "Forêt-Noire"],
      ["hallow_loch_ness", "Monstre du Loch Ness", "GB", "🐉", "epique", "Nessie, la légendaire créature aquatique supposée hanter les profondeurs du lac écossais depuis des siècles.", "Monstre du Loch Ness"],
      ["hallow_dia_muertos", "Día de los Muertos", "MX", "🕯️", "ultra-rare", "Fête mexicaine inscrite à l'UNESCO célébrant le retour chaleureux des défunts avec des autels illuminés.", "Jour des morts (Mexique)"],
    ]
  },
  noel: {
    nom: "Féerie de Noël 🎄",
    theme: "Fêtes & Merveilles Polaires",
    emoji: "🎄",
    couleur: "#1b5e20",
    cartes: [
      ["noel_rovaniemi", "Village du Père Noël", "FI", "🎅", "legendaire", "Le village officiel du Père Noël situé exactement sur la ligne du cercle polaire arctique en Laponie.", "Rovaniemi"],
      ["noel_strasbourg", "Marché de Noël de Strasbourg", "FR", "🎄", "epique", "La « capitale de Noël » accueille le Christkindelsmärik depuis 1570, l'un des plus anciens d'Europe.", "Marché de Noël de Strasbourg"],
      ["noel_aurore", "Aurore Boréale Polaire", "NO", "🌌", "legendaire", "Symphonie lumineuse céleste ondulant dans le ciel nocturne sous l'effet des vents solaires.", "Aurore polaire"],
      ["noel_rockefeller", "Sapin du Rockefeller Center", "US", "🌟", "ultra-rare", "L'arbre de Noël le plus célèbre du monde érigé chaque hiver au cœur de Manhattan à New York.", "Arbre de Noël du Rockefeller Center"],
      ["noel_buche", "Bûche Traditionnelle de Noël", "FR", "🪵", "rare", "Gâteau pâtissier emblématique du réveillon de Noël, héritier de la coutume médiévale de la bûche de bois.", "Bûche de Noël"],
      ["noel_renne", "Renne du Grand Nord", "FI", "🦌", "rare", "Animal emblématique des toundras arctiques, fidèle compagnon des peuples samis et des attelages féeriques.", "Renne"],
    ]
  }
};
