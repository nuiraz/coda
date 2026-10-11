"use strict";
// Cartes supplémentaires par pays (Afrique)
// [type, id, nom, code pays, lat, lon, emoji, rareté, anecdote, titre Wikipédia fr]
const CARTES_PAYS_AF = [
  // Angola
  ["ville", "mbanza-kongo", "Mbanza-Kongo", "AO", -6.267, 14.250, "🏘️", "peu-commun", "Ancienne capitale du royaume du Kongo, elle est inscrite au patrimoine mondial de l'UNESCO depuis 2017.", "Mbanza-Kongo"],
  ["ville", "lubango", "Lubango", "AO", -14.917, 13.492, "🏘️", "peu-commun", "La ville est dominée par une statue du Christ-Roi inspirée de celle de Lisbonne.", "Lubango"],
  ["monument", "forteresse-sao-miguel", "Forteresse de São Miguel", "AO", -8.808, 13.222, "🏰", "peu-commun", "Construite à partir de 1576 par Paulo Dias de Novais, fondateur de Luanda, elle abrite aujourd'hui un musée d'histoire militaire.", "Forteresse de São Miguel"],
  ["nature", "chutes-kalandula", "Chutes de Kalandula", "AO", -9.074, 16.000, "💧", "rare", "Hautes d'environ 105 mètres, ces chutes de la rivière Lucala comptent parmi les plus grandes d'Afrique.", "Chutes de Kalandula"],
  ["culture", "kizomba", "Kizomba", "AO", null, null, "💃", "peu-commun", "Née en Angola dans les années 1980, la kizomba est une danse de couple aujourd'hui pratiquée dans le monde entier.", "Kizomba"],
  // Bénin
  ["monument", "porte-non-retour", "Porte du Non-Retour", "BJ", 6.324, 2.089, "🚪", "rare", "Érigé à Ouidah en 1995, ce monument rend hommage aux Africains déportés vers les Amériques lors de la traite négrière.", "Porte du Non-Retour"],
  ["ville", "ganvie", "Ganvié", "BJ", 6.467, 2.417, "🛶", "peu-commun", "Bâtie sur pilotis au milieu du lac Nokoué, cette cité lacustre est surnommée la « Venise de l'Afrique ».", "Ganvié"],
  // Botswana
  ["monument", "tsodilo", "Tsodilo", "BW", -18.750, 21.733, "🎨", "epique", "Surnommées le « Louvre du désert », ces collines du Kalahari abritent plus de 4 500 peintures rupestres.", "Tsodilo"],
  ["ville", "maun", "Maun", "BW", -19.983, 23.417, "🏘️", "peu-commun", "Cette ville est la principale porte d'entrée des safaris vers le delta de l'Okavango.", "Maun"],
  ["animal", "lycaon", "Lycaon", "BW", null, null, "🐕", "rare", "Chaque lycaon possède un pelage tacheté unique, et l'espèce chasse en meutes très coopératives.", "Lycaon"],
  // Burkina Faso
  ["ville", "bobo-dioulasso", "Bobo-Dioulasso", "BF", 11.178, -4.297, "🏘️", "peu-commun", "Deuxième ville du pays, elle accueille la Semaine nationale de la culture, grand festival biennal des arts burkinabè.", "Bobo-Dioulasso"],
  ["monument", "mosquee-bobo-dioulasso", "Grande Mosquée de Bobo-Dioulasso", "BF", 11.182, -4.291, "🕌", "rare", "Bâtie en banco à la fin du XIXe siècle, elle est hérissée de pieux de bois servant d'échafaudage permanent pour son entretien.", "Grande Mosquée de Bobo-Dioulasso"],
  ["nature", "pics-sindou", "Pics de Sindou", "BF", 10.667, -5.167, "⛰️", "rare", "Ces aiguilles de grès sculptées par l'érosion forment l'un des paysages les plus spectaculaires d'Afrique de l'Ouest.", "Pics de Sindou"],
  ["culture", "fespaco", "FESPACO", "BF", null, null, "🎬", "rare", "Créé en 1969, ce festival biennal de Ouagadougou est le plus grand festival de cinéma africain et décerne l'Étalon d'or de Yennenga.", "Festival panafricain du cinéma et de la télévision de Ouagadougou"],
  ["animal", "cobe-buffon", "Cobe de Buffon", "BF", null, null, "🦌", "commun", "Cette antilope des savanes vit en troupeaux près des cours d'eau, notamment dans les parcs du Burkina Faso.", "Cobe de Buffon"],
  // Burundi
  ["ville", "gitega", "Gitega", "BI", -3.427, 29.925, "🏘️", "peu-commun", "Ancienne capitale royale, Gitega est redevenue la capitale politique du Burundi en 2019.", "Gitega"],
  ["nature", "rusizi", "Parc national de la Rusizi", "BI", -3.300, 29.267, "🐊", "rare", "C'est dans cette région du delta de la Rusizi que vivait Gustave, un crocodile du Nil géant réputé mangeur d'hommes.", "Parc national de la Rusizi"],
  ["nature", "kibira", "Parc national de la Kibira", "BI", -2.917, 29.417, "🌳", "peu-commun", "Cette forêt de montagne, prolongement de la forêt de Nyungwe au Rwanda, abrite des chimpanzés.", "Parc national de la Kibira"],
  ["culture", "karyenda", "Karyenda", "BI", null, null, "🥁", "rare", "Ce tambour sacré était le symbole du pouvoir du mwami, le roi du Burundi.", "Karyenda"],
  // Cap-Vert
  ["nature", "pico-do-fogo", "Pico do Fogo", "CV", 14.950, -24.350, "🌋", "epique", "Point culminant du Cap-Vert à 2 829 mètres, ce volcan actif est entré en éruption pour la dernière fois en 2014.", "Pico do Fogo"],
  ["ville", "mindelo", "Mindelo", "CV", 16.886, -24.988, "🏘️", "peu-commun", "Ville natale de la chanteuse Cesária Évora, Mindelo est réputée pour son carnaval et sa vie musicale.", "Mindelo"],
  ["culture", "morna", "Morna", "CV", null, null, "🎶", "rare", "Genre musical mélancolique popularisé par Cesária Évora, la morna est inscrite au patrimoine culturel immatériel de l'UNESCO depuis 2019.", "Morna"],
  // Cameroun
  ["ville", "douala", "Douala", "CM", 4.050, 9.700, "🏘️", "peu-commun", "Capitale économique du Cameroun, Douala abrite le principal port du pays.", "Douala"],
  ["nature", "chutes-lobe", "Chutes de la Lobé", "CM", 2.877, 9.897, "💧", "rare", "Ces chutes ont la particularité rare de se jeter directement dans l'océan Atlantique.", "Chutes de la Lobé"],
  ["culture", "makossa", "Makossa", "CM", null, null, "🎷", "peu-commun", "Né à Douala, ce genre musical a conquis le monde grâce au titre « Soul Makossa » de Manu Dibango en 1972.", "Makossa"],
  // République centrafricaine
  ["ville", "bouar", "Bouar", "CF", 5.933, 15.600, "🏘️", "peu-commun", "Les environs de Bouar sont célèbres pour leurs nombreux mégalithes dressés, appelés tazunu.", "Bouar"],
  ["nature", "chutes-boali", "Chutes de Boali", "CF", 4.800, 18.117, "💧", "rare", "Hautes d'environ 50 mètres, ces chutes de la Mbali alimentent des centrales hydroélectriques qui fournissent l'électricité de Bangui.", "Chutes de Boali"],
  ["nature", "trinational-sangha", "Trinational de la Sangha", "CF", 2.500, 16.250, "🌳", "epique", "Partagé entre la Centrafrique, le Cameroun et le Congo, ce massif forestier est inscrit au patrimoine mondial depuis 2012.", "Trinational de la Sangha"],
  ["culture", "polyphonies-aka", "Polyphonies des Pygmées Aka", "CF", null, null, "🎶", "rare", "Les chants polyphoniques des Pygmées Aka de Centrafrique sont inscrits au patrimoine culturel immatériel de l'UNESCO.", "Aka (peuple)"],
  ["animal", "pangolin-geant", "Pangolin géant", "CF", null, null, "🦔", "rare", "Plus grand de tous les pangolins, il peut dépasser 1,4 mètre de long et se nourrit de fourmis et de termites.", "Pangolin géant"],
  // Tchad
  ["ville", "abeche", "Abéché", "TD", 13.829, 20.832, "🏘️", "peu-commun", "Ancienne capitale du sultanat du Ouaddaï, Abéché est l'une des principales villes de l'est du Tchad.", "Abéché"],
  ["culture", "gerewol", "Gerewol", "TD", null, null, "💃", "rare", "Lors de ce rassemblement des Peuls Wodaabe, les jeunes hommes maquillés dansent pour séduire les femmes, qui choisissent le plus beau.", "Gerewol"],
  // Comores
  ["ville", "mutsamudu", "Mutsamudu", "KM", -12.167, 44.400, "🏘️", "peu-commun", "Chef-lieu de l'île d'Anjouan, la ville est dominée par une citadelle construite à la fin du XVIIIe siècle.", "Mutsamudu"],
  ["nature", "moheli", "Mohéli", "KM", -12.333, 43.733, "🐢", "rare", "La plus petite des trois îles de l'Union des Comores abrite un parc marin où les tortues vertes viennent pondre.", "Mohéli"],
  ["animal", "roussette-livingstone", "Roussette de Livingstone", "KM", null, null, "🦇", "epique", "Cette grande chauve-souris frugivore n'existe que sur les îles d'Anjouan et de Mohéli.", "Roussette de Livingstone"],
  ["plat", "ylang-ylang", "Ylang-ylang", "KM", null, null, "🌼", "peu-commun", "Les Comores sont l'un des premiers producteurs mondiaux d'essence d'ylang-ylang, utilisée en parfumerie.", "Ylang-ylang"],
  // Congo
  ["ville", "pointe-noire", "Pointe-Noire", "CG", -4.778, 11.863, "🏘️", "peu-commun", "Capitale économique du Congo, Pointe-Noire est son unique port maritime et le centre de son industrie pétrolière.", "Pointe-Noire (république du Congo)"],
  ["nature", "odzala", "Parc national d'Odzala-Kokoua", "CG", 0.800, 14.900, "🌳", "epique", "Créé en 1935, c'est l'un des plus anciens parcs d'Afrique, et il abrite d'importantes populations de gorilles des plaines de l'Ouest.", "Parc national d'Odzala-Kokoua"],
  ["monument", "basilique-sainte-anne", "Basilique Sainte-Anne du Congo", "CG", -4.272, 15.271, "⛪", "rare", "Construite dans les années 1940 à Brazzaville, elle est reconnaissable à son toit couvert de tuiles vertes vernissées.", "Basilique Sainte-Anne-du-Congo"],
  ["culture", "sape", "La Sape", "CG", null, null, "👔", "rare", "Les « sapeurs » de Brazzaville et Kinshasa font de l'élégance vestimentaire un véritable art de vivre.", "La Sape"],
  // Djibouti
  ["nature", "lac-assal", "Lac Assal", "DJ", 11.650, 42.417, "🧂", "epique", "Situé à environ 155 mètres sous le niveau de la mer, ce lac salé est le point le plus bas d'Afrique.", "Lac Assal (Djibouti)"],
  ["nature", "foret-day", "Forêt du Day", "DJ", 11.767, 42.650, "🌲", "rare", "Cette rare forêt de genévriers est le principal refuge du francolin de Djibouti.", "Forêt du Day"],
  ["ville", "tadjourah", "Tadjourah", "DJ", 11.783, 42.883, "🏘️", "peu-commun", "Surnommée la « ville blanche », c'est l'une des plus anciennes cités de la Corne de l'Afrique.", "Tadjourah"],
  ["plat", "skoudehkaris", "Skoudehkaris", "DJ", null, null, "🍛", "commun", "Ce riz épicé à la viande est considéré comme le plat national de Djibouti.", "Skoudehkaris"],
  // Guinée équatoriale
  ["ville", "bata", "Bata", "GQ", 1.863, 9.765, "🏘️", "peu-commun", "Plus grande ville du pays, Bata est le principal port de la partie continentale, le Río Muni.", "Bata (Guinée équatoriale)"],
  ["ville", "ciudad-de-la-paz", "Ciudad de la Paz", "GQ", 1.583, 10.817, "🏗️", "peu-commun", "Cette ville nouvelle construite en pleine forêt est destinée à devenir la future capitale de la Guinée équatoriale.", "Ciudad de la Paz"],
  ["nature", "pico-basile", "Pico Basilé", "GQ", 3.583, 8.767, "🌋", "rare", "Point culminant du pays à 3 011 mètres, ce volcan domine l'île de Bioko et la capitale Malabo.", "Pico Basilé"],
  ["nature", "annobon", "Annobón", "GQ", -1.433, 5.633, "🏝️", "rare", "Seule partie du pays située dans l'hémisphère sud, cette île volcanique a son propre créole, le fa d'ambô.", "Annobón"],
  ["animal", "drill", "Drill", "GQ", null, null, "🐒", "epique", "Proche cousin du mandrill, ce primate menacé vit notamment sur l'île de Bioko.", "Drill (primate)"],
  ["monument", "cathedrale-malabo", "Cathédrale Sainte-Isabelle de Malabo", "GQ", 3.755, 8.784, "⛪", "rare", "Achevée au début du XXe siècle dans un style néogothique, elle est l'un des principaux monuments de la capitale.", "Cathédrale Sainte-Isabelle de Malabo"],
  // Érythrée
  ["ville", "massaoua", "Massaoua", "ER", 15.610, 39.450, "🏘️", "peu-commun", "Ce port de la mer Rouge mêle architectures ottomane, égyptienne et italienne.", "Massaoua"],
  ["ville", "keren", "Keren", "ER", 15.778, 38.451, "🏘️", "peu-commun", "Cette ville fut le théâtre d'une bataille décisive entre Britanniques et Italiens en 1941.", "Keren"],
  ["monument", "qohaito", "Qohaito", "ER", 14.950, 39.433, "🏛️", "rare", "Ce site perché sur un plateau conserve les ruines d'une cité de l'époque du royaume d'Aksoum.", "Qohaito"],
  // Eswatini
  ["ville", "lobamba", "Lobamba", "SZ", -26.467, 31.200, "🏘️", "peu-commun", "Capitale royale et législative du pays, elle accueille chaque année la cérémonie de l'Umhlanga.", "Lobamba"],
  ["ville", "manzini", "Manzini", "SZ", -26.483, 31.367, "🏘️", "peu-commun", "Principal centre commercial et industriel d'Eswatini, Manzini est l'une des plus grandes villes du royaume.", "Manzini"],
  ["culture", "umhlanga", "Umhlanga", "SZ", null, null, "🌾", "rare", "Lors de cette « danse des roseaux », des milliers de jeunes filles apportent des roseaux à la reine mère.", "Umhlanga"],
  ["nature", "sibebe", "Sibebe", "SZ", -26.250, 31.167, "🪨", "rare", "Ce gigantesque dôme de granite est souvent présenté comme l'un des plus grands monolithes du monde.", "Sibebe"],
  ["monument", "mine-ngwenya", "Mine de Ngwenya", "SZ", -26.200, 31.033, "⛏️", "epique", "Exploitée pour l'hématite il y a plus de 40 000 ans, elle est considérée comme l'une des plus anciennes mines du monde.", "Mine de Ngwenya"],
  // Gabon
  ["ville", "lambarene", "Lambaréné", "GA", -0.700, 10.217, "🏘️", "peu-commun", "Le docteur Albert Schweitzer, prix Nobel de la paix 1952, y fonda un hôpital en 1913.", "Lambaréné"],
  ["culture", "bwiti", "Bwiti", "GA", null, null, "🪘", "rare", "Ce rite initiatique pratiqué notamment par les Fang et les Mitsogho fait usage de l'écorce de racine d'iboga.", "Bwiti"],
  // Gambie
  ["nature", "fleuve-gambie", "Fleuve Gambie", "GM", 13.467, -16.583, "🏞️", "rare", "Le territoire de la Gambie se limite à une étroite bande de terre de part et d'autre de ce fleuve.", "Gambie (fleuve)"],
  ["monument", "cercles-wassu", "Cercles mégalithiques de Wassu", "GM", 13.693, -14.879, "🗿", "rare", "Ces pierres levées font partie des cercles mégalithiques de Sénégambie, inscrits au patrimoine mondial en 2006.", "Cercles mégalithiques de Sénégambie"],
  ["culture", "kankurang", "Kankurang", "GM", null, null, "🎭", "rare", "Ce personnage masqué vêtu d'écorces et de feuilles accompagne les rites d'initiation des Mandingues.", "Kankurang"],
  ["ville", "serekunda", "Serekunda", "GM", 13.438, -16.678, "🏘️", "peu-commun", "Plus grande agglomération du pays, elle est bien plus peuplée que la capitale Banjul.", "Serekunda"],
  // Guinée
  ["nature", "fouta-djalon", "Fouta-Djalon", "GN", 11.500, -12.500, "⛰️", "rare", "Surnommé le « château d'eau de l'Afrique de l'Ouest », ce massif voit naître le Sénégal et la Gambie.", "Fouta-Djalon"],
  ["ville", "kankan", "Kankan", "GN", 10.385, -9.306, "🏘️", "peu-commun", "Grande ville de Haute-Guinée sur le Milo, elle est un centre historique de la culture malinké.", "Kankan"],
  ["plat", "fonio", "Fonio", "GN", null, null, "🌾", "peu-commun", "La Guinée est le premier producteur mondial de cette petite céréale cultivée en Afrique de l'Ouest depuis des millénaires.", "Fonio"],
  ["culture", "balafon", "Balafon", "GN", null, null, "🎶", "rare", "À Niagassola, le Sosso-Bala, balafon vieux de plusieurs siècles, est inscrit au patrimoine immatériel de l'UNESCO.", "Balafon"],
  // Guinée-Bissau
  ["ville", "bolama", "Bolama", "GW", 11.578, -15.475, "🏚️", "peu-commun", "Capitale de la Guinée portugaise jusqu'en 1941, la ville conserve de nombreux bâtiments coloniaux à l'abandon.", "Bolama"],
  ["ville", "cacheu", "Cacheu", "GW", 12.267, -16.167, "🏘️", "peu-commun", "Fondée par les Portugais au XVIe siècle, elle fut l'un des premiers comptoirs de la traite négrière en Afrique de l'Ouest.", "Cacheu"],
  ["plat", "noix-de-cajou", "Noix de cajou", "GW", null, null, "🥜", "commun", "La noix de cajou est de loin la principale exportation de la Guinée-Bissau.", "Noix de cajou"],
  ["animal", "dauphin-bosse-atlantique", "Dauphin à bosse de l'Atlantique", "GW", null, null, "🐬", "epique", "Ce dauphin menacé ne vit que le long des côtes d'Afrique de l'Ouest, notamment dans l'archipel des Bijagos.", "Dauphin à bosse de l'Atlantique"],
  // Lesotho
  ["culture", "mokorotlo", "Mokorotlo", "LS", null, null, "👒", "peu-commun", "Ce chapeau conique en paille, symbole national du Lesotho, figure sur le drapeau du pays.", "Mokorotlo"],
  ["monument", "barrage-katse", "Barrage de Katse", "LS", -29.337, 28.507, "🏗️", "rare", "Haut de 185 mètres, ce barrage fournit de l'eau à la région de Johannesburg en Afrique du Sud.", "Barrage de Katse"],
  ["nature", "thaba-bosiu", "Thaba Bosiu", "LS", -29.367, 27.683, "⛰️", "rare", "Ce plateau imprenable servit de forteresse au roi Moshoeshoe Ier, fondateur de la nation basotho.", "Thaba Bosiu"],
  ["ville", "teyateyaneng", "Teyateyaneng", "LS", -29.150, 27.750, "🏘️", "peu-commun", "Cette ville est réputée pour ses ateliers de tissage de tapisseries.", "Teyateyaneng"],
  // Liberia
  ["nature", "sapo", "Parc national de Sapo", "LR", 5.400, -8.667, "🌳", "rare", "Plus grande aire protégée du Liberia, il abrite des hippopotames pygmées et des chimpanzés.", "Parc national de Sapo"],
  ["nature", "lac-piso", "Lac Piso", "LR", 6.750, -11.250, "🏞️", "rare", "Ce lac côtier est le plus grand du Liberia.", "Lac Piso"],
  ["ville", "harper", "Harper", "LR", 4.375, -7.717, "🏘️", "peu-commun", "Fondée par d'anciens esclaves américains, elle fut la capitale de l'éphémère république du Maryland avant son rattachement au Liberia.", "Harper (Liberia)"],
  ["ville", "robertsport", "Robertsport", "LR", 6.753, -11.367, "🏄", "peu-commun", "Cette petite ville côtière est réputée pour ses vagues, parmi les meilleures d'Afrique de l'Ouest pour le surf.", "Robertsport"],
  ["animal", "cephalophe-zebre", "Céphalophe zébré", "LR", null, null, "🦌", "rare", "Cette petite antilope des forêts d'Afrique de l'Ouest porte sur le dos de larges rayures noires.", "Céphalophe zébré"],
  // Libye
  ["ville", "ghadames", "Ghadamès", "LY", 30.133, 9.500, "🏘️", "peu-commun", "Surnommée la « perle du désert », sa vieille ville est inscrite au patrimoine mondial de l'UNESCO.", "Ghadamès"],
  ["nature", "tadrart-akakus", "Tadrart Akakus", "LY", 24.833, 10.333, "🏜️", "epique", "Ce massif du Sahara abrite des milliers de peintures et gravures rupestres inscrites au patrimoine mondial.", "Tadrart Akakus"],
  // Malawi
  ["culture", "gule-wamkulu", "Gule Wamkulu", "MW", null, null, "🎭", "rare", "Cette danse masquée des Chewa est inscrite au patrimoine culturel immatériel de l'UNESCO.", "Gule Wamkulu"],
  ["ville", "blantyre", "Blantyre", "MW", -15.786, 35.006, "🏘️", "peu-commun", "Capitale économique du Malawi, elle porte le nom de la ville natale écossaise de David Livingstone.", "Blantyre (Malawi)"],
  ["ville", "zomba", "Zomba", "MW", -15.383, 35.333, "🏘️", "peu-commun", "Au pied du plateau de Zomba, cette ville fut la capitale du Malawi jusqu'en 1975.", "Zomba (Malawi)"],
  // Mauritanie
  ["ville", "nouakchott", "Nouakchott", "MR", 18.086, -15.976, "🏘️", "peu-commun", "Simple village à la fin des années 1950, elle a été bâtie comme capitale à l'indépendance et est devenue la plus grande ville du pays.", "Nouakchott"],
  ["ville", "oualata", "Oualata", "MR", 17.300, -7.033, "🏘️", "peu-commun", "Ses maisons aux façades ornées de motifs peints font partie des ksour inscrits au patrimoine mondial.", "Oualata"],
  // Maurice
  ["culture", "sega", "Séga", "MU", null, null, "💃", "rare", "Le séga tipik mauricien est inscrit au patrimoine culturel immatériel de l'UNESCO depuis 2014.", "Séga"],
  ["nature", "trou-aux-cerfs", "Trou aux Cerfs", "MU", -20.316, 57.505, "🌋", "rare", "Ce cratère volcanique endormi se trouve au cœur de la ville de Curepipe.", "Trou aux Cerfs"],
  // Mozambique
  ["monument", "ile-mozambique", "Île de Mozambique", "MZ", -15.035, 40.733, "🏰", "epique", "Ancienne capitale de la colonie, cette île qui a donné son nom au pays est inscrite au patrimoine mondial.", "Île de Mozambique"],
  ["nature", "gorongosa", "Parc national de Gorongosa", "MZ", -18.967, 34.350, "🌳", "rare", "Ravagé par la guerre civile, ce parc a vu ses populations animales se reconstituer grâce à un vaste programme de restauration.", "Parc national de Gorongosa"],
  ["culture", "timbila", "Timbila", "MZ", null, null, "🎶", "rare", "Les orchestres de xylophones timbila du peuple chopi sont inscrits au patrimoine immatériel de l'UNESCO.", "Timbila"],
  ["ville", "beira", "Beira", "MZ", -19.844, 34.839, "🏘️", "peu-commun", "Grand port de l'océan Indien, Beira a été dévastée par le cyclone Idai en 2019.", "Beira (Mozambique)"],
  // Niger
  ["culture", "cure-salee", "Cure salée", "NE", null, null, "🐪", "rare", "Chaque année près d'In-Gall, éleveurs touaregs et peuls célèbrent la fin de la saison des pluies en menant leurs troupeaux aux terres salées.", "Cure salée"],
  ["nature", "arbre-tenere", "Arbre du Ténéré", "NE", 17.750, 10.067, "🌳", "epique", "Longtemps considéré comme l'arbre le plus isolé du monde, cet acacia fut renversé par un camion en 1973.", "Arbre du Ténéré"],
  // Nigeria
  ["culture", "nollywood", "Nollywood", "NG", null, null, "🎬", "rare", "L'industrie du cinéma nigériane produit chaque année plus de films que Hollywood.", "Nollywood"],
  ["monument", "osun-osogbo", "Forêt sacrée d'Osun-Osogbo", "NG", 7.756, 4.552, "🌳", "rare", "Ce bois sacré dédié à la déesse yoruba Osun est inscrit au patrimoine mondial depuis 2005.", "Forêt sacrée d'Osun-Osogbo"],
  // Rwanda
  ["monument", "memorial-genocide-kigali", "Mémorial du génocide de Kigali", "RW", -1.931, 30.061, "🕯️", "rare", "Plus de 250 000 victimes du génocide des Tutsi de 1994 y sont inhumées.", "Mémorial du génocide de Kigali"],
  ["culture", "umuganda", "Umuganda", "RW", null, null, "🧹", "peu-commun", "Le dernier samedi de chaque mois, les Rwandais participent à une matinée obligatoire de travaux d'intérêt collectif.", "Umuganda"],
  ["nature", "akagera", "Parc national de l'Akagera", "RW", -1.883, 30.717, "🦏", "rare", "Grâce à la réintroduction de lions puis de rhinocéros, le parc abrite de nouveau les « Big Five ».", "Parc national de l'Akagera"],
  // Sao Tomé-et-Principe
  ["culture", "tchiloli", "Tchiloli", "ST", null, null, "🎭", "rare", "Ce théâtre populaire en plein air adapte une pièce portugaise du XVIe siècle mettant en scène Charlemagne.", "Tchiloli"],
  ["plat", "calulu", "Calulu", "ST", null, null, "🍲", "commun", "Ce ragoût de poisson ou de viande aux légumes et à l'huile de palme est considéré comme le plat national.", "Calulu"],
  ["nature", "ilheu-das-rolas", "Ilhéu das Rolas", "ST", 0.000, 6.533, "🌐", "epique", "Cet îlot est traversé par l'équateur, matérialisé par une borne et une carte du monde en mosaïque.", "Ilhéu das Rolas"],
  ["nature", "principe", "Île de Príncipe", "ST", 1.633, 7.417, "🏝️", "rare", "L'île entière est classée réserve de biosphère par l'UNESCO depuis 2012.", "Île de Principe"],
  ["monument", "fort-sao-sebastiao", "Fort São Sebastião", "ST", 0.349, 6.736, "🏰", "rare", "Construit au XVIe siècle par les Portugais, ce fort de la capitale abrite aujourd'hui le musée national.", "Fort São Sebastião (São Tomé)"],
  // Seychelles
  ["culture", "moutya", "Moutya", "SC", null, null, "🪘", "rare", "Cette danse héritée des esclaves, rythmée par des tambours en peau de chèvre, est inscrite à l'UNESCO depuis 2021.", "Moutya"],
  ["nature", "anse-source-argent", "Anse Source d'Argent", "SC", -4.371, 55.828, "🏖️", "epique", "Avec ses rochers de granite rose sculptés, cette plage de La Digue compte parmi les plus photographiées du monde.", "Anse Source d'Argent"],
  // Sierra Leone
  ["ville", "bo", "Bo", "SL", 7.965, -11.739, "🏘️", "peu-commun", "Deuxième ville de Sierra Leone, Bo est la capitale de la province du Sud.", "Bo (Sierra Leone)"],
  ["ville", "kenema", "Kenema", "SL", 7.877, -11.190, "🏘️", "peu-commun", "Capitale de la province de l'Est, Kenema est un important centre du commerce du diamant.", "Kenema"],
  ["monument", "ile-bunce", "Île de Bunce", "SL", 8.570, -13.040, "🏰", "rare", "Ce fort britannique fut l'un des principaux points de départ des esclaves vers l'Amérique, notamment vers la Caroline du Sud.", "Île de Bunce"],
  ["nature", "bintumani", "Mont Bintumani", "SL", 9.167, -11.117, "⛰️", "rare", "Culminant à environ 1 945 mètres, c'est le plus haut sommet de Sierra Leone.", "Mont Bintumani"],
  ["animal", "picatharte-guinee", "Picatharte de Guinée", "SL", null, null, "🐦", "epique", "Cet oiseau à tête chauve et jaune construit des nids de boue collés aux parois rocheuses des forêts.", "Picatharte de Guinée"],
  ["plat", "vin-de-palme", "Vin de palme", "SL", null, null, "🥥", "commun", "Appelée « poyo » en Sierra Leone, cette boisson fermentée est tirée de la sève des palmiers.", "Vin de palme"],
  // Somalie
  ["monument", "laas-geel", "Laas Geel", "SO", 9.783, 44.450, "🎨", "epique", "Ces abris rocheux abritent des peintures rupestres de bovins vieilles de plusieurs milliers d'années, parmi les mieux conservées d'Afrique.", "Laas Geel"],
  ["ville", "berbera", "Berbera", "SO", 10.439, 45.014, "🏘️", "peu-commun", "Ce port du golfe d'Aden est l'un des principaux ports de la Corne de l'Afrique.", "Berbera"],
  ["nature", "cap-guardafui", "Cap Guardafui", "SO", 11.817, 51.267, "🌊", "rare", "Ce cap marque la pointe de la Corne de l'Afrique, à l'entrée du golfe d'Aden.", "Cap Guardafui"],
  ["animal", "dibatag", "Dibatag", "SO", null, null, "🦌", "rare", "Cette gazelle de la Corne de l'Afrique tient sa queue dressée à la verticale lorsqu'elle s'enfuit.", "Dibatag"],
  ["plat", "lait-chamelle", "Lait de chamelle", "SO", null, null, "🥛", "commun", "La Somalie possède l'un des plus grands cheptels de dromadaires au monde et est un grand producteur de lait de chamelle.", "Lait de chamelle"],
  // Soudan du Sud
  ["nature", "sudd", "Sudd", "SS", 7.500, 30.500, "🌾", "epique", "Ce gigantesque marais du Nil Blanc est l'une des plus grandes zones humides du monde.", "Sudd"],
  ["animal", "cobe-oreilles-blanches", "Cobe à oreilles blanches", "SS", null, null, "🦌", "rare", "Plus d'un million de ces antilopes participent à l'une des plus grandes migrations terrestres d'Afrique.", "Cobe à oreilles blanches"],
  ["ville", "wau", "Wau", "SS", 7.703, 27.990, "🏘️", "peu-commun", "Sur la rivière Jur, Wau est l'une des plus grandes villes du Soudan du Sud.", "Wau (Soudan du Sud)"],
  ["ville", "malakal", "Malakal", "SS", 9.533, 31.650, "🏘️", "peu-commun", "Située sur le Nil Blanc, près de son confluent avec le Sobat, c'est la principale ville du nord-est du pays.", "Malakal"],
  ["culture", "pasteurs-dinka", "Pasteurs dinka", "SS", null, null, "🐄", "rare", "Chez les Dinka, peuple d'éleveurs, le bétail aux grandes cornes est au cœur de la vie sociale et des dots.", "Dinka"],
  // Soudan
  ["nature", "djebel-marra", "Djebel Marra", "SD", 12.950, 24.267, "🌋", "rare", "Ce massif volcanique du Darfour culmine à plus de 3 000 mètres et abrite une caldeira occupée par deux lacs.", "Djebel Marra"],
  ["monument", "djebel-barkal", "Djebel Barkal", "SD", 18.537, 31.828, "🏛️", "epique", "Cette montagne sacrée de Nubie est entourée de temples et de pyramides inscrits au patrimoine mondial.", "Djebel Barkal"],
  ["ville", "omdurman", "Omdurman", "SD", 15.644, 32.478, "🏘️", "peu-commun", "Ancienne capitale du Mahdi, la ville abrite son tombeau, face à Khartoum sur l'autre rive du Nil.", "Omdurman"],
  ["plat", "gomme-arabique", "Gomme arabique", "SD", null, null, "🌳", "peu-commun", "Le Soudan est le premier producteur mondial de cette résine d'acacia utilisée dans les sodas et les confiseries.", "Gomme arabique"],
  // Togo
  ["monument", "koutammakou", "Koutammakou", "TG", 10.000, 1.083, "🏯", "epique", "Le pays des Batammariba est célèbre pour ses takienta, maisons-tours en terre inscrites au patrimoine mondial.", "Koutammakou"],
  ["ville", "kara", "Kara", "TG", 9.551, 1.186, "🏘️", "peu-commun", "Grande ville du nord du Togo, elle accueille chaque été les luttes traditionnelles de l'Evala.", "Kara (Togo)"],
  ["nature", "mont-agou", "Mont Agou", "TG", 6.867, 0.733, "⛰️", "rare", "Culminant à 986 mètres, c'est le point le plus haut du Togo.", "Mont Agou"],
  ["nature", "lac-togo", "Lac Togo", "TG", 6.250, 1.417, "🏞️", "rare", "Le pays doit son nom au village de Togoville, situé sur la rive de ce lac.", "Lac Togo"],
  ["culture", "evala", "Evala", "TG", null, null, "🤼", "rare", "Cette lutte initiatique marque le passage à l'âge adulte des jeunes hommes kabyè.", "Evala"],
  ["monument", "palais-lome", "Palais de Lomé", "TG", 6.123, 1.226, "🏛️", "rare", "Ancien palais des gouverneurs coloniaux, il a été restauré et transformé en centre d'art et de culture en 2019.", "Palais de Lomé"],
  // Zambie
  ["ville", "livingstone", "Livingstone", "ZM", -17.850, 25.867, "🏘️", "peu-commun", "Ancienne capitale de la Rhodésie du Nord, cette ville proche des chutes Victoria est la capitale touristique du pays.", "Livingstone (Zambie)"],
  ["monument", "pont-chutes-victoria", "Pont des chutes Victoria", "ZM", -17.928, 25.857, "🌉", "rare", "Achevé en 1905, ce pont relie la Zambie au Zimbabwe juste en aval des chutes.", "Pont des chutes Victoria"],
  ["nature", "south-luangwa", "Parc national de South Luangwa", "ZM", -13.083, 31.550, "🦒", "rare", "Ce parc est considéré comme le berceau du safari à pied en Afrique.", "Parc national de South Luangwa"],
  ["nature", "chutes-kalambo", "Chutes de Kalambo", "ZM", -8.597, 31.243, "💧", "epique", "Près de ces chutes hautes de plus de 200 mètres, on a découvert une structure en bois vieille d'environ 476 000 ans, la plus ancienne connue.", "Chutes de Kalambo"],
  ["culture", "kuomboka", "Kuomboka", "ZM", null, null, "🛶", "rare", "Lors de cette cérémonie, le roi des Lozi quitte la plaine inondée du Zambèze à bord d'une immense barge royale.", "Kuomboka"],
];
if (typeof module === "object" && module.exports) module.exports = { CARTES_PAYS_AF };
