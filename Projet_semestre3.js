console.log("Le fichier Projet_semestre3.js est chargé.");

/*************************************************************
 * Variables globales
 *************************************************************/
let boat = { x: 0, y: 0, image: null };
let canvas, ctx;

// Îles, Points, etc.
let islands = [];
let pointA = null;
let pointB = null;
let mapGenerated = false;

// Timer
let timeRemaining = 120;   // 2 minutes
let timerInterval = null;

// Indices & trésor (optionnel si tu utilises la version "trésor caché")
let clues = [];
let cluesCollected = 0;
let neededClues = 0;
let treasure = null;
let treasureCollected = false;

// >>> Bateaux adverses
let enemyShips = [];       // Tableau de bateaux adverses
let enemyInterval = null;  // Interval pour leur déplacement automatique

/*************************************************************
 * Fonctions principales
 *************************************************************/

/**
 * 1) Génère la carte (mer + îles + points A/B + ennemis) et place le bateau
 */
function creation_map() {
    canvas = document.getElementById("mapCanvas");
    ctx = canvas.getContext("2d");

    // Couleurs pour les éléments
    const waterColor = "#87CEEB"; 
    const sandColor  = "#F4A460"; 
    const landColor  = "#228B22"; 
    const pointColor = "#FF0000"; 

    const width = canvas.width;
    const height = canvas.height;
    const diagonal = Math.sqrt(width ** 2 + height ** 2);

    // 1. Nettoyer/dessiner la mer
    ctx.fillStyle = waterColor;
    ctx.fillRect(0, 0, width, height);

    // 2. Générer des îles
    islands = [];
    const islandCount = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < islandCount; i++) {
        let island;
        let attempts = 0;
        do {
            island = generateIsland(width, height);
            attempts++;
        } while (
            islands.some(existing => isOverlapping(island, existing)) &&
            attempts < 10
        );
        if (attempts < 10) {
            islands.push(island);
        }
    }
    islands.forEach(island => drawIsland(ctx, island, sandColor, landColor));

    // 3. Points A et B
    do {
        pointA = generatePointInWater(width, height, islands);
        pointB = generatePointInWater(width, height, islands);
    } while (distanceBetweenPoints(pointA, pointB) < (3 / 4) * diagonal);

    drawPoint(ctx, pointA, "Départ", pointColor);
    drawPoint(ctx, pointB, "Arrivée", pointColor);

    // 4. Placer le bateau (joueur) sur A
    boat.x = pointA.x;
    boat.y = pointA.y;
    boat.image = new Image();
    boat.image.src = "bateaupirate.png"; // <-- IMAGE DU JOUEUR (inchangée)
    boat.image.onload = () => {
        drawBoat();
    };

    // (Indices + trésor si tu utilises la version puzzle)
    initCluesAndTreasure(width, height);

    // 5. Générer les bateaux adverses
    generateEnemyShips(width, height);

    // Démarrer leur déplacement automatique
    if (enemyInterval) clearInterval(enemyInterval);
    enemyInterval = setInterval(() => {
        moveEnemies();
        redrawAll();
    }, 200);

    mapGenerated = true;
}

/**
 * 2) Lance le timer de 2 minutes
 */
function startTimer() {
    timeRemaining = 120;
    updateTimerDisplay(timeRemaining);

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timeRemaining--;
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert("Temps écoulé ! Vous avez perdu !");
            mapGenerated = false;
        } else {
            updateTimerDisplay(timeRemaining);
        }
    }, 1000);
}

/**
 * 3) Gère le déplacement du bateau joueur au clavier
 */
function moveBoat(e) {
    if (!mapGenerated) return;

    const speed = 10;
    const oldX = boat.x;
    const oldY = boat.y;

    // Contrôles
    if (e.key === "ArrowUp") {
        boat.y -= speed;
    } else if (e.key === "ArrowDown") {
        boat.y += speed;
    } else if (e.key === "ArrowLeft") {
        boat.x -= speed;
    } else if (e.key === "ArrowRight") {
        boat.x += speed;
    }

    // Limites
    if (boat.x < 0) boat.x = 0;
    if (boat.y < 0) boat.y = 0;
    if (boat.x > canvas.width)  boat.x = canvas.width;
    if (boat.y > canvas.height) boat.y = canvas.height;

    // Collision île ?
    if (isBoatOnIsland(boat.x, boat.y, islands)) {
        boat.x = oldX;
        boat.y = oldY;
    }

    // (Indices/puzzle) vérifier indice
    checkCluesCollision();

    // (Si trésor) révéler/récupérer
    checkTreasureCollision();

    // Vérifier si on a gagné (si version puzzle)
    checkVictory();

    redrawAll();
}

/**
 * 4) Redessine tout (mer, îles, points, indices, trésor, bateau joueur, bateaux adverses)
 */
function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mer
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Îles
    islands.forEach(island => drawIsland(ctx, island, "#F4A460", "#228B22"));

    // Points A et B
    drawPoint(ctx, pointA, "Départ", "#FF0000");
    drawPoint(ctx, pointB, "Arrivée", "#FF0000");

    // (Indices + trésor si puzzle)
    redrawCluesAndTreasure();

    // Bateau Joueur
    drawBoat();

    // Bateaux Adverses
    drawEnemies();
}

/*************************************************************
 * Bateaux Adverses
 *************************************************************/

/**
 * Génère entre 5 et 15 bateaux adverses.
 * Parmi eux, 1 à 3 seront des "chasseurs" (poursuivent le joueur).
 */
function generateEnemyShips(width, height) {
    enemyShips = [];

    const nbEnemies = Math.floor(Math.random() * 11) + 5; // de 5 à 15
    // Déterminer le nombre de chasseurs (2 à 4)
    const nbChasers = Math.floor(Math.random() * 3) + 2;  // de 2 à 4
    let chasersAssigned = 0;

    for (let i = 0; i < nbEnemies; i++) {
        let pos = generatePointInWater(width, height, islands);
        let newEnemy = {
            x: pos.x,
            y: pos.y,
            image: new Image(),
            size: 30,
            speed: 2,                     // vitesse par défaut
            direction: Math.random() * 2 * Math.PI,
            isChaser: false               // par défaut, pas chasseur
        };
        newEnemy.image.src = "anglais.jpeg";

        enemyShips.push(newEnemy);
    }

    // Sélection aléatoire de 1 à 3 chasseurs
    let effectiveChasers = Math.min(nbChasers, enemyShips.length);

    for (let c = 0; c < effectiveChasers; c++) {
        let index = Math.floor(Math.random() * enemyShips.length);
        let chosen = enemyShips[index];
        if (!chosen.isChaser) {
            chosen.isChaser = true;
            chosen.speed = 1.5; // vitesse plus lente pour le chasseur
        } else {
            c--;
        }
    }
}

/**
 * Déplace chaque bateau adverse.
 * Si on rentre en collision avec le bateau du joueur => Défaite
 */
function moveEnemies() {
    if (!mapGenerated) return;

    enemyShips.forEach(ship => {
        const oldX = ship.x;
        const oldY = ship.y;

        if (ship.isChaser) {
            // LOGIQUE DE POURSUITE
            let dx = boat.x - ship.x;
            let dy = boat.y - ship.y;
            let angle = Math.atan2(dy, dx);
            ship.x += Math.cos(angle) * ship.speed;
            ship.y += Math.sin(angle) * ship.speed;
        } else {
            // LOGIQUE ALÉATOIRE
            if (Math.random() < 0.02) {
                ship.direction = Math.random() * 2 * Math.PI;
            }
            ship.x += Math.cos(ship.direction) * ship.speed;
            ship.y += Math.sin(ship.direction) * ship.speed;
        }

        // Vérifier limites du canvas
        if (ship.x < 0) {
            ship.x = 0;
            ship.direction = Math.random() * 2 * Math.PI;
        }
        if (ship.x > canvas.width) {
            ship.x = canvas.width;
            ship.direction = Math.random() * 2 * Math.PI;
        }
        if (ship.y < 0) {
            ship.y = 0;
            ship.direction = Math.random() * 2 * Math.PI;
        }
        if (ship.y > canvas.height) {
            ship.y = canvas.height;
            ship.direction = Math.random() * 2 * Math.PI;
        }

        // Empêcher de monter sur les îles
        if (isBoatOnIsland(ship.x, ship.y, islands)) {
            ship.x = oldX;
            ship.y = oldY;
            ship.direction = Math.random() * 2 * Math.PI;
        }

        // Collision avec le joueur
        let dist = distanceBetweenPoints({ x: ship.x, y: ship.y }, { x: boat.x, y: boat.y });
        if (dist < 30) {
            clearInterval(timerInterval);
            clearInterval(enemyInterval);
            alert("Un navire ennemi vous a abordé ! Partie perdue.");
            mapGenerated = false;
        }
    });
}

/**
 * Dessine tous les bateaux adverses
 */
function drawEnemies() {
    enemyShips.forEach(ship => {
        if (ship.image && ship.image.complete) {
            ctx.drawImage(ship.image, ship.x - ship.size/2, ship.y - ship.size/2, ship.size, ship.size);
        } else {
            // Dessin de secours
            ctx.beginPath();
            ctx.arc(ship.x, ship.y, ship.size/2, 0, 2 * Math.PI);
            ctx.fillStyle = "red";
            ctx.fill();
        }
    });
}

/*************************************************************
 * Indices + Trésor (Optionnel si tu utilises la version puzzle)
 *************************************************************/

/**
 * Initialise indices et trésor
 */
function initCluesAndTreasure(width, height) {
    // Ex. 3 à 5 indices
    neededClues = Math.floor(Math.random() * 3) + 3; 
    clues = [];
    cluesCollected = 0;

    for (let i = 0; i < neededClues; i++) {
        let cluePoint = generatePointInWater(width, height, islands);
        const puzzleData = createRandomPuzzle(); 
        clues.push({
            x: cluePoint.x,
            y: cluePoint.y,
            isCollected: false,
            puzzle: puzzleData.puzzle,
            answer: puzzleData.answer
        });
    }

    // Pas de trésor révélé au début
    treasure = { x: 0, y: 0, found: false };
    treasureCollected = false;
}

/**
 * Vérifie si le bateau récupère un indice
 */
function checkCluesCollision() {
    clues.forEach(clue => {
        if (!clue.isCollected) {
            let d = distanceBetweenPoints({ x: boat.x, y: boat.y }, { x: clue.x, y: clue.y });
            if (d < 20) {
                askPuzzle(clue);
            }
        }
    });
}

/**
 * Vérifie s'il faut révéler / récupérer le trésor
 */
function checkTreasureCollision() {
    // Révéler le trésor quand tous les indices sont collectés
    if (!treasure.found && cluesCollected === neededClues) {
        let pos = generatePointInWater(canvas.width, canvas.height, islands);
        treasure.x = pos.x;
        treasure.y = pos.y;
        treasure.found = true;
    }

    // Si trésor révélé et pas encore récupéré, vérifier collision
    if (treasure.found && !treasureCollected) {
        let dist = distanceBetweenPoints({ x: boat.x, y: boat.y }, treasure);
        if (dist < 20) {
            alert("Vous avez récupéré le trésor ! Rendez-vous maintenant au point Arrivé pour gagner.");
            treasureCollected = true;
        }
    }
}

/**
 * Vérifie la victoire (trésor et point B)
 */
function checkVictory() {
    if (treasureCollected) {
        // Si on a le trésor et qu'on touche B => victoire
        let d = distanceBetweenPoints({ x: boat.x, y: boat.y }, pointB);
        if (d < 20) {
            alert("Victoire ! Vous avez le trésor et êtes arrivé.");
            clearInterval(timerInterval);
            clearInterval(enemyInterval);
            mapGenerated = false;
        }
    }
}

/**
 * Redessine indices et trésor
 */
function redrawCluesAndTreasure() {
    // Indices
    clues.forEach((clue, idx) => {
        if (!clue.isCollected) {
            drawPoint(ctx, { x: clue.x, y: clue.y }, "Indice" + (idx+1), "#FFD700");
        }
    });

    // Trésor
    if (treasure.found && !treasureCollected) {
        drawPoint(ctx, { x: treasure.x, y: treasure.y }, "Trésor", "#00FFFF");
    }
}

/**
 * Pose l'énigme pour l'indice
 */
function askPuzzle(clue) {
    // 1) Mesurer le temps de départ
    const startPrompt = Date.now();

    // 2) Afficher le prompt bloquant
    const userAnswer = prompt("Indice trouvé ! " + clue.puzzle);
    
    // 3) Calculer le temps écoulé
    const endPrompt = Date.now();
    const diffMs = endPrompt - startPrompt;      // en millisecondes
    const diffSec = Math.round(diffMs / 1000);   // on convertit en secondes
    
    // 4) Soustraire du timer
    timeRemaining -= diffSec;
    if (timeRemaining < 0) timeRemaining = 0;

    // Mettre à jour l’affichage
    updateTimerDisplay(timeRemaining);
    
    // Vérifier si on a déjà perdu (si on est à 0)
    if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        alert("Temps écoulé ! Vous avez perdu !");
        mapGenerated = false;
        return; // on arrête ici
    }

    // 5) Gérer la réponse
    if (userAnswer === null) return; // annulé

    // Comparaison
    const formattedUserAnswer = userAnswer.trim().toLowerCase();
    const formattedCorrect = String(clue.answer).trim().toLowerCase();

    if (formattedUserAnswer === formattedCorrect) {
        alert("Bonne réponse ! Indice récupéré.");
        clue.isCollected = true;
        cluesCollected++;
    } else {
        alert("Mauvaise réponse...");
    }
}


/**
 * Génère un puzzle à partir d’un tableau de questions plus complexes
 */
function createRandomPuzzle() {
    // Liste de questions plus variées (math + C)
    const questionPool = [
        // Questions math un peu plus complexes
        { puzzle: "Combien font (2^3) + 4 ?", answer: "12" },
        { puzzle: "Calcule : 7*(6+3) -4 ?", answer: "59" },
        { puzzle: "Quelle est la racine carrée de 49 ?", answer: "7" },
        { puzzle: "3^3 - 1 = ?", answer: "26" },
        { puzzle: "Combien font 8 * 7 ?", answer: "56" },
        // 1
        { puzzle: "Combien font (2^3) + (3^2) ?", answer: "17" },
        // 2
        { puzzle: "Calcule : (5 * 6) - (8 / 2) ?", answer: "26" },
        // 3
        { puzzle: "Quelle est la racine carrée de 144 ?", answer: "12" },
        // 4
        { puzzle: "Combien font 3^(2 + 1) ?", answer: "27" },
        // 5
        { puzzle: "Calcule : 15 - (2 * 5) + 1 ?", answer: "6" },
        // 6
        { puzzle: "Combien font (7 * 9) - (2^3) ?", answer: "55" },
        // 7
        { puzzle: "Résous : 2^5 + 2^3 ?", answer: "40" },
        // 8
        { puzzle: "Quelle est la racine carrée de 225 ?", answer: "15" },
        // 9
        { puzzle: "Calcule : (10 * 10) - (6 + 4) ?", answer: "90" },
        // 10
        { puzzle: "Combien font (8 * 8) - (3^3) ?", answer: "55" },
        // 11
        { puzzle: "Combien font (2^4) * 2 ?", answer: "32" },
        // 12
        { puzzle: "Calcule : (9 + 7) * (4 - 2) ?", answer: "32" },
        // 13
        { puzzle: "3^4 = ? (en chiffre)", answer: "81" },
        // 14
        { puzzle: "Résous : 2 * (3 + 7) - 5 ?", answer: "15" },
        // 15
        { puzzle: "Combien font 6! (factorielle) ?", answer: "720" },
        // 16
        { puzzle: "Calcule : (8 * 7) - (10 / 5) ?", answer: "54" },
        // 17
        { puzzle: "Quelle est la racine carrée de 361 ?", answer: "19" },
        // 18
        { puzzle: "Résous : 4^3 - (3 * 3) ?", answer: "52" },
        // 19
        { puzzle: "Combien font (10 * 10) + (2^5) ?", answer: "132" },
        // 20
        { puzzle: "Résous : (5^2) + (6 * 2) ?", answer: "37" },
        // 21
        { puzzle: "Calcule : (11 * 3) - (2^3) ?", answer: "25" },
        // 22
        { puzzle: "Quelle est la racine carrée de 400 ?", answer: "20" },
        // 23
        { puzzle: "Combien font (2^5) + (2^4) ?", answer: "48" },
        // 24
        { puzzle: "Résous : (7 + 9) * (8 - 7) ?", answer: "16" },
        // 25
        { puzzle: "Combien font (3^3) + (4^2) ?", answer: "43" },
        // 26
        { puzzle: "Calcule : (9 / 3) + (5 * 4) ?", answer: "23" },
        // 27
        { puzzle: "Quelle est la racine carrée de 100 ?", answer: "10" },
        // 28
        { puzzle: "Combien font 5^(1 + 1) ?", answer: "25" },
        // 29
        { puzzle: "Résous : (12 - 4) * (2 + 1) ?", answer: "24" },
        // 30
        { puzzle: "Combien font 8 * (3 + 4) - 5 ?", answer: "51" },
        // 31
        { puzzle: "Calcule : (2^2) + (2^3) + (2^4) ?", answer: "28" },
        // 32
        { puzzle: "Combien font 3^2 + 5^2 ?", answer: "34" },
        // 33
        { puzzle: "Résous : (10 - 2) * 2 + 5 ?", answer: "21" },
        // 34
        { puzzle: "Combien font (6^2) - (4^2) ?", answer: "20" },
        // 35
        { puzzle: "Calcule : (9 - 4) * (8 + 1) ?", answer: "45" },
        // 36
        { puzzle: "Combien font (2 * 3)^(2) ?", answer: "36" },
        // 37
        { puzzle: "Résous : 100 - (2^5) ?", answer: "68" },
        // 38
        { puzzle: "Calcule : (7 + 3) * (7 - 2) ?", answer: "50" },
        // 39
        { puzzle: "Combien font 9! / (9 - 1)! ?", answer: "9" }, // 9! / 8! = 9
        // 40
        { puzzle: "Résous : (4^3) - (3^2) ?", answer: "55" },
        // 41
        { puzzle: "Combien font (5 * 5) + 2^4 ?", answer: "41" },
        // 42
        { puzzle: "Calcule : (10 + 2) * (3 + 1) ?", answer: "48" },
        // 43
        { puzzle: "Quelle est la racine carrée de 625 ?", answer: "25" },
        // 44
        { puzzle: "Combien font (3^2) + (3 * 2) ?", answer: "15" },
        // 45
        { puzzle: "Résous : (8 + 8) / (2^3) ?", answer: "2" },
        // 46
        { puzzle: "Calcule : 4! - 3! ?", answer: "18" }, // 4! = 24, 3! = 6, 24 - 6 = 18
        // 47
        { puzzle: "Combien font (6 + 2)^2 ?", answer: "64" },
        // 48
        { puzzle: "Résous : (5^3) - (3^3) ?", answer: "92" }, // 125 - 27
        // 49
        { puzzle: "Calcule : (7 + 8) * (7 - 5) ?", answer: "30" },
        // 50
        { puzzle: "Combien font (10^2) - (9^2) ?", answer: "19" },

        // Questions C
        { puzzle: "En C, 'calloc' initialise-t-il la zone mémoire à zéro ? (o/n)", answer: "o" },
        { puzzle: "Quelle bibliothèque inclure pour 'malloc' ?", answer: "stdlib.h" },
        { puzzle: "Le type 'char *' stocke-t-il une adresse mémoire ? (o/n)", answer: "o" },
        { puzzle: "En C, peut-on écrire 'int main(void)' ? (o/n)", answer: "o" },
        { puzzle: "La fonction 'printf' se trouve dans quelle bibliothèque ?", answer: "stdio.h" },
        // 51
        { puzzle: "En C, 'calloc' initialise-t-il la zone mémoire à zéro ? (o/n)", answer: "o" },
        // 52
        { puzzle: "Quelle bibliothèque inclure pour 'malloc' ?", answer: "stdlib.h" },
        // 53
        { puzzle: "Le type 'char *' stocke-t-il une adresse mémoire ? (o/n)", answer: "o" },
        // 54
        { puzzle: "En C, peut-on écrire 'int main(void)' ? (o/n)", answer: "o" },
        // 55
        { puzzle: "La fonction 'printf' se trouve dans quelle bibliothèque ?", answer: "stdio.h" },
        // 56
        { puzzle: "Quel est le format spécificateur pour un entier en C ?", answer: "%d" },
        // 57
        { puzzle: "Le mot-clé 'static' limite-t-il la portée d'une variable au fichier courant ? (o/n)", answer: "o" },
        // 58
        { puzzle: "Quelle est la bibliothèque à inclure pour utiliser 'strcpy' ?", answer: "string.h" },
        // 59
        { puzzle: "Le mot-clé 'extern' sert-il à déclarer une variable définie ailleurs ? (o/n)", answer: "o" },
        // 60
        { puzzle: "Peut-on utiliser '&&' et '||' en C pour les opérations logiques ? (o/n)", answer: "o" },
        // 61
        { puzzle: "À quoi sert '#define' en C ?", answer: "macro" },
        // 62
        { puzzle: "Quel opérateur permet d'obtenir l'adresse d'une variable en C ?", answer: "&" },
        // 63
        { puzzle: "Dans 'scanf(\"%d\", &x)', pourquoi met-on '&x' ?", answer: "adresse" },
        // 64
        { puzzle: "Le type 'unsigned int' peut-il stocker des valeurs négatives ? (o/n)", answer: "n" },
        // 65
        { puzzle: "Comment s'appelle le fichier binaire généré après compilation en C sous Linux ? (par défaut)", answer: "a.out" },
        // 66
        { puzzle: "Quelle est l'extension habituelle des fichiers source C ?", answer: ".c" },
        // 67
        { puzzle: "Quelle est l'extension habituelle des fichiers d'en-tête C ?", answer: ".h" },
        // 68
        { puzzle: "Le mot-clé 'typedef' peut-il renommer un type existant ? (o/n)", answer: "o" },
        // 69
        { puzzle: "Que signifie 'EOF' ?", answer: "end of file" },
        // 70
        { puzzle: "En C, la fonction 'free' libère-t-elle la mémoire allouée dynamiquement ? (o/n)", answer: "o" },
        // 71
        { puzzle: "La directive '#pragma once' sert-elle à éviter les inclusions multiples ? (o/n)", answer: "o" },
        // 72
        { puzzle: "La structure 'struct' permet-elle de regrouper plusieurs variables sous un même nom ? (o/n)", answer: "o" },
        // 73
        { puzzle: "La boucle 'for(;;)' est-elle un équivalent d'une boucle while(1) ? (o/n)", answer: "o" },
        // 74
        { puzzle: "Le mot-clé 'break' interrompt-il la boucle la plus interne ? (o/n)", answer: "o" },
        // 75
        { puzzle: "Le mot-clé 'continue' saute-t-il la fin de l'itération courante ? (o/n)", answer: "o" },
        // 76
        { puzzle: "En C, les chaînes de caractères se terminent-elles par '\\0' ? (o/n)", answer: "o" },
        // 77
        { puzzle: "Peut-on compiler du C avec 'gcc' ? (o/n)", answer: "o" },
        // 78
        { puzzle: "Le mot-clé 'const' indique-t-il qu'une variable est constante ? (o/n)", answer: "o" },
        // 79
        { puzzle: "En C, 'printf(\"%f\", 3)' affiche-t-il un entier ou un flottant ? (entier/flottant)", answer: "flottant" },
        // 80
        { puzzle: "Quel mot-clé est utilisé pour définir une énumération en C ?", answer: "enum" },
        // 81
        { puzzle: "En C, 'if( x = 0 )' vérifie-t-il la valeur ou fait-il une affectation ?", answer: "affectation" },
        // 82
        { puzzle: "Le 'return 0;' dans le main signifie-t-il un succès d'exécution ? (o/n)", answer: "o" },
        // 83
        { puzzle: "La taille d'un 'int' est-elle toujours 4 octets (o/n)", answer: "n" },  
        // 84
        { puzzle: "Dans un tableau C 'int tab[5];', 'tab[0]' est le 1er élément ? (o/n)", answer: "o" },
        // 85
        { puzzle: "La fonction 'fopen' se trouve dans quelle bibliothèque ?", answer: "stdio.h" },
        // 86
        { puzzle: "Le mot-clé 'volatile' empêche-t-il certaines optimisations du compilateur ? (o/n)", answer: "o" },
        // 87
        { puzzle: "Pour allouer un tableau de 10 int en C, utilise-t-on 'malloc(10 * sizeof(int))' ? (o/n)", answer: "o" },
        // 88
        { puzzle: "Un pointeur NULL vaut généralement 0 ? (o/n)", answer: "o" },
        // 89
        { puzzle: "Le type 'double' a-t-il en général plus de précision que 'float' ? (o/n)", answer: "o" },
        // 90
        { puzzle: "Les commentaires multi-lignes en C commencent par '/*' et finissent par '*/' ? (o/n)", answer: "o" },
        // 91
        { puzzle: "Le compilateur 'clang' peut-il compiler du C ? (o/n)", answer: "o" },
        // 92
        { puzzle: "Lequel est correct ? 'int x[5];' ou 'int x(5);' pour déclarer un tableau ?", answer: "int x[5];" },
        // 93
        { puzzle: "Le macro 'offsetof' sert-elle à donner l'offset d'un champ dans une struct ? (o/n)", answer: "o" },
        // 94
        { puzzle: "La boucle 'do { ... } while();' exécute-t-elle le bloc au moins une fois ? (o/n)", answer: "o" },
        // 95
        { puzzle: "Est-il permis d'écrire 'float *p;' en C ? (o/n)", answer: "o" },
        // 96
        { puzzle: "La fonction 'feof' indique-t-elle si on a atteint la fin du fichier ? (o/n)", answer: "o" },
        // 97
        { puzzle: "En C, la division de 3 par 2 en int donne 1.5 ? (o/n)", answer: "n" },  
        // 98
        { puzzle: "Le compilateur C se fiche des espaces et des retours à la ligne (o/n)", answer: "o" },
        // 99
        { puzzle: "La directive '#include <...' sert-elle à inclure un fichier d'en-tête ? (o/n)", answer: "o" },
        // 100
        { puzzle: "La fonction 'strcat' concatène-t-elle deux chaînes ? (o/n)", answer: "o" },
    ];

    // On pioche aléatoirement
    const index = Math.floor(Math.random() * questionPool.length);
    const chosen = questionPool[index];

    return {
        puzzle: chosen.puzzle,
        answer: chosen.answer
    };
}

/*************************************************************
 * Fonctions utilitaires
 *************************************************************/

/** Dessine le bateau du joueur */
function drawBoat() {
    if (boat.image && boat.image.complete) {
        ctx.drawImage(boat.image, boat.x - 15, boat.y - 15, 30, 30);
    } else {
        // Dessin de secours
        ctx.beginPath();
        ctx.arc(boat.x, boat.y, 15, 0, 2*Math.PI);
        ctx.fillStyle = "blue";
        ctx.fill();
    }
}

/** Vérifie collision bateau/île */
function isBoatOnIsland(x, y, islands) {
    return islands.some(island => {
        const dist = distanceBetweenPoints({ x, y }, { x: island.centerX, y: island.centerY });
        return dist < island.radius;
    });
}

/** Génère une île polygonale */
function generateIsland(canvasWidth, canvasHeight) {
    const centerX = Math.random() * canvasWidth;
    const centerY = Math.random() * canvasHeight;
    const radius = Math.random() * 80 + 60;
    const points = 8 + Math.floor(Math.random() * 5);
    const shape = [];

    for (let i = 0; i < points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const dist = radius + (Math.random() * 30 - 15);
        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;

        shape.push({
            x: Math.max(0, Math.min(canvasWidth, x)),
            y: Math.max(0, Math.min(canvasHeight, y))
        });
    }
    return { centerX, centerY, radius, shape };
}

/** Vérifie si 2 îles se chevauchent */
function isOverlapping(island1, island2) {
    const dist = distanceBetweenPoints(
        { x: island1.centerX, y: island1.centerY },
        { x: island2.centerX, y: island2.centerY }
    );
    return dist < island1.radius + island2.radius;
}

/** Vérifie si un point est sur une île */
function isPointInIsland(point, islands) {
    return islands.some(island => {
        const dist = distanceBetweenPoints(point, { x: island.centerX, y: island.centerY });
        return dist < island.radius;
    });
}

/** Génère un point dans l'eau */
function generatePointInWater(canvasWidth, canvasHeight, islands) {
    let p;
    do {
        p = {
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight
        };
    } while (isPointInIsland(p, islands));
    return p;
}

/** Distance euclidienne */
function distanceBetweenPoints(a, b) {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/** Dessine une île (sable + forêt) */
function drawIsland(ctx, island, sandColor, landColor) {
    const { shape } = island;

    // Couche sable
    ctx.beginPath();
    ctx.moveTo(shape[0].x, shape[0].y);
    shape.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.closePath();
    ctx.fillStyle = sandColor;
    ctx.fill();

    // Couche terre/forêt
    const innerShape = shape.map(pt => ({
        x: island.centerX + (pt.x - island.centerX) * 0.8,
        y: island.centerY + (pt.y - island.centerY) * 0.8
    }));
    ctx.beginPath();
    ctx.moveTo(innerShape[0].x, innerShape[0].y);
    innerShape.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.closePath();
    ctx.fillStyle = landColor;
    ctx.fill();
}

/** Dessine un point */
function drawPoint(ctx, point, label, color) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, 2*Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.font = "bold 14px Arial";
    ctx.fillText(label, point.x + 8, point.y + 5);
}

/** Met à jour l'affichage du timer */
function updateTimerDisplay(sec) {
    const timerEl = document.getElementById("timer");
    if (!timerEl) return;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    timerEl.textContent = `Temps restant : ${m}:${s < 10 ? "0"+s : s}`;
}

/*************************************************************
 * Événements
 *************************************************************/
document.getElementById("generateButton").addEventListener("click", () => {
    creation_map();
    startTimer(); 
});

document.addEventListener("keydown", moveBoat);
