"use strict";
/* Données de l'univers « Objets » : les objets de la vie courante et leur histoire. */

const CATEGORIES = {
  cuisine: { nom: "Cuisine", emoji: "🍳", couleur: "#d35400" },
  maison: { nom: "Maison", emoji: "🏠", couleur: "#16a085" },
  bureau: { nom: "Bureau & école", emoji: "✏️", couleur: "#2980b9" },
  mode: { nom: "Mode & soin", emoji: "👕", couleur: "#c0392b" },
  loisirs: { nom: "Jeux & loisirs", emoji: "🎲", couleur: "#8e44ad" },
  tech: { nom: "Technologie", emoji: "📱", couleur: "#34495e" },
};

// [id, nom, catégorie, emoji, rareté, année (pour le quiz, null si trop vague), date affichée, origine, anecdote]
const OBJETS_BRUTS = [
  // Cuisine
  ["fourchette", "Fourchette", "cuisine", "🍴", "commun", 1050, "XIe siècle", "Byzance, puis Venise", "Elle s'est répandue en Europe par Venise au XIe siècle, apportée par une princesse byzantine. On l'a longtemps jugée trop raffinée."],
  ["cuillere", "Cuillère", "cuisine", "🥄", "commun", null, "Préhistoire", "Monde entier", "C'est l'un des plus anciens ustensiles : on en a retrouvé en os, en bois ou en coquillage dès la préhistoire."],
  ["baguettes", "Baguettes", "cuisine", "🥢", "commun", -1200, "Il y a plus de 3 000 ans", "Chine", "Utilisées en Chine depuis plus de 3 000 ans, elles servaient d'abord à cuisiner plutôt qu'à manger."],
  ["sachet-the", "Sachet de thé", "cuisine", "🍵", "commun", 1908, "Vers 1908", "États-Unis", "Selon l'histoire, un marchand envoyait des échantillons dans de petits sacs de soie, que ses clients ont plongés directement dans l'eau."],
  ["ouvre-boite", "Ouvre-boîte", "cuisine", "🥫", "commun", 1855, "1855", "Angleterre", "Il est arrivé des décennies après la boîte de conserve : au début, on ouvrait les boîtes au marteau et au burin."],
  ["grille-pain", "Grille-pain", "cuisine", "🍞", "commun", 1919, "1919", "États-Unis", "Charles Strite a inventé le grille-pain qui fait sauter les tartines, lassé du pain brûlé servi à la cantine de son usine."],
  ["tire-bouchon", "Tire-bouchon", "cuisine", "🍷", "rare", 1630, "XVIIe siècle", "Angleterre", "Il serait inspiré du tire-bourre, un outil qui servait à retirer les balles coincées dans le canon des fusils."],
  ["cocotte", "Cocotte-minute", "cuisine", "♨️", "rare", 1679, "1679", "France", "Son ancêtre est le « digesteur » du Français Denis Papin, présenté à Londres en 1679."],
  ["micro-ondes", "Four à micro-ondes", "cuisine", "⚡", "rare", 1945, "1945", "États-Unis", "Inventé par hasard : l'ingénieur Percy Spencer a remarqué qu'une barre chocolatée avait fondu dans sa poche près d'un radar."],
  ["refrigerateur", "Réfrigérateur", "cuisine", "🧊", "ultra-rare", 1913, "Début du XXe siècle", "États-Unis", "Albert Einstein a lui-même déposé un brevet de réfrigérateur en 1930, avec le physicien Leó Szilárd."],
  // Maison
  ["allumette", "Allumette", "maison", "🔥", "commun", 1826, "1826", "Angleterre", "Le pharmacien anglais John Walker a inventé par hasard la première allumette à friction, en grattant un bâtonnet enduit de produits chimiques."],
  ["bougie", "Bougie", "maison", "🕯️", "commun", null, "Antiquité", "Rome et Chine", "Les Romains fabriquaient déjà des bougies en suif, une graisse animale qui fumait et sentait fort."],
  ["brosse-dents", "Brosse à dents", "maison", "🪥", "commun", 1498, "1498", "Chine", "Les premières brosses à poils, apparues en Chine à la fin du XVe siècle, étaient faites de poils de porc."],
  ["papier-toilette", "Papier toilette", "maison", "🧻", "commun", 1857, "1857", "États-Unis", "Joseph Gayetty a commercialisé le premier papier toilette en 1857 ; son nom était imprimé sur chaque feuille."],
  ["cle", "Clé et serrure", "maison", "🔑", "commun", -2000, "Il y a environ 4 000 ans", "Égypte", "Les Égyptiens utilisaient déjà des serrures en bois à goupilles, ancêtres de nos serrures modernes."],
  ["parapluie", "Parapluie", "maison", "☂️", "commun", null, "Antiquité", "Chine", "Au XVIIIe siècle, l'Anglais Jonas Hanway fut l'un des premiers hommes de Londres à oser en porter un, sous les moqueries."],
  ["miroir", "Miroir", "maison", "🪞", "rare", -6000, "Il y a environ 8 000 ans", "Anatolie", "Les premiers miroirs étaient des disques d'obsidienne, une roche volcanique noire, soigneusement polis."],
  ["aspirateur", "Aspirateur", "maison", "🧹", "rare", 1901, "1901", "Royaume-Uni", "Le premier aspirateur motorisé était si gros qu'il restait dans la rue, tiré par des chevaux : on passait les tuyaux par les fenêtres."],
  ["ampoule", "Ampoule électrique", "maison", "💡", "legendaire", 1879, "1879", "États-Unis et Royaume-Uni", "Une ampoule de caserne de pompiers, à Livermore en Californie, brille presque sans interruption depuis 1901."],
  // Bureau & école
  ["crayon", "Crayon à papier", "bureau", "✏️", "commun", 1795, "1795", "France", "Sa mine ne contient pas de plomb mais du graphite mêlé d'argile, selon le procédé du Français Nicolas-Jacques Conté."],
  ["gomme", "Gomme", "bureau", "🧽", "commun", 1770, "1770", "Angleterre", "Avant le caoutchouc, on effaçait les traits de crayon avec de la mie de pain."],
  ["trombone", "Trombone", "bureau", "📎", "commun", 1899, "Fin du XIXe siècle", "Royaume-Uni", "Le modèle à double boucle le plus répandu, le « Gem », n'a jamais été breveté."],
  ["ciseaux", "Ciseaux", "bureau", "✂️", "commun", 100, "Vers l'an 100", "Rome", "Les ciseaux à deux lames croisées, reliées par un pivot, sont attribués aux Romains."],
  ["stylo-bille", "Stylo à bille", "bureau", "🖊️", "rare", 1938, "1938", "Hongrie", "Il a été breveté par le Hongrois László Bíró ; en Argentine, on l'appelle encore une « birome »."],
  ["post-it", "Post-it", "bureau", "🗒️", "rare", 1980, "1980", "États-Unis", "Il est né d'un échec : une colle « ratée », trop faible, mise au point chez 3M en 1968."],
  ["calculatrice", "Machine à calculer", "bureau", "🧮", "rare", 1642, "1642", "France", "La Pascaline, inventée par Blaise Pascal à 19 ans, est l'une des premières machines à calculer."],
  ["papier", "Papier", "bureau", "📜", "ultra-rare", 105, "Vers 105", "Chine", "Son invention est traditionnellement attribuée à Cai Lun, un fonctionnaire de la cour impériale chinoise."],
  ["livre-imprime", "Livre imprimé", "bureau", "📖", "legendaire", 1455, "Vers 1455", "Allemagne", "La Bible de Gutenberg est l'un des premiers livres imprimés en Europe avec des caractères mobiles."],
  // Mode & soin
  ["bouton", "Bouton", "mode", "🔘", "commun", 1250, "XIIIe siècle", "Europe", "Les boutonnières ne sont apparues qu'au XIIIe siècle : avant, les boutons servaient surtout de décoration."],
  ["savon", "Savon", "mode", "🧼", "commun", -2800, "Il y a près de 5 000 ans", "Mésopotamie", "Les Babyloniens fabriquaient déjà du savon à partir de graisses et de cendres."],
  ["t-shirt", "T-shirt", "mode", "👕", "commun", 1913, "Début du XXe siècle", "États-Unis", "C'était à l'origine un sous-vêtement de la Marine américaine."],
  ["rouge-levres", "Rouge à lèvres", "mode", "💄", "commun", -3000, "Il y a environ 5 000 ans", "Mésopotamie", "Dans l'ancienne Mésopotamie, on se colorait déjà les lèvres avec des pierres précieuses broyées."],
  ["jean", "Jean", "mode", "👖", "rare", 1873, "1873", "États-Unis", "Levi Strauss et le tailleur Jacob Davis ont breveté le pantalon à rivets en 1873. Le mot « denim » viendrait de « serge de Nîmes »."],
  ["fermeture-eclair", "Fermeture éclair", "mode", "🤐", "rare", 1913, "1913", "États-Unis", "Son nom anglais, « zipper », vient d'une marque de bottes en caoutchouc des années 1920."],
  ["velcro", "Velcro", "mode", "🧷", "rare", 1955, "1955", "Suisse", "George de Mestral en a eu l'idée en observant les fruits de bardane accrochés aux poils de son chien après une promenade."],
  ["montre-bracelet", "Montre-bracelet", "mode", "⌚", "rare", 1904, "Début du XXe siècle", "France et Suisse", "Elle s'est imposée chez les hommes pendant la Première Guerre mondiale, bien plus pratique que la montre à gousset."],
  ["lunettes", "Lunettes", "mode", "👓", "ultra-rare", 1290, "Vers 1290", "Italie", "Les premières lunettes de lecture sont apparues en Italie, à la fin du XIIIe siècle."],
  // Jeux & loisirs
  ["des", "Dés", "loisirs", "🎲", "commun", -3000, "Il y a plus de 5 000 ans", "Moyen-Orient", "Sur un dé classique, les faces opposées totalisent toujours 7."],
  ["yoyo", "Yo-yo", "loisirs", "🪀", "commun", -500, "Vers 500 av. J.-C.", "Grèce", "On voit déjà un yo-yo peint sur un vase grec d'environ 500 av. J.-C."],
  ["puzzle", "Puzzle", "loisirs", "🧩", "commun", 1760, "Vers 1760", "Angleterre", "Les premiers puzzles étaient des cartes géographiques découpées, pour apprendre la géographie aux enfants."],
  ["ballon", "Ballon de football", "loisirs", "⚽", "commun", null, "XIXe siècle", "Angleterre", "Son célèbre motif noir et blanc vient du ballon de la Coupe du monde 1970, pensé pour être bien visible à la télévision en noir et blanc."],
  ["cartes", "Cartes à jouer", "loisirs", "🃏", "rare", null, "IXe siècle", "Chine", "Les quatre couleurs françaises (cœur, carreau, trèfle et pique) datent du XVe siècle."],
  ["ours-peluche", "Ours en peluche", "loisirs", "🧸", "rare", 1902, "1902", "États-Unis", "Le « teddy bear » doit son nom au président Theodore « Teddy » Roosevelt, qui refusa d'abattre un ours attaché lors d'une chasse."],
  ["echecs", "Jeu d'échecs", "loisirs", "♟️", "rare", 600, "Vers le VIe siècle", "Inde", "La dame, pièce la plus puissante, n'a pris ses pouvoirs actuels qu'à la fin du XVe siècle, en Europe."],
  ["velo", "Vélo", "loisirs", "🚲", "ultra-rare", 1817, "1817", "Allemagne", "Son ancêtre, la draisienne, n'avait pas de pédales : on avançait en poussant avec les pieds."],
  // Technologie
  ["souris", "Souris d'ordinateur", "tech", "🖱️", "rare", 1964, "1964", "États-Unis", "La première souris, imaginée par Douglas Engelbart, était un simple boîtier en bois à roulettes."],
  ["code-barres", "Code-barres", "tech", "🏷️", "rare", 1974, "1974", "États-Unis", "Le premier produit scanné en caisse, en 1974 dans l'Ohio, était un paquet de chewing-gums."],
  ["ordinateur-portable", "Ordinateur portable", "tech", "💻", "rare", 1981, "1981", "États-Unis", "L'Osborne 1, souvent cité comme le premier ordinateur portable, pesait près de 11 kg."],
  ["pile", "Pile électrique", "tech", "🔋", "ultra-rare", 1800, "1800", "Italie", "Elle a été inventée par Alessandro Volta : c'est de son nom que vient le mot « volt »."],
  ["appareil-photo", "Appareil photo", "tech", "📷", "ultra-rare", 1827, "Vers 1827", "France", "La plus ancienne photographie connue, prise par Nicéphore Niépce, a demandé des heures, voire des jours, de pose."],
  ["radio", "Radio", "tech", "📻", "ultra-rare", 1895, "1895", "Italie", "En 1901, Guglielmo Marconi a réussi la première transmission radio à travers l'océan Atlantique."],
  ["boussole", "Boussole", "tech", "🧭", "legendaire", 1050, "XIe siècle", "Chine", "Les Chinois utilisaient l'aiguille aimantée pour s'orienter dès le XIe siècle, bien avant les Européens."],
  ["telephone", "Téléphone", "tech", "☎️", "legendaire", 1876, "1876", "États-Unis", "Alexander Graham Bell a déposé son brevet le même jour qu'Elisha Gray, qui travaillait sur la même idée."],
  ["television", "Télévision", "tech", "📺", "legendaire", 1926, "1926", "Royaume-Uni", "L'Écossais John Logie Baird a présenté au public la première télévision fonctionnelle en 1926."],
  ["smartphone", "Smartphone", "tech", "📱", "legendaire", 1994, "1994", "États-Unis", "L'IBM Simon, sorti en 1994, est souvent considéré comme le premier smartphone : il avait déjà un écran tactile."],
];

// [id, nom, emoji, condition, anecdote]
const SECRETES_OBJETS = [
  ["sandwich", "Le comte de Sandwich", "🥪", "categorie:cuisine", "Le sandwich porte le nom de John Montagu, 4e comte de Sandwich, au XVIIIe siècle. Selon la légende, il ne voulait pas quitter sa table de jeu pour manger."],
  ["lampe-aladin", "La lampe d'Aladin", "🪔", "categorie:maison", "Le conte d'Aladin ne figure dans aucun manuscrit arabe connu des Mille et Une Nuits : il a été ajouté au XVIIIe siècle par le traducteur français Antoine Galland."],
  ["rosette", "La pierre de Rosette", "🪨", "categorie:bureau", "Découverte en Égypte en 1799, elle porte le même texte en trois écritures. Elle a permis à Champollion de déchiffrer les hiéroglyphes en 1822."],
  ["pantoufle-verre", "La pantoufle de verre", "👠", "categorie:mode", "Certains pensent que Perrault parlait de « vair », une fourrure. Pourtant, dans son conte de 1697, il a bien écrit « verre »."],
  ["jeu-ur", "Le jeu royal d'Ur", "🏺", "categorie:loisirs", "L'un des plus vieux jeux de société connus, vieux d'environ 4 500 ans. Ses règles ont été retrouvées sur une tablette babylonienne."],
  ["anticythere", "Le mécanisme d'Anticythère", "⚙️", "categorie:tech", "Retrouvé en 1901 dans une épave grecque, cet engrenage de bronze vieux de plus de 2 000 ans calculait la position des astres. On le surnomme le premier ordinateur."],
  ["disque-or", "Le Disque d'or de Voyager", "💿", "tous-les-objets", "Lancé dans l'espace en 1977 à bord des sondes Voyager, il contient des sons, des images et de la musique de la Terre, destinés à d'éventuels extraterrestres."],
];
