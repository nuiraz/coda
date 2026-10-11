"use strict";
// Cartes supplémentaires par pays (Europe et Asie)
// [type, id, nom, code pays, lat, lon, emoji, rareté, anecdote, titre Wikipédia fr]
const CARTES_PAYS_EUAS = [
  // Albanie
  ["ville", "berat", "Berat", "AL", 40.705, 19.952, "🏘️", "peu-commun", "Surnommée la « ville aux mille fenêtres », Berat est inscrite au patrimoine mondial de l'UNESCO depuis 2008.", "Berat"],
  ["nature", "syri-i-kalter", "Syri i Kaltër", "AL", 39.924, 20.192, "💧", "rare", "Le nom de cette source karstique d'un bleu intense signifie « l'Œil bleu » en albanais.", "Syri i Kaltër"],
  ["culture", "iso-polyphonie-albanaise", "Iso-polyphonie albanaise", "AL", null, null, "🎶", "rare", "Ce chant à plusieurs voix sur un bourdon a été proclamé chef-d'œuvre du patrimoine oral et immatériel de l'humanité par l'UNESCO en 2005.", "Iso-polyphonie populaire albanaise"],
  // Andorre
  ["ville", "escaldes-engordany", "Escaldes-Engordany", "AD", 42.509, 1.539, "🏘️", "peu-commun", "Créée en 1978 par séparation d'avec Andorre-la-Vieille, c'est la plus récente des paroisses d'Andorre.", "Escaldes-Engordany"],
  ["monument", "caldea", "Caldea", "AD", 42.511, 1.536, "♨️", "peu-commun", "Ouvert en 1994, ce centre thermal en forme de cathédrale de verre est alimenté par les sources d'eau chaude d'Escaldes-Engordany.", "Caldea"],
  ["nature", "madriu-perafita-claror", "Vallée du Madriu-Perafita-Claror", "AD", 42.490, 1.580, "🏞️", "epique", "Cette vallée glaciaire, inscrite en 2004, est le seul site d'Andorre classé au patrimoine mondial de l'UNESCO.", "Vallée du Madriu-Perafita-Claror"],
  ["culture", "fetes-feu-solstice-pyrenees", "Fêtes du feu du solstice d'été", "AD", null, null, "🔥", "rare", "Ces descentes de torches enflammées dans les Pyrénées sont inscrites depuis 2015 au patrimoine immatériel de l'UNESCO, au nom de l'Andorre, de l'Espagne et de la France.", "Fêtes du feu du solstice d'été dans les Pyrénées"],
  // Biélorussie
  ["ville", "hrodna", "Hrodna", "BY", 53.678, 23.830, "🏘️", "peu-commun", "Mentionnée dans les chroniques dès le XIIe siècle, Hrodna est l'une des plus anciennes villes de Biélorussie.", "Hrodna"],
  ["monument", "forteresse-brest", "Forteresse de Brest", "BY", 52.083, 23.656, "🏰", "rare", "Sa garnison résista pendant des semaines à l'invasion allemande déclenchée le 22 juin 1941.", "Forteresse de Brest"],
  ["nature", "berezina", "Bérézina", "BY", 54.320, 28.350, "🌊", "rare", "Le passage de cette rivière par la Grande Armée de Napoléon en novembre 1812 a donné l'expression française « c'est la bérézina ».", "Bérézina (rivière)"],
  ["animal", "cigogne-noire", "Cigogne noire", "BY", null, null, "🐦", "rare", "Contrairement à la cigogne blanche, cette espèce discrète niche au cœur des forêts, loin des habitations humaines.", "Cigogne noire"],
  // Bosnie-Herzégovine
  ["ville", "jajce", "Jajce", "BA", 44.341, 17.270, "🏘️", "peu-commun", "C'est à Jajce qu'en novembre 1943 l'AVNOJ posa les bases de la Yougoslavie fédérale de Tito.", "Jajce"],
  ["monument", "pont-visegrad", "Pont Mehmed Pacha Sokolović", "BA", 43.782, 19.288, "🌉", "epique", "Ce pont ottoman de Višegrad sur la Drina a inspiré à Ivo Andrić son roman « Le Pont sur la Drina ».", "Pont Mehmed Pacha Sokolović"],
  ["nature", "sutjeska", "Parc national de Sutjeska", "BA", 43.330, 18.680, "🌲", "rare", "Ce parc abrite la forêt de Perućica, l'une des dernières forêts primaires d'Europe.", "Parc national de Sutjeska"],
  ["culture", "sevdalinka", "Sevdalinka", "BA", null, null, "🎶", "peu-commun", "Ce chant traditionnel bosniaque, souvent mélancolique, évoque l'amour et la nostalgie.", "Sevdalinka"],
  // Chypre
  ["ville", "paphos", "Paphos", "CY", 34.776, 32.424, "🏘️", "peu-commun", "Paphos a été capitale européenne de la culture en 2017, aux côtés d'Aarhus.", "Paphos"],
  ["nature", "petra-tou-romiou", "Petra tou Romiou", "CY", 34.664, 32.627, "🪨", "rare", "Selon la légende, Aphrodite serait née de l'écume de la mer près de ce rocher.", "Petra tou Romiou"],
  ["animal", "mouflon-chypre", "Mouflon de Chypre", "CY", null, null, "🐏", "epique", "Ce mouflon endémique, qui vit dans les forêts du massif du Troodos, est un symbole national de Chypre.", "Mouflon de Chypre"],
  // Estonie
  ["ville", "tartu", "Tartu", "EE", 58.378, 26.729, "🏘️", "peu-commun", "Tartu abrite la plus ancienne université d'Estonie, fondée en 1632 par le roi de Suède Gustave II Adolphe.", "Tartu"],
  ["monument", "chateau-kuressaare", "Château de Kuressaare", "EE", 58.248, 22.479, "🏰", "rare", "Sur l'île de Saaremaa, ce château épiscopal est le château médiéval le mieux conservé d'Estonie.", "Château de Kuressaare"],
  ["nature", "lahemaa", "Parc national de Lahemaa", "EE", 59.567, 25.833, "🌲", "rare", "Créé en 1971, Lahemaa fut le premier parc national de l'Union soviétique.", "Parc national de Lahemaa"],
  ["culture", "kiiking", "Kiiking", "EE", null, null, "🎢", "peu-commun", "Ce sport estonien consiste à faire un tour complet autour de l'axe d'une balançoire géante, debout et les pieds attachés.", "Kiiking"],
  // Lettonie
  ["monument", "palais-rundale", "Palais de Rundāle", "LV", 56.414, 24.025, "🏛️", "rare", "Ce palais baroque a été conçu par Bartolomeo Rastrelli, l'architecte du palais d'Hiver de Saint-Pétersbourg.", "Palais de Rundāle"],
  ["nature", "ventas-rumba", "Ventas rumba", "LV", 56.968, 21.977, "💦", "rare", "Large d'environ 250 mètres, cette chute de la Venta à Kuldīga est souvent présentée comme la plus large d'Europe.", "Ventas rumba"],
  ["culture", "jani", "Jāņi", "LV", null, null, "🌿", "peu-commun", "Lors de cette fête du solstice d'été, les Lettons portent des couronnes de feuilles et de fleurs et veillent autour de feux de joie.", "Jāņi"],
  // Liechtenstein
  ["ville", "schaan", "Schaan", "LI", 47.165, 9.509, "🏘️", "peu-commun", "Schaan est la commune la plus peuplée du Liechtenstein, devant la capitale Vaduz.", "Schaan"],
  ["monument", "cathedrale-vaduz", "Cathédrale Saint-Florin de Vaduz", "LI", 47.137, 9.522, "⛪", "peu-commun", "Cette église néogothique est devenue cathédrale en 1997 avec la création de l'archidiocèse de Vaduz.", "Cathédrale Saint-Florin de Vaduz"],
  ["nature", "grauspitz", "Grauspitz", "LI", 47.054, 9.582, "🏔️", "rare", "Avec 2 599 mètres d'altitude, ce sommet à la frontière suisse est le point culminant du Liechtenstein.", "Grauspitz"],
  ["plat", "kasknopfle", "Käsknöpfle", "LI", null, null, "🧀", "commun", "Ces petites pâtes aux œufs gratinées au fromage et servies avec des oignons frits sont le plat national du Liechtenstein.", "Käsknöpfle"],
  ["culture", "oben-am-jungen-rhein", "Oben am jungen Rhein", "LI", null, null, "🎵", "rare", "L'hymne national du Liechtenstein se chante sur la même mélodie que l'hymne britannique « God Save the King ».", "Oben am jungen Rhein"],
  // Lituanie
  ["monument", "chateau-trakai", "Château de Trakai", "LT", 54.652, 24.934, "🏰", "rare", "Ce château de briques rouges est bâti sur une île du lac Galvė.", "Château de Trakai"],
  ["culture", "sutartines", "Sutartinės", "LT", null, null, "🎶", "rare", "Ces chants polyphoniques lituaniens sont inscrits depuis 2010 au patrimoine culturel immatériel de l'UNESCO.", "Sutartinės"],
  // Luxembourg
  ["ville", "esch-sur-alzette", "Esch-sur-Alzette", "LU", 49.496, 5.981, "🏘️", "peu-commun", "Deuxième ville du pays, ancienne cité sidérurgique, Esch-sur-Alzette a été capitale européenne de la culture en 2022.", "Esch-sur-Alzette"],
  ["monument", "chateau-vianden", "Château de Vianden", "LU", 49.935, 6.202, "🏰", "rare", "Bâti entre le XIe et le XIVe siècle, ce château domine la ville de Vianden et la vallée de l'Our.", "Château de Vianden"],
  ["nature", "lac-haute-sure", "Lac de la Haute-Sûre", "LU", 49.904, 5.852, "🏞️", "peu-commun", "Ce lac de barrage sur la Sûre fournit une grande partie de l'eau potable du Luxembourg.", "Lac de la Haute-Sûre"],
  ["culture", "procession-echternach", "Procession dansante d'Echternach", "LU", null, null, "💃", "rare", "Chaque mardi de Pentecôte, des milliers de pèlerins traversent Echternach en dansant en l'honneur de saint Willibrord.", "Procession dansante d'Echternach"],
  // Malte
  ["monument", "hypogee-hal-saflieni", "Hypogée de Ħal Saflieni", "MT", 35.869, 14.507, "🏛️", "epique", "Ce sanctuaire funéraire préhistorique entièrement creusé dans la roche est inscrit au patrimoine mondial de l'UNESCO depuis 1980.", "Hypogée de Ħal Saflieni"],
  ["culture", "luzzu", "Luzzu", "MT", null, null, "🚤", "peu-commun", "Ces barques de pêche maltaises aux couleurs vives portent souvent un œil peint à la proue, dit œil d'Osiris.", "Luzzu"],
  // Moldavie
  ["ville", "balti", "Bălți", "MD", 47.762, 27.929, "🏘️", "peu-commun", "Bălți est la principale ville du nord de la Moldavie, souvent surnommée la « capitale du Nord ».", "Bălți"],
  ["monument", "milestii-mici", "Mileștii Mici", "MD", 46.912, 28.797, "🍷", "epique", "Ses caves souterraines sont entrées au Livre Guinness des records en 2005 pour la plus grande collection de vins au monde.", "Mileștii Mici"],
  ["nature", "dniestr", "Dniestr", "MD", 48.157, 28.300, "🌊", "peu-commun", "Long de plus de 1 300 km, ce fleuve traverse l'Ukraine et la Moldavie avant de se jeter dans la mer Noire.", "Dniestr"],
  // Monaco
  ["ville", "monte-carlo", "Monte-Carlo", "MC", 43.740, 7.427, "🏘️", "peu-commun", "Ce quartier de Monaco a été baptisé en 1866 en l'honneur du prince Charles III.", "Monte-Carlo"],
  ["monument", "casino-monte-carlo", "Casino de Monte-Carlo", "MC", 43.739, 7.428, "🎰", "epique", "Sa salle de spectacle, inaugurée en 1879, a été conçue par Charles Garnier, l'architecte de l'Opéra de Paris.", "Casino de Monte-Carlo"],
  ["nature", "rocher-monaco", "Rocher de Monaco", "MC", 43.731, 7.420, "🪨", "rare", "Ce promontoire rocheux avancé dans la mer porte la vieille ville et le palais princier.", "Rocher de Monaco"],
  ["culture", "festival-cirque-monte-carlo", "Festival international du cirque de Monte-Carlo", "MC", null, null, "🎪", "rare", "Créé en 1974 par le prince Rainier III, ce festival récompense ses lauréats par des Clowns d'or.", "Festival international du cirque de Monte-Carlo"],
  // Monténégro
  ["ville", "cetinje", "Cetinje", "ME", 42.390, 18.923, "🏘️", "peu-commun", "Ancienne capitale royale du Monténégro, Cetinje en reste la capitale historique et la résidence officielle du président.", "Cetinje"],
  ["nature", "lac-skadar", "Lac de Skadar", "ME", 42.200, 19.300, "🏞️", "rare", "Partagé avec l'Albanie, c'est le plus grand lac des Balkans.", "Lac de Skadar"],
  // Macédoine du Nord
  ["ville", "skopje", "Skopje", "MK", 41.996, 21.431, "🏘️", "peu-commun", "La capitale de la Macédoine du Nord est la ville natale de Mère Teresa, née en 1910.", "Skopje"],
  ["nature", "canyon-matka", "Canyon de Matka", "MK", 41.950, 21.297, "🏞️", "rare", "Ce canyon creusé par la rivière Treska, proche de Skopje, abrite plusieurs monastères médiévaux et des grottes.", "Canyon de Matka"],
  ["plat", "ajvar", "Ajvar", "MK", null, null, "🫑", "commun", "Ce condiment à base de poivrons rouges grillés est traditionnellement préparé en grande quantité à l'automne.", "Ajvar"],
  // Saint-Marin
  ["ville", "borgo-maggiore", "Borgo Maggiore", "SM", 43.942, 12.448, "🏘️", "peu-commun", "Au pied du mont Titano, Borgo Maggiore est reliée à la vieille ville de Saint-Marin par un téléphérique.", "Borgo Maggiore"],
  ["ville", "serravalle", "Serravalle", "SM", 43.969, 12.481, "🏘️", "peu-commun", "Serravalle est le castello le plus peuplé de Saint-Marin et accueille le stade national, le San Marino Stadium.", "Serravalle (Saint-Marin)"],
  ["monument", "guaita", "Guaita", "SM", 43.936, 12.450, "🏰", "rare", "Cette tour, la plus ancienne des trois tours du mont Titano, figure sur le drapeau de Saint-Marin.", "Guaita"],
  ["monument", "palais-public-saint-marin", "Palais public de Saint-Marin", "SM", 43.936, 12.446, "🏛️", "peu-commun", "Ce palais néogothique, siège du gouvernement, voit chaque jour la relève de la garde de la Rocca.", "Palais public (Saint-Marin)"],
  ["nature", "mont-titano", "Mont Titano", "SM", 43.936, 12.449, "⛰️", "rare", "Ce mont de 739 mètres et le centre historique qu'il porte sont inscrits au patrimoine mondial de l'UNESCO depuis 2008.", "Mont Titano"],
  ["culture", "capitaines-regents", "Capitaines-régents", "SM", null, null, "👑", "rare", "Depuis le Moyen Âge, Saint-Marin est dirigé par deux capitaines-régents élus pour un mandat de six mois seulement.", "Capitaine-régent"],
  // Serbie
  ["ville", "novi-sad", "Novi Sad", "RS", 45.267, 19.833, "🏘️", "peu-commun", "Novi Sad accueille chaque été le festival EXIT dans la forteresse de Petrovaradin et fut capitale européenne de la culture en 2022.", "Novi Sad"],
  ["monument", "monastere-studenica", "Monastère de Studenica", "RS", 43.486, 20.532, "⛪", "rare", "Fondé à la fin du XIIe siècle par Stefan Nemanja, ce monastère est inscrit au patrimoine mondial de l'UNESCO depuis 1986.", "Monastère de Studenica"],
  // Slovaquie
  ["ville", "kosice", "Košice", "SK", 48.717, 21.261, "🏘️", "peu-commun", "Deuxième ville de Slovaquie, Košice a été capitale européenne de la culture en 2013.", "Košice"],
  ["nature", "grotte-glace-dobsina", "Grotte de glace de Dobšiná", "SK", 48.871, 20.295, "🧊", "epique", "Cette grotte glacée fait partie des grottes du karst d'Aggtelek et de Slovaquie, inscrites au patrimoine mondial de l'UNESCO.", "Grotte de glace de Dobšiná"],
  // Vatican
  ["monument", "musees-vatican", "Musées du Vatican", "VA", 41.906, 12.454, "🖼️", "epique", "Leur origine remonte aux sculptures antiques réunies par le pape Jules II au début du XVIe siècle.", "Musées du Vatican"],
  ["monument", "place-saint-pierre", "Place Saint-Pierre", "VA", 41.902, 12.457, "⛲", "rare", "Sa célèbre colonnade elliptique a été dessinée par le Bernin au XVIIe siècle.", "Place Saint-Pierre"],
  ["culture", "garde-suisse", "Garde suisse pontificale", "VA", null, null, "💂", "rare", "Fondée en 1506 sous le pape Jules II, c'est l'une des plus anciennes armées encore en activité au monde.", "Garde suisse pontificale"],
  ["culture", "conclave", "Conclave", "VA", null, null, "💨", "peu-commun", "Lors de l'élection d'un pape, une fumée blanche s'élevant de la chapelle Sixtine annonce qu'un nouveau pontife a été choisi.", "Conclave"],
  // Afghanistan
  ["ville", "herat", "Hérat", "AF", 34.342, 62.204, "🏘️", "peu-commun", "Hérat abrite une grande mosquée du Vendredi célèbre pour ses mosaïques de faïence bleue.", "Hérat"],
  ["nature", "band-e-amir", "Parc national de Band-e Amir", "AF", 34.837, 67.233, "🏞️", "epique", "Ses lacs d'un bleu profond retenus par des barrages naturels de travertin forment, depuis 2009, le premier parc national d'Afghanistan.", "Parc national de Band-e Amir"],
  // Arménie
  ["ville", "gyumri", "Gyumri", "AM", 40.785, 43.841, "🏘️", "peu-commun", "Deuxième ville d'Arménie, Gyumri fut gravement touchée par le séisme de Spitak en 1988.", "Gyumri"],
  ["monument", "monastere-tatev", "Monastère de Tatev", "AM", 39.380, 46.250, "⛪", "rare", "On y accède par les « Ailes de Tatev », téléphérique entré au Livre Guinness des records comme le plus long téléphérique réversible du monde.", "Monastère de Tatev"],
  // Azerbaïdjan
  ["ville", "sheki", "Şəki", "AZ", 41.198, 47.170, "🏘️", "peu-commun", "Son centre historique et le palais des khans de Şəki sont inscrits au patrimoine mondial de l'UNESCO depuis 2019.", "Şəki"],
  ["monument", "palais-chirvanchahs", "Palais des Chirvanchahs", "AZ", 40.366, 49.833, "🏛️", "rare", "Ce palais du XVe siècle de la vieille ville de Bakou est inscrit au patrimoine mondial de l'UNESCO.", "Palais des Chirvanchahs"],
  // Bahreïn
  ["ville", "muharraq", "Muharraq", "BH", 26.257, 50.612, "🏘️", "peu-commun", "Muharraq conserve les maisons de marchands de perles inscrites en 2012 au patrimoine mondial sous le nom de « Route de la perle ».", "Muharraq"],
  ["monument", "bahrain-world-trade-center", "Bahrain World Trade Center", "BH", 26.215, 50.585, "🏙️", "peu-commun", "Ses deux tours sont reliées par trois ponts portant chacun une grande éolienne.", "Bahrain World Trade Center"],
  ["monument", "circuit-sakhir", "Circuit international de Sakhir", "BH", 26.032, 50.512, "🏎️", "peu-commun", "En 2004, ce circuit a accueilli le premier Grand Prix de Formule 1 organisé au Moyen-Orient.", "Circuit international de Sakhir"],
  ["nature", "arbre-de-vie-bahrein", "Arbre de vie", "BH", 25.994, 50.583, "🌳", "rare", "Ce prosopis vieux de plus de 400 ans pousse seul en plein désert, sans source d'eau apparente.", "Arbre de vie (Bahreïn)"],
  // Bangladesh
  ["monument", "mosquee-soixante-domes", "Mosquée aux soixante dômes", "BD", 22.674, 89.742, "🕌", "rare", "Bâtie au XVe siècle, elle est le joyau de la ville-mosquée de Bagerhat, inscrite au patrimoine mondial de l'UNESCO.", "Mosquée aux soixante dômes"],
  ["culture", "jamdani", "Jamdani", "BD", null, null, "🧵", "rare", "Le tissage de cette fine mousseline de coton à motifs est inscrit au patrimoine immatériel de l'UNESCO depuis 2013.", "Jamdani"],
  // Brunei
  ["ville", "kampong-ayer", "Kampong Ayer", "BN", 4.885, 114.942, "🛶", "peu-commun", "Ce village sur pilotis bâti sur la rivière Brunei est souvent surnommé la « Venise de l'Orient ».", "Kampong Ayer"],
  ["monument", "istana-nurul-iman", "Istana Nurul Iman", "BN", 4.873, 114.903, "🏰", "epique", "Résidence du sultan, ce palais de près de 1 800 pièces est considéré comme le plus grand palais résidentiel du monde.", "Istana Nurul Iman"],
  ["nature", "ulu-temburong", "Parc national d'Ulu Temburong", "BN", 4.533, 115.150, "🌳", "rare", "Ce parc de forêt tropicale primaire n'est accessible qu'en pirogue, et une passerelle permet d'y marcher au-dessus de la canopée.", "Parc national d'Ulu Temburong"],
  // Irak
  ["monument", "grande-mosquee-samarra", "Grande Mosquée de Samarra", "IQ", 34.206, 43.880, "🕌", "epique", "Son minaret en spirale, la Malwiya, haut d'environ 52 mètres, se gravit par une rampe extérieure.", "Grande Mosquée de Samarra"],
  ["plat", "masgouf", "Masgouf", "IQ", null, null, "🐟", "peu-commun", "Ce poisson du Tigre, ouvert en deux puis grillé verticalement autour d'un feu de bois, est considéré comme le plat national irakien.", "Masgouf"],
  // Koweït
  ["ville", "al-jahra", "Al Jahra", "KW", 29.337, 47.658, "🏘️", "peu-commun", "Al Jahra est connue pour son Fort rouge, théâtre de la bataille de Jahra en 1920.", "Al Jahra"],
  ["monument", "grande-mosquee-koweit", "Grande Mosquée de Koweït", "KW", 29.378, 47.983, "🕌", "peu-commun", "Inaugurée en 1986, c'est la plus grande mosquée du Koweït.", "Grande Mosquée de Koweït"],
  ["nature", "failaka", "Île de Failaka", "KW", 29.437, 48.332, "🏝️", "rare", "Cette île du golfe Persique abrite les vestiges d'une colonie grecque fondée à l'époque d'Alexandre le Grand.", "Failaka"],
  ["plat", "machbous", "Machbous", "KW", null, null, "🍛", "commun", "Ce riz épicé cuit avec de la viande ou du poisson est l'un des plats les plus populaires des pays du golfe Persique.", "Machbous"],
  ["culture", "boutre", "Boutre", "KW", null, null, "⛵", "peu-commun", "Le Koweït fut un grand centre de construction de ces voiliers traditionnels en bois, utilisés pour le commerce et la pêche des perles.", "Boutre"],
  // Liban
  ["ville", "byblos", "Byblos", "LB", 34.119, 35.646, "🏘️", "peu-commun", "Byblos est l'une des plus anciennes villes habitées en continu au monde, inscrite au patrimoine mondial de l'UNESCO depuis 1984.", "Byblos"],
  ["nature", "cedres-de-dieu", "Forêt des Cèdres de Dieu", "LB", 34.244, 36.048, "🌲", "epique", "Certains cèdres de cette forêt ont plus de mille ans, et l'arbre figure sur le drapeau libanais.", "Forêt des Cèdres de Dieu"],
  // Maldives
  ["ville", "hulhumale", "Hulhumalé", "MV", 4.212, 73.540, "🏘️", "peu-commun", "Cette ville a été bâtie sur une île artificielle gagnée sur la mer pour désengorger Malé.", "Hulhumalé"],
  ["monument", "hukuru-miskiy", "Hukuru Miskiy", "MV", 4.176, 73.509, "🕌", "rare", "Cette mosquée du Vendredi de Malé, achevée en 1658, est bâtie en blocs de corail finement sculptés.", "Hukuru Miskiy"],
  ["nature", "atoll-addu", "Atoll d'Addu", "MV", -0.630, 73.150, "🏝️", "rare", "Cet atoll le plus méridional des Maldives a abrité une base aérienne britannique sur l'île de Gan.", "Atoll d'Addu"],
  ["animal", "tortue-imbriquee", "Tortue imbriquée", "MV", null, null, "🐢", "epique", "Cette tortue marine en danger critique se nourrit principalement d'éponges sur les récifs coralliens.", "Tortue imbriquée"],
  ["culture", "bodu-beru", "Bodu beru", "MV", null, null, "🥁", "peu-commun", "Le nom de cette musique traditionnelle maldivienne aux rythmes de grands tambours signifie « gros tambour ».", "Bodu beru"],
  // Corée du Nord
  ["monument", "arc-triomphe-pyongyang", "Arc de triomphe de Pyongyang", "KP", 39.042, 125.761, "🏛️", "rare", "Haut d'environ 60 mètres, il dépasse l'Arc de triomphe de Paris dont il s'inspire.", "Arc de triomphe de Pyongyang"],
  ["nature", "mont-kumgang", "Mont Kumgang", "KP", 38.660, 128.080, "⛰️", "rare", "Le nom de ces montagnes aux nombreux pics granitiques signifie « montagnes de diamant ».", "Mont Kumgang"],
  // Oman
  ["ville", "salalah", "Salalah", "OM", 17.019, 54.089, "🏘️", "peu-commun", "Chaque été, la mousson du khareef y apporte brume et pluie qui verdissent les montagnes du Dhofar.", "Salalah"],
  ["monument", "mosquee-sultan-qaboos", "Grande mosquée du Sultan Qaboos", "OM", 23.584, 58.388, "🕌", "epique", "Sa salle de prière abrite un immense tapis persan d'un seul tenant de plus de 4 000 m².", "Grande mosquée du Sultan Qaboos"],
  ["nature", "djebel-shams", "Djebel Shams", "OM", 23.237, 57.263, "⛰️", "rare", "Point culminant d'Oman, il surplombe le Wadi Ghul, surnommé le « Grand Canyon de l'Arabie ».", "Djebel Shams"],
  ["culture", "khanjar", "Khanjar", "OM", null, null, "🗡️", "peu-commun", "Ce poignard courbe traditionnel figure sur l'emblème national d'Oman.", "Khanjar"],
  // Palestine
  ["ville", "jericho", "Jéricho", "PS", 31.857, 35.444, "🏘️", "peu-commun", "Située à environ 250 mètres sous le niveau de la mer, Jéricho est souvent citée comme la ville la plus basse du monde.", "Jéricho"],
  ["monument", "palais-hisham", "Palais d'Hisham", "PS", 31.885, 35.460, "🏛️", "rare", "Ce palais omeyyade du VIIIe siècle est célèbre pour sa mosaïque de l'arbre de vie.", "Palais d'Hisham"],
  ["plat", "musakhan", "Musakhan", "PS", null, null, "🍗", "commun", "Ce plat de poulet rôti aux oignons et au sumac est servi sur du pain taboun arrosé d'huile d'olive.", "Musakhan"],
  ["culture", "dabkeh", "Dabkeh", "PS", null, null, "💃", "peu-commun", "Dans cette danse collective, les danseurs se tiennent en ligne et frappent le sol du pied en rythme.", "Dabkeh"],
  // Qatar
  ["ville", "al-wakrah", "Al Wakrah", "QA", 25.171, 51.603, "🏘️", "peu-commun", "Al Wakrah accueille le stade Al-Janoub, conçu par Zaha Hadid pour la Coupe du monde de football 2022.", "Al Wakrah"],
  ["monument", "souq-waqif", "Souq Waqif", "QA", 25.287, 51.533, "🏪", "peu-commun", "Ce marché traditionnel de Doha abrite notamment un souk aux faucons et un hôpital pour faucons.", "Souq Waqif"],
  ["nature", "khor-al-adaid", "Khor Al Adaid", "QA", 24.600, 51.330, "🏜️", "rare", "Dans cette « mer intérieure », les dunes de sable du désert plongent directement dans les eaux du golfe Persique.", "Khor Al Adaid"],
  ["culture", "fauconnerie", "Fauconnerie", "QA", null, null, "🦅", "rare", "La fauconnerie est inscrite au patrimoine culturel immatériel de l'UNESCO au nom de nombreux pays, dont le Qatar.", "Fauconnerie"],
  // Singapour
  ["monument", "jardin-botanique-singapour", "Jardin botanique de Singapour", "SG", 1.315, 103.816, "🌺", "rare", "Inscrit en 2015, c'est le premier site de Singapour classé au patrimoine mondial de l'UNESCO.", "Jardin botanique de Singapour"],
  ["plat", "riz-poulet-hainanais", "Riz au poulet hainanais", "SG", null, null, "🍚", "commun", "Ce poulet poché servi avec un riz cuit dans son bouillon est souvent considéré comme l'un des plats nationaux de Singapour.", "Riz au poulet hainanais"],
  // Syrie
  ["ville", "bosra", "Bosra", "SY", 32.518, 36.481, "🏘️", "peu-commun", "Bosra possède un théâtre romain du IIe siècle parmi les mieux conservés au monde.", "Bosra"],
  ["culture", "savon-alep", "Savon d'Alep", "SY", null, null, "🧼", "peu-commun", "Ce savon traditionnel est fabriqué à partir d'huile d'olive et d'huile de baies de laurier.", "Savon d'Alep"],
  // Tadjikistan
  ["ville", "khodjent", "Khodjent", "TJ", 40.283, 69.623, "🏘️", "peu-commun", "Deuxième ville du Tadjikistan, Khodjent occupe le site d'Alexandrie Eschate, fondée par Alexandre le Grand.", "Khodjent"],
  ["monument", "barrage-nourek", "Barrage de Nourek", "TJ", 38.373, 69.348, "🏗️", "rare", "Haut d'environ 300 mètres, ce barrage sur le Vakhch compte parmi les plus hauts du monde.", "Barrage de Nourek"],
  ["nature", "iskanderkoul", "Iskanderkoul", "TJ", 39.075, 68.372, "🏞️", "rare", "Ce lac de montagne des monts Fann doit son nom à Alexandre le Grand, appelé Iskander en Asie centrale.", "Iskanderkoul"],
  ["culture", "shashmaqam", "Shashmaqam", "TJ", null, null, "🎶", "rare", "Cette musique savante classique, partagée avec l'Ouzbékistan, est inscrite au patrimoine immatériel de l'UNESCO.", "Shashmaqam"],
  // Timor oriental
  ["ville", "baucau", "Baucau", "TL", -8.466, 126.450, "🏘️", "peu-commun", "Baucau est la deuxième ville du Timor oriental, après la capitale Dili.", "Baucau"],
  ["nature", "atauro", "Atauro", "TL", -8.250, 125.600, "🏝️", "epique", "Les récifs coralliens de cette île au nord de Dili figurent parmi les plus riches au monde en espèces de poissons.", "Atauro"],
  ["nature", "tatamailau", "Tatamailau", "TL", -8.910, 125.495, "⛰️", "rare", "Aussi appelé mont Ramelau, c'est le point culminant du Timor oriental, coiffé d'une statue de la Vierge.", "Tatamailau"],
  ["culture", "tais", "Tais", "TL", null, null, "🧵", "rare", "Ce textile tissé à la main par les femmes timoraises est inscrit au patrimoine immatériel de l'UNESCO nécessitant une sauvegarde urgente.", "Tais"],
  // Turkménistan
  ["ville", "mary", "Mary", "TM", 37.600, 61.833, "🏘️", "peu-commun", "Mary est située à une trentaine de kilomètres des ruines de l'antique Merv.", "Mary (Turkménistan)"],
  ["monument", "kounia-ourguentch", "Kounia-Ourguentch", "TM", 42.333, 59.150, "🕌", "epique", "Son minaret de Kutlug-Timur, haut d'environ 60 mètres, est l'un des plus hauts d'Asie centrale.", "Kounia-Ourguentch"],
  ["culture", "tapis-turkmene", "Tapis turkmène", "TM", null, null, "🧶", "rare", "Les motifs de cinq tapis turkmènes figurent sur la bande verticale du drapeau du Turkménistan.", "Tapis turkmène"],
  // Ouzbékistan
  ["ville", "khiva", "Khiva", "UZ", 41.378, 60.364, "🏘️", "peu-commun", "Sa ville intérieure fortifiée, l'Itchan Kala, est devenue en 1990 le premier site d'Asie centrale inscrit au patrimoine mondial de l'UNESCO.", "Khiva"],
  ["culture", "suzani", "Suzani", "UZ", null, null, "🧵", "peu-commun", "Ces grandes tentures brodées faisaient traditionnellement partie de la dot des jeunes mariées.", "Suzani"],
  // Yémen
  ["monument", "dar-al-hajar", "Dar al-Hajar", "YE", 15.427, 44.137, "🏰", "epique", "Ce palais de plusieurs étages est construit au sommet d'un piton rocheux dans le Wadi Dhahr, près de Sanaa.", "Dar al-Hajar"],
  ["culture", "jambiya", "Jambiya", "YE", null, null, "🗡️", "peu-commun", "Ce poignard courbe porté à la ceinture est un accessoire traditionnel des hommes yéménites.", "Jambiya"],
];
if (typeof module === "object" && module.exports) module.exports = { CARTES_PAYS_EUAS };
