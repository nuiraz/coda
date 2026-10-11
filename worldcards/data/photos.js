"use strict";
/* Article Wikipédia (en français) dont la photo principale illustre chaque carte.
   Les photos sont chargées depuis Wikimedia Commons dans le navigateur du joueur ;
   l'auteur et la licence s'affichent sur la fiche de la carte. */
const PHOTOS_WIKI = {
  // Villes
  "ville:paris": "Paris", "ville:londres": "Londres", "ville:rome": "Rome", "ville:venise": "Venise",
  "ville:barcelone": "Barcelone", "ville:amsterdam": "Amsterdam", "ville:prague": "Prague", "ville:lisbonne": "Lisbonne",
  "ville:saint-petersbourg": "Saint-Pétersbourg", "ville:reykjavik": "Reykjavik", "ville:istanbul": "Istanbul",
  "ville:le-caire": "Le Caire", "ville:marrakech": "Marrakech", "ville:tombouctou": "Tombouctou", "ville:le-cap": "Le Cap",
  "ville:new-york": "New York", "ville:quebec": "Québec (ville)", "ville:mexico": "Mexico", "ville:rio": "Rio de Janeiro",
  "ville:buenos-aires": "Buenos Aires", "ville:cusco": "Cuzco", "ville:tokyo": "Tokyo", "ville:kyoto": "Kyoto",
  "ville:pekin": "Pékin", "ville:shanghai": "Shanghai", "ville:bangkok": "Bangkok", "ville:dubai": "Dubaï",
  "ville:varanasi": "Varanasi", "ville:samarcande": "Samarcande", "ville:sydney": "Sydney",
  // Monuments
  "monu:tour-eiffel": "Tour Eiffel", "monu:versailles": "Château de Versailles", "monu:mont-saint-michel": "Mont-Saint-Michel",
  "monu:pont-du-gard": "Pont du Gard", "monu:big-ben": "Big Ben", "monu:stonehenge": "Stonehenge",
  "monu:sagrada-familia": "Sagrada Família", "monu:alhambra": "Alhambra (Grenade)", "monu:acropole": "Acropole d'Athènes",
  "monu:tour-de-pise": "Tour de Pise", "monu:neuschwanstein": "Château de Neuschwanstein", "monu:atomium": "Atomium",
  "monu:saint-basile": "Cathédrale Saint-Basile-le-Bienheureux", "monu:sainte-sophie": "Sainte-Sophie",
  "monu:sphinx": "Grand Sphinx de Gizeh", "monu:abou-simbel": "Temples d'Abou Simbel", "monu:djenne": "Grande mosquée de Djenné",
  "monu:lalibela": "Églises creusées dans le roc de Lalibela", "monu:grand-zimbabwe": "Grand Zimbabwe", "monu:persepolis": "Persépolis",
  "monu:golden-temple": "Temple d'or", "monu:cite-interdite": "Cité interdite", "monu:potala": "Palais du Potala",
  "monu:fushimi-inari": "Fushimi Inari-taisha", "monu:angkor-vat": "Angkor Vat", "monu:borobudur": "Borobudur",
  "monu:burj-khalifa": "Burj Khalifa", "monu:statue-liberte": "Statue de la Liberté", "monu:golden-gate": "Golden Gate Bridge",
  "monu:mont-rushmore": "Mont Rushmore", "monu:tour-cn": "Tour CN", "monu:teotihuacan": "Teotihuacan", "monu:tikal": "Tikal",
  "monu:moai": "Moaï", "monu:opera-sydney": "Opéra de Sydney", "monu:arc-de-triomphe": "Arc de triomphe de l'Étoile",
  "monu:notre-dame": "Cathédrale Notre-Dame de Paris", "monu:fontaine-trevi": "Fontaine de Trevi",
  "monu:porte-brandebourg": "Porte de Brandebourg", "monu:tower-bridge": "Tower Bridge", "monu:tour-belem": "Tour de Belém",
  "monu:mere-patrie": "La Mère-Patrie appelle !", "monu:mosquee-bleue": "Mosquée bleue", "monu:vallee-des-rois": "Vallée des Rois",
  "monu:hassan-ii": "Mosquée Hassan-II", "monu:meroe": "Pyramides de Méroé", "monu:armee-terre-cuite": "Armée de terre cuite",
  "monu:himeji": "Château de Himeji", "monu:kinkaku-ji": "Kinkaku-ji", "monu:shwedagon": "Pagode Shwedagon",
  "monu:qutub-minar": "Qutb Minar", "monu:marina-bay-sands": "Marina Bay Sands", "monu:empire-state": "Empire State Building",
  "monu:frontenac": "Château Frontenac", "monu:nazca": "Lignes de Nazca", "monu:harbour-bridge": "Sydney Harbour Bridge",
  // Merveilles
  "merv:grande-muraille": "Grande Muraille", "merv:petra": "Pétra", "merv:christ-redempteur": "Christ Rédempteur",
  "merv:machu-picchu": "Machu Picchu", "merv:chichen-itza": "Chichén Itzá", "merv:colisee": "Colisée", "merv:taj-mahal": "Taj Mahal",
  "merv:kheops": "Pyramide de Khéops", "merv:babylone": "Jardins suspendus de Babylone",
  "merv:zeus": "Statue chryséléphantine de Zeus à Olympie", "merv:artemis": "Temple d'Artémis à Éphèse",
  "merv:halicarnasse": "Mausolée d'Halicarnasse", "merv:colosse-rhodes": "Colosse de Rhodes", "merv:phare-alexandrie": "Phare d'Alexandrie",
  // Cartes secrètes du Monde (visibles une fois débloquées)
  "secret:avalon": "Avalon", "secret:pount": "Pays de Pount", "secret:shangri-la": "Shangri-La", "secret:cibola": "Sept cités de Cibola",
  "secret:el-dorado": "El Dorado", "secret:mu": "Mu (continent)", "secret:atlantide": "Atlantide", "secret:cite-z": "Percy Fawcett",
  "secret:gaia": "Terre",
  // Objets du quotidien
  "obj:fourchette": "Fourchette", "obj:cuillere": "Cuillère", "obj:baguettes": "Baguettes (couverts)", "obj:sachet-the": "Sachet de thé",
  "obj:ouvre-boite": "Ouvre-boîte", "obj:grille-pain": "Grille-pain", "obj:tire-bouchon": "Tire-bouchon", "obj:cocotte": "Autocuiseur",
  "obj:micro-ondes": "Four à micro-ondes", "obj:refrigerateur": "Réfrigérateur", "obj:allumette": "Allumette", "obj:bougie": "Bougie",
  "obj:brosse-dents": "Brosse à dents", "obj:papier-toilette": "Papier toilette", "obj:cle": "Clé (serrurerie)", "obj:parapluie": "Parapluie",
  "obj:miroir": "Miroir", "obj:aspirateur": "Aspirateur", "obj:ampoule": "Lampe à incandescence", "obj:crayon": "Crayon graphite",
  "obj:gomme": "Gomme (papeterie)", "obj:trombone": "Trombone (papeterie)", "obj:ciseaux": "Ciseaux", "obj:stylo-bille": "Stylo à bille",
  "obj:post-it": "Post-it", "obj:calculatrice": "Pascaline", "obj:papier": "Papier", "obj:livre-imprime": "Bible de Gutenberg",
  "obj:bouton": "Bouton (vêtement)", "obj:savon": "Savon", "obj:t-shirt": "T-shirt", "obj:rouge-levres": "Rouge à lèvres",
  "obj:jean": "Jean (pantalon)", "obj:fermeture-eclair": "Fermeture à glissière", "obj:velcro": "Velcro", "obj:montre-bracelet": "Montre-bracelet",
  "obj:lunettes": "Lunettes", "obj:des": "Dé", "obj:yoyo": "Yo-yo", "obj:puzzle": "Puzzle", "obj:ballon": "Ballon de football",
  "obj:cartes": "Carte à jouer", "obj:ours-peluche": "Ours en peluche", "obj:echecs": "Échecs", "obj:velo": "Draisienne",
  "obj:souris": "Souris (informatique)", "obj:code-barres": "Code-barres", "obj:ordinateur-portable": "Osborne 1", "obj:pile": "Pile voltaïque",
  "obj:appareil-photo": "Appareil photographique", "obj:radio": "Récepteur radio", "obj:boussole": "Boussole", "obj:telephone": "Téléphone",
  "obj:television": "Télévision", "obj:smartphone": "IBM Simon",
  // Cartes secrètes des Objets
  "osecret:sandwich": "Sandwich", "osecret:lampe-aladin": "Aladin ou la Lampe merveilleuse", "osecret:rosette": "Pierre de Rosette",
  "osecret:pantoufle-verre": "Cendrillon", "osecret:jeu-ur": "Jeu royal d'Ur", "osecret:anticythere": "Machine d'Anticythère",
  "osecret:disque-or": "Voyager Golden Record",
};
