"use strict";
// Cartes supplémentaires par pays (Amériques et Océanie)
// [type, id, nom, code pays, lat, lon, emoji, rareté, anecdote, titre Wikipédia fr]
const CARTES_PAYS_AMOC = [
  // Antigua-et-Barbuda
  ["monument", "nelsons-dockyard", "Nelson's Dockyard", "AG", 17.007, -61.762, "⚓", "rare", "Ce chantier naval géorgien d'English Harbour, inscrit au patrimoine mondial de l'UNESCO en 2016, porte le nom de l'amiral Horatio Nelson qui y servit dans les années 1780.", "Nelson's Dockyard"],
  ["nature", "barbuda", "Barbuda", "AG", 17.627, -61.800, "🏝️", "peu-commun", "Sa lagune de Codrington abrite l'une des plus grandes colonies de frégates superbes des Caraïbes.", "Barbuda"],
  ["nature", "redonda", "Redonda", "AG", 16.938, -62.346, "🪨", "rare", "Cette île rocheuse inhabitée a donné naissance à un « royaume de Redonda » fantaisiste, revendiqué par des écrivains depuis la fin du XIXe siècle.", "Redonda"],
  ["animal", "fregate-superbe", "Frégate superbe", "AG", null, null, "🐦", "peu-commun", "Pour séduire les femelles, le mâle gonfle une grande poche rouge vif sous sa gorge.", "Frégate superbe"],
  ["animal", "tortue-imbriquee", "Tortue imbriquée", "AG", null, null, "🐢", "rare", "En danger critique d'extinction, elle vient pondre sur les plages d'Antigua, où ses nids sont suivis depuis 1987 sur l'île de Long Island.", "Tortue imbriquée"],
  ["culture", "viv-richards", "Viv Richards", "AG", null, null, "🏏", "epique", "Né à Saint John's, ce batteur de légende a remporté les Coupes du monde de cricket 1975 et 1979 avec les Indes occidentales.", "Viv Richards"],
  // Bahamas
  ["ville", "freeport-bahamas", "Freeport", "BS", 26.533, -78.700, "🚢", "peu-commun", "Deuxième ville des Bahamas, sur l'île de Grand Bahama, elle a été créée dans les années 1950 comme zone franche.", "Freeport (Bahamas)"],
  ["nature", "deans-blue-hole", "Dean's Blue Hole", "BS", 23.107, -75.008, "🕳️", "epique", "Avec environ 200 m de profondeur, ce trou bleu de Long Island a longtemps été le plus profond connu au monde.", "Dean's Blue Hole"],
  ["nature", "exuma", "Exuma", "BS", 23.533, -75.833, "🐖", "rare", "Sur l'îlot de Big Major Cay, dans les Exumas, vivent des cochons devenus célèbres pour nager à la rencontre des bateaux.", "Exuma"],
  ["plat", "strombe-geant", "Strombe géant", "BS", null, null, "🐚", "peu-commun", "Appelé conch, ce grand coquillage est la spécialité nationale des Bahamas, servi en salade, en soupe ou en beignets.", "Strombe géant"],
  ["culture", "junkanoo", "Junkanoo", "BS", null, null, "🥁", "rare", "Ce défilé costumé, rythmé par les tambours en peau de chèvre et les cloches, anime Nassau aux petites heures du 26 décembre et du 1er janvier.", "Junkanoo"],
  // Barbade
  ["ville", "holetown", "Holetown", "BB", 13.187, -59.638, "⛵", "peu-commun", "Premier établissement anglais de l'île, fondé en 1627, elle s'appelait d'abord Jamestown.", "Holetown"],
  ["monument", "garnison-bridgetown", "Bridgetown historique et sa garnison", "BB", 13.074, -59.607, "🏰", "rare", "Inscrit au patrimoine mondial de l'UNESCO en 2011, cet ensemble réunit la vieille ville coloniale et l'ancienne garnison britannique.", "Bridgetown historique et sa garnison"],
  ["nature", "mont-hillaby", "Mont Hillaby", "BB", 13.217, -59.583, "⛰️", "peu-commun", "Point culminant de la Barbade, il ne s'élève qu'à environ 340 m d'altitude.", "Mont Hillaby"],
  ["plat", "cou-cou", "Cou-cou", "BB", null, null, "🍲", "peu-commun", "Cette polenta de maïs aux gombos forme, avec le poisson volant, le plat national de la Barbade.", "Cou-cou"],
  ["culture", "crop-over", "Crop Over", "BB", null, null, "🎉", "rare", "Née pour célébrer la fin de la récolte de la canne à sucre, cette fête culmine début août avec le défilé du Grand Kadooment.", "Crop Over"],
  // Belize
  ["nature", "barriere-corail-belize", "Barrière de corail du Belize", "BZ", 17.267, -87.817, "🪸", "epique", "Inscrite au patrimoine mondial de l'UNESCO en 1996, elle est la plus grande barrière de corail de l'hémisphère nord.", "Barrière de corail du Belize"],
  ["animal", "toucan-carene", "Toucan à carène", "BZ", null, null, "🦜", "peu-commun", "Oiseau national du Belize, il possède un bec multicolore qui peut atteindre le tiers de la longueur de son corps.", "Toucan à carène"],
  ["culture", "garifunas", "Garifunas", "BZ", null, null, "🥁", "rare", "Descendants d'Africains et d'Amérindiens caraïbes, les Garifunas fêtent chaque 19 novembre leur arrivée au Belize en 1832.", "Garifunas"],
  // Dominique
  ["ville", "portsmouth-dominique", "Portsmouth", "DM", 15.583, -61.467, "⚓", "peu-commun", "Deuxième ville de la Dominique, elle borde la baie de Prince Rupert, au pied du parc national des Cabrits.", "Portsmouth (Dominique)"],
  ["nature", "morne-trois-pitons", "Parc national du Morne Trois Pitons", "DM", 15.367, -61.333, "🌋", "rare", "Inscrit au patrimoine mondial de l'UNESCO en 1997, ce parc volcanique abrite le célèbre Boiling Lake.", "Parc national du Morne Trois Pitons"],
  ["nature", "morne-diablotins", "Morne Diablotins", "DM", 15.503, -61.397, "⛰️", "peu-commun", "Avec 1 447 m, ce volcan est le point culminant de la Dominique.", "Morne Diablotins"],
  ["culture", "kalinagos", "Kalinagos", "DM", null, null, "🛶", "rare", "La Dominique abrite le territoire kalinago, où vivent les derniers descendants des Caraïbes insulaires des Petites Antilles.", "Kalinagos"],
  // Salvador
  ["ville", "santa-ana-salvador", "Santa Ana", "SV", 13.994, -89.560, "⛪", "peu-commun", "Deuxième ville du Salvador, elle est dominée par une cathédrale néogothique blanche.", "Santa Ana (Salvador)"],
  ["monument", "tazumal", "Tazumal", "SV", 13.979, -89.674, "🛕", "rare", "Ce site archéologique maya se trouve au cœur de la ville de Chalchuapa, dans l'ouest du Salvador.", "Tazumal"],
  // Grenade
  ["ville", "grenville-grenade", "Grenville", "GD", 12.122, -61.624, "🌰", "peu-commun", "Deuxième ville de la Grenade, elle se trouve sur la côte est de l'île, face à l'Atlantique.", "Grenville (Grenade)"],
  ["monument", "fort-george-grenade", "Fort George", "GD", 12.045, -61.752, "🏰", "rare", "Construit par les Français au début du XVIIIe siècle sous le nom de Fort Royal, il domine le port de Saint-Georges.", "Fort George (Grenade)"],
  ["nature", "carriacou", "Carriacou", "GD", 12.483, -61.450, "🏝️", "peu-commun", "Rattachée à la Grenade, elle est la plus grande île de l'archipel des Grenadines.", "Carriacou"],
  ["nature", "kick-em-jenny", "Kick-'em-Jenny", "GD", 12.300, -61.640, "🌋", "epique", "Ce volcan sous-marin, situé à environ 8 km au nord de la Grenade, est le plus actif des Petites Antilles.", "Kick-'em-Jenny"],
  ["plat", "muscade", "Muscade", "GD", null, null, "🌰", "rare", "Surnommée l'île aux épices, la Grenade est l'un des premiers producteurs mondiaux de muscade, qui figure sur son drapeau.", "Muscade"],
  // Haïti
  ["ville", "cap-haitien", "Cap-Haïtien", "HT", 19.759, -72.200, "🏛️", "peu-commun", "Sous le nom de Cap-Français, elle fut la capitale de la colonie française de Saint-Domingue.", "Cap-Haïtien"],
  ["nature", "pic-la-selle", "Pic la Selle", "HT", 18.362, -71.976, "⛰️", "rare", "Point culminant d'Haïti, il s'élève à 2 680 m dans le massif de la Selle.", "Pic la Selle"],
  ["culture", "compas", "Compas", "HT", null, null, "🎷", "peu-commun", "Ce genre musical dansant a été lancé en 1955 par le saxophoniste haïtien Nemours Jean-Baptiste.", "Compas (musique)"],
  // Honduras
  ["ville", "san-pedro-sula", "San Pedro Sula", "HN", 15.504, -88.025, "🏭", "peu-commun", "Capitale économique du Honduras, elle a été fondée en 1536 par le conquistador Pedro de Alvarado.", "San Pedro Sula"],
  ["nature", "roatan", "Roatán", "HN", 16.350, -86.450, "🏝️", "rare", "Plus grande des îles de la Baie, elle borde le récif mésoaméricain, la deuxième plus grande barrière de corail du monde.", "Roatán"],
  ["plat", "baleada", "Baleada", "HN", null, null, "🌮", "commun", "Cette tortilla de farine pliée, garnie de haricots rouges frits, de fromage et de crème, est l'en-cas le plus populaire du Honduras.", "Baleada"],
  // Jamaïque
  ["ville", "montego-bay", "Montego Bay", "JM", 18.471, -77.919, "🏖️", "peu-commun", "Principale destination touristique de la Jamaïque, elle accueille l'aéroport international Sangster.", "Montego Bay"],
  ["monument", "musee-bob-marley", "Musée Bob Marley", "JM", 18.024, -76.780, "🎸", "rare", "Installé au 56 Hope Road à Kingston, dans l'ancienne maison du chanteur, il a ouvert au public en 1986.", "Musée Bob Marley"],
  ["nature", "blue-mountains-jamaique", "Blue Mountains de Jamaïque", "JM", 18.047, -76.578, "☕", "rare", "Ces montagnes, qui culminent à 2 256 m, donnent leur nom à l'un des cafés les plus chers du monde.", "Blue Mountains (Jamaïque)"],
  ["plat", "akee", "Akée", "JM", null, null, "🍳", "peu-commun", "Toxique avant maturité, ce fruit est cuisiné avec de la morue salée dans le plat national jamaïcain, l'ackee and saltfish.", "Akée"],
  // Nicaragua
  ["ville", "managua", "Managua", "NI", 12.136, -86.251, "🏙️", "peu-commun", "Capitale du Nicaragua depuis 1852, elle a été en grande partie détruite par le séisme de 1972.", "Managua"],
  ["monument", "leon-viejo", "Ruines de León Viejo", "NI", 12.399, -86.616, "🧱", "rare", "Fondée en 1524 puis abandonnée en 1610 après des séismes, cette ville coloniale est inscrite au patrimoine mondial de l'UNESCO.", "Ruines de León Viejo"],
  ["nature", "ometepe", "Ometepe", "NI", 11.500, -85.583, "🌋", "rare", "Formée par les volcans Concepción et Maderas, cette île se dresse au milieu du lac Nicaragua.", "Ometepe"],
  ["culture", "gueguense", "El Güegüense", "NI", null, null, "🎭", "rare", "Cette comédie-ballet satirique de l'époque coloniale, mêlant espagnol et nahuatl, est inscrite au patrimoine immatériel de l'UNESCO.", "El Güegüense"],
  // Saint-Christophe-et-Niévès
  ["ville", "charlestown-nieves", "Charlestown", "KN", 17.138, -62.623, "🏘️", "peu-commun", "Capitale de l'île de Niévès, elle est la ville natale d'Alexander Hamilton, l'un des pères fondateurs des États-Unis.", "Charlestown (Saint-Christophe-et-Niévès)"],
  ["monument", "brimstone-hill", "Forteresse de Brimstone Hill", "KN", 17.347, -62.837, "🏰", "epique", "Surnommée le Gibraltar des Antilles, cette forteresse britannique est inscrite au patrimoine mondial de l'UNESCO depuis 1999.", "Parc national de la forteresse de Brimstone Hill"],
  ["nature", "mont-liamuiga", "Mont Liamuiga", "KN", 17.367, -62.800, "🌋", "rare", "Ce stratovolcan de 1 156 m est le point culminant de Saint-Christophe-et-Niévès.", "Mont Liamuiga"],
  ["nature", "nieves", "Niévès", "KN", 17.150, -62.583, "🏝️", "peu-commun", "Cette petite île volcanique ronde est dominée par le pic de Nevis, souvent coiffé de nuages.", "Niévès"],
  ["animal", "pelican-brun", "Pélican brun", "KN", null, null, "🐦", "peu-commun", "Oiseau national de Saint-Christophe-et-Niévès, il pêche en plongeant en piqué depuis les airs, une technique rare chez les pélicans.", "Pélican brun"],
  // Sainte-Lucie
  ["ville", "soufriere-sainte-lucie", "Soufrière", "LC", 13.857, -61.057, "🌋", "peu-commun", "Ancienne capitale de l'île à l'époque française, elle se trouve au pied des Pitons.", "Soufrière (Sainte-Lucie)"],
  ["monument", "cathedrale-castries", "Cathédrale de l'Immaculée-Conception de Castries", "LC", 14.011, -60.989, "⛪", "rare", "Ses murs intérieurs sont couverts de fresques du peintre saint-lucien Dunstan St. Omer, qui y a représenté des saints noirs.", "Cathédrale de l'Immaculée-Conception de Castries"],
  ["nature", "pitons-sainte-lucie", "Pitons", "LC", 13.808, -61.064, "⛰️", "epique", "Ces deux pitons volcaniques jumeaux plongeant dans la mer sont inscrits au patrimoine mondial de l'UNESCO depuis 2004.", "Pitons (Sainte-Lucie)"],
  ["nature", "mont-gimie", "Mont Gimie", "LC", 13.867, -61.017, "⛰️", "peu-commun", "Culminant à environ 950 m, c'est le point culminant de Sainte-Lucie.", "Mont Gimie"],
  ["culture", "derek-walcott", "Derek Walcott", "LC", null, null, "📖", "epique", "Né à Castries en 1930, ce poète et dramaturge a reçu le prix Nobel de littérature en 1992.", "Derek Walcott"],
  // Saint-Vincent-et-les-Grenadines
  ["monument", "fort-charlotte-saint-vincent", "Fort Charlotte", "VC", 13.159, -61.244, "🏰", "peu-commun", "Bâti par les Britanniques sur un promontoire dominant Kingstown, il fut achevé en 1806 et nommé d'après la reine Charlotte.", "Fort Charlotte (Saint-Vincent-et-les-Grenadines)"],
  ["nature", "soufriere-saint-vincent", "La Soufrière", "VC", 13.330, -61.180, "🌋", "rare", "Ce volcan, point culminant de Saint-Vincent, est entré en éruption explosive en avril 2021.", "La Soufrière (Saint-Vincent)"],
  ["nature", "tobago-cays", "Tobago Cays", "VC", 12.633, -61.358, "🐢", "rare", "Ces îlots inhabités entourés d'un récif en fer à cheval ont servi de décor au film Pirates des Caraïbes.", "Tobago Cays"],
  ["nature", "moustique", "Moustique", "VC", 12.877, -61.183, "🏝️", "peu-commun", "Achetée en 1958 par Colin Tennant, cette île privée des Grenadines a accueilli la villa de la princesse Margaret.", "Moustique (île)"],
  ["plat", "arrow-root", "Arrow-root", "VC", null, null, "🌿", "peu-commun", "Saint-Vincent est l'un des principaux producteurs mondiaux de cette fécule tirée des rhizomes de Maranta arundinacea.", "Arrow-root"],
  // Trinité-et-Tobago
  ["ville", "scarborough-tobago", "Scarborough", "TT", 11.183, -60.733, "🏝️", "peu-commun", "Principale ville de l'île de Tobago, elle est dominée par le fort King George, bâti par les Britanniques au XVIIIe siècle.", "Scarborough (Trinité-et-Tobago)"],
  ["plat", "roti", "Roti", "TT", null, null, "🫓", "commun", "Introduit par les travailleurs engagés venus d'Inde au XIXe siècle, ce pain plat garni de curry est un incontournable de la cuisine trinidadienne.", "Roti"],
  ["culture", "carnaval-trinite", "Carnaval de Trinité-et-Tobago", "TT", null, null, "🎉", "epique", "Il se déroule les lundi et mardi précédant le mercredi des Cendres, en commençant à l'aube par le J'ouvert.", "Carnaval de Trinité-et-Tobago"],
  // Guyana
  ["monument", "cathedrale-saint-georges-georgetown", "Cathédrale Saint-Georges de Georgetown", "GY", 6.811, -58.162, "⛪", "rare", "Haute d'environ 43 m, cette cathédrale anglicane achevée en 1892 compte parmi les plus hautes églises en bois du monde.", "Cathédrale Saint-Georges de Georgetown"],
  ["plat", "pepperpot", "Pepperpot", "GY", null, null, "🍲", "peu-commun", "Ce ragoût de viande parfumé au cassareep, un extrait de manioc d'origine amérindienne, est le plat national du Guyana.", "Pepperpot"],
  ["culture", "mashramani", "Mashramani", "GY", null, null, "🎉", "rare", "Ce carnaval célébré autour du 23 février marque l'anniversaire de la proclamation de la république du Guyana en 1970.", "Mashramani"],
  // Suriname
  ["monument", "fort-zeelandia-paramaribo", "Fort Zeelandia", "SR", 5.827, -55.150, "🏰", "rare", "Bâti au XVIIe siècle au bord du fleuve Suriname, il abrite aujourd'hui le musée du Suriname.", "Fort Zeelandia (Paramaribo)"],
  ["nature", "suriname-central", "Réserve naturelle du Suriname central", "SR", 4.000, -56.000, "🌳", "epique", "Couvrant 1,6 million d'hectares de forêt tropicale intacte, elle est inscrite au patrimoine mondial de l'UNESCO depuis 2000.", "Réserve naturelle du Suriname central"],
  ["animal", "pipa-pipa", "Pipa pipa", "SR", null, null, "🐸", "rare", "Ce crapaud aplati porte ses œufs incrustés dans la peau de son dos, d'où sortent directement de petits crapauds.", "Pipa pipa"],
  ["plat", "pom", "Pom", "SR", null, null, "🥘", "peu-commun", "Ce gratin de poulet et de tubercule de tayer râpé, d'origine juive et créole, est le plat de fête préféré des Surinamais.", "Pom (plat)"],
  ["culture", "winti", "Winti", "SR", null, null, "🥁", "rare", "Cette religion afro-surinamienne, fondée sur la croyance en des esprits appelés winti, est pratiquée par des Créoles et des Marrons du Suriname.", "Winti"],
  // Fidji
  ["ville", "levuka", "Levuka", "FJ", -17.683, 178.833, "🏘️", "peu-commun", "Première capitale coloniale des Fidji, cette ville portuaire est inscrite au patrimoine mondial de l'UNESCO depuis 2013.", "Levuka"],
  ["animal", "iguane-crete-fidji", "Iguane à crête des Fidji", "FJ", null, null, "🦎", "epique", "Décrit seulement en 1981, ce reptile vert vif vit surtout sur le petit îlot de Yadua Taba.", "Brachylophus vitiensis"],
  ["culture", "rugby-sept-fidji", "Rugby à sept fidjien", "FJ", null, null, "🏉", "rare", "En remportant l'or du rugby à sept aux Jeux de Rio en 2016, l'équipe des Fidji a offert au pays sa première médaille olympique.", "Équipe des Fidji de rugby à sept"],
  // Kiribati
  ["ville", "betio", "Betio", "KI", -1.355, 172.928, "🪖", "peu-commun", "Cet îlot de l'atoll de Tarawa fut en novembre 1943 le théâtre de la bataille de Tarawa, l'une des plus sanglantes de la guerre du Pacifique.", "Betio"],
  ["nature", "iles-phoenix", "Aire protégée des îles Phoenix", "KI", -4.000, -172.000, "🐠", "epique", "Inscrite au patrimoine mondial de l'UNESCO en 2010, c'est l'une des plus vastes aires marines protégées du monde.", "Aire protégée des îles Phoenix"],
  ["nature", "banaba", "Banaba", "KI", -0.877, 169.535, "⛏️", "rare", "Ravagée par l'extraction du phosphate au XXe siècle, l'île a vu la plupart de ses habitants déplacés vers l'île fidjienne de Rabi.", "Banaba"],
  ["plat", "pandanus", "Pandanus", "KI", null, null, "🌴", "commun", "Ses fruits sont un aliment de base aux Kiribati, où ses feuilles servent aussi à tresser nattes et toitures.", "Pandanus tectorius"],
  // Îles Marshall
  ["ville", "ebeye", "Ebeye", "MH", 8.783, 167.737, "🏘️", "peu-commun", "Cet îlot de l'atoll de Kwajalein compte parmi les endroits les plus densément peuplés du Pacifique.", "Ebeye"],
  ["nature", "bikini", "Atoll de Bikini", "MH", 11.583, 165.383, "☢️", "epique", "Les États-Unis y ont réalisé 23 essais nucléaires entre 1946 et 1958, dont l'explosion Castle Bravo en 1954.", "Atoll de Bikini"],
  ["nature", "enewetak", "Enewetak", "MH", 11.500, 162.333, "💥", "rare", "En 1952, cet atoll a servi de site au premier essai d'une bombe à hydrogène, Ivy Mike.", "Enewetak"],
  ["nature", "kwajalein", "Kwajalein", "MH", 9.183, 167.467, "🚀", "rare", "L'un des plus grands atolls du monde, il accueille une base d'essais de missiles de l'armée américaine.", "Kwajalein"],
  ["animal", "benitier-geant", "Bénitier géant", "MH", null, null, "🐚", "rare", "Plus grand coquillage bivalve vivant, il peut dépasser 1 m de long et 200 kg.", "Bénitier géant"],
  ["plat", "coprah", "Coprah", "MH", null, null, "🥥", "commun", "Cette amande de noix de coco séchée est l'une des principales exportations des îles Marshall.", "Coprah"],
  // Micronésie
  ["ville", "kolonia", "Kolonia", "FM", 6.964, 158.208, "🏘️", "peu-commun", "Capitale des États fédérés de Micronésie jusqu'en 1989, elle reste la principale ville de l'île de Pohnpei.", "Kolonia"],
  ["nature", "lagon-chuuk", "Lagon de Chuuk", "FM", 7.417, 151.783, "⚓", "epique", "Des dizaines de navires japonais coulés lors d'un raid américain en février 1944 en font un haut lieu de la plongée sur épaves.", "Lagon de Chuuk"],
  ["nature", "kosrae", "Kosrae", "FM", 5.317, 162.983, "⛰️", "peu-commun", "Surnommée l'île de la femme endormie, sa silhouette montagneuse rappelle une femme allongée.", "Kosrae"],
  ["plat", "chique-betel", "Chique de bétel", "FM", null, null, "🌿", "peu-commun", "Mâcher la noix d'arec enveloppée de feuille de bétel est une habitude très répandue à Yap, qui teinte la bouche en rouge.", "Chique de bétel"],
  ["culture", "monnaie-rai", "Monnaie de pierre de Yap", "FM", null, null, "🪨", "epique", "Ces disques de calcaire, taillés à Palaos et transportés en pirogue jusqu'à Yap, peuvent dépasser 3 m de diamètre.", "Rai (monnaie)"],
  // Nauru
  ["ville", "aiwo", "Aiwo", "NR", -0.534, 166.913, "🏭", "peu-commun", "Ce district de la côte ouest de Nauru abrite le port et les installations d'exploitation du phosphate.", "Aiwo"],
  ["monument", "command-ridge", "Command Ridge", "NR", -0.537, 166.928, "🔭", "rare", "Point culminant de Nauru, à environ 70 m, il conserve des canons et un poste de commandement japonais de la Seconde Guerre mondiale.", "Command Ridge"],
  ["nature", "lagune-buada", "Lagune Buada", "NR", -0.534, 166.920, "💧", "rare", "Ce petit lac intérieur, entouré de palmiers, est l'une des rares étendues d'eau douce de l'île.", "Lagune Buada"],
  ["animal", "noddi-noir", "Noddi noir", "NR", null, null, "🐦", "peu-commun", "Les Nauruans capturaient traditionnellement cet oiseau marin au filet, une pratique encore vivante dans leur culture.", "Noddi noir"],
  ["culture", "angam-day", "Angam Day", "NR", null, null, "🎉", "rare", "Cette fête nationale du 26 octobre célèbre le retour de la population nauruane au seuil de 1 500 habitants, jugé vital pour sa survie.", "Angam Day"],
  // Palaos
  ["ville", "koror", "Koror", "PW", 7.342, 134.479, "🏙️", "peu-commun", "Capitale des Palaos jusqu'en 2006, elle reste la plus grande ville du pays.", "Koror"],
  ["monument", "pont-koror-babeldaob", "Pont Koror-Babeldaob", "PW", 7.363, 134.509, "🌉", "rare", "Le pont d'origine s'est effondré en 1996 ; il a été remplacé en 2002 par un pont financé par le Japon.", "Pont Koror-Babeldaob"],
  ["nature", "chelbacheb", "Îles Chelbacheb", "PW", 7.217, 134.400, "🏝️", "epique", "Ces centaines d'îlots calcaires couverts de forêt, en forme de champignons, sont inscrits au patrimoine mondial de l'UNESCO depuis 2012.", "Lagon sud des îles Chelbacheb"],
  ["nature", "peleliu", "Peleliu", "PW", 7.000, 134.250, "🪖", "peu-commun", "En 1944, cette petite île fut le théâtre d'une bataille acharnée entre Américains et Japonais.", "Peleliu"],
  ["animal", "requin-gris-recif", "Requin gris de récif", "PW", null, null, "🦈", "rare", "En 2009, les Palaos ont créé le premier sanctuaire de requins au monde, interdisant leur pêche commerciale.", "Requin gris de récif"],
  // Samoa
  ["monument", "vailima", "Vailima", "WS", -13.857, -171.768, "🏡", "rare", "L'écrivain Robert Louis Stevenson a vécu dans cette demeure de 1890 à sa mort en 1894 ; il repose au sommet du mont Vaea voisin.", "Vailima"],
  ["nature", "savaii", "Savai'i", "WS", -13.633, -172.433, "🌋", "rare", "Plus grande île des Samoa, elle a connu de 1905 à 1911 l'éruption du mont Matavanu, dont les laves ont recouvert plusieurs villages.", "Savai'i"],
  ["nature", "upolu", "Upolu", "WS", -13.917, -171.750, "🏝️", "peu-commun", "Île la plus peuplée des Samoa, elle abrite la capitale Apia et environ les trois quarts de la population.", "Upolu"],
  ["plat", "palusami", "Palusami", "WS", null, null, "🥬", "peu-commun", "Ces feuilles de taro garnies de crème de coco sont cuites dans l'umu, le four traditionnel de pierres chaudes.", "Palusami"],
  ["culture", "pea", "Pe'a", "WS", null, null, "🖋️", "epique", "Ce tatouage traditionnel samoan couvre les hommes de la taille aux genoux et se réalise à la main avec des peignes en os.", "Pe'a"],
  // Îles Salomon
  ["ville", "gizo", "Gizo", "SB", -8.103, 156.842, "🏘️", "peu-commun", "Capitale de la province occidentale, elle a été frappée par un tsunami en avril 2007.", "Gizo"],
  ["nature", "rennell-est", "Rennell-Est", "SB", -11.667, 160.400, "🌿", "epique", "Inscrit à l'UNESCO en 1998, ce site abrite le lac Tegano, le plus grand lac des îles du Pacifique.", "Rennell-Est"],
  ["nature", "marovo", "Lagon de Marovo", "SB", -8.500, 158.000, "🐠", "rare", "Entouré d'une double barrière de récifs, ce lagon de la Nouvelle-Géorgie compte parmi les plus grands lagons d'eau salée du monde.", "Lagon de Marovo"],
  ["nature", "guadalcanal", "Guadalcanal", "SB", -9.617, 160.183, "🪖", "peu-commun", "Plus grande île de l'archipel, elle fut de 1942 à 1943 le théâtre d'une longue bataille entre Américains et Japonais.", "Guadalcanal"],
  ["animal", "scinque-queue-prehensile", "Scinque à queue préhensile", "SB", null, null, "🦎", "rare", "Plus grand scinque du monde, ce lézard arboricole et végétarien s'aide de sa queue préhensile pour grimper.", "Corucia zebrata"],
  ["culture", "monnaie-coquillages", "Monnaie de coquillages", "SB", null, null, "🐚", "rare", "Faite de disques de coquillages enfilés, notamment dans le lagon de Langa Langa à Malaita, elle sert encore à payer les dots.", "Monnaie de coquillages"],
  // Tonga
  ["ville", "neiafu", "Neiafu", "TO", -18.650, -173.983, "⛵", "peu-commun", "Principale ville de l'archipel de Vava'u, elle borde un port naturel prisé des voiliers et des observateurs de baleines.", "Neiafu"],
  ["monument", "haamonga-a-maui", "Haʻamonga ʻa Maui", "TO", -21.131, -175.049, "🗿", "epique", "Ce trilithe de corail d'environ 5 m de haut aurait été érigé vers l'an 1200 sur l'île de Tongatapu.", "Haʻamonga ʻa Maui"],
  ["nature", "hunga-tonga", "Hunga Tonga-Hunga Ha'apai", "TO", -20.536, -175.382, "🌋", "epique", "Son éruption de janvier 2022 a été la plus puissante explosion volcanique enregistrée depuis celle du Krakatoa en 1883.", "Hunga Tonga-Hunga Ha'apai"],
  ["culture", "lakalaka", "Lakalaka", "TO", null, null, "💃", "rare", "Cette danse chantée, qui peut réunir des centaines d'interprètes alignés, est inscrite au patrimoine immatériel de l'UNESCO.", "Lakalaka"],
  // Tuvalu
  ["monument", "aeroport-funafuti", "Aéroport international de Funafuti", "TV", -8.525, 179.196, "🛬", "peu-commun", "En dehors des vols, sa piste, qui occupe une grande partie de l'île de Fongafale, sert de terrain de jeu et de lieu de promenade.", "Aéroport international de Funafuti"],
  ["nature", "nukulaelae", "Nukulaelae", "TV", -9.383, 179.833, "🏝️", "rare", "En 1863, des négriers péruviens ont enlevé la majeure partie des habitants de cet atoll.", "Nukulaelae"],
  ["nature", "vaitupu", "Vaitupu", "TV", -7.483, 178.683, "🏝️", "peu-commun", "Plus grande île de Tuvalu, elle abrite le lycée de Motufoua, principal établissement secondaire du pays.", "Vaitupu"],
  ["animal", "gygis-blanche", "Gygis blanche", "TV", null, null, "🕊️", "peu-commun", "Cet oiseau marin pond son œuf unique directement sur une branche nue, sans construire de nid.", "Gygis blanche"],
  ["plat", "pulaka", "Pulaka", "TV", null, null, "🌱", "peu-commun", "Ce taro géant, cultivé dans des fosses creusées jusqu'à la nappe d'eau douce, est menacé par les infiltrations d'eau salée.", "Cyrtosperma merkusii"],
  ["culture", "fatele", "Fatele", "TV", null, null, "💃", "rare", "Cette danse chantée, rythmée par des percussions sur une caisse en bois, s'accélère progressivement jusqu'à un final endiablé.", "Fatele"],
  // Vanuatu
  ["ville", "luganville", "Luganville", "VU", -15.533, 167.167, "⚓", "peu-commun", "Deuxième ville du pays, elle fut pendant la Seconde Guerre mondiale une immense base arrière américaine.", "Luganville"],
  ["nature", "espiritu-santo", "Espiritu Santo", "VU", -15.400, 166.900, "🏝️", "rare", "Plus grande île du Vanuatu, elle culmine au mont Tabwemasana à 1 879 m.", "Espiritu Santo"],
  ["plat", "lap-lap", "Lap lap", "VU", null, null, "🍠", "peu-commun", "Ce plat national est une pâte de tubercules râpés, enveloppée de feuilles de bananier et cuite au four de pierres chaudes.", "Lap lap"],
  ["culture", "saut-du-gaul", "Saut du gaul", "VU", null, null, "🪢", "epique", "Sur l'île de Pentecôte, des hommes sautent de tours en bois, retenus aux chevilles par des lianes, un rite considéré comme l'ancêtre du saut à l'élastique.", "Saut du gaul"],
];
if (typeof module === "object" && module.exports) module.exports = { CARTES_PAYS_AMOC };
