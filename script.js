const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Game constants
const MAX_TRAIL_LENGTH = 500;
const COLLISION_RADIUS = 8;
const GRID_SIZE = 40;

// Game state
let gameState = 'menu'; // menu, playing, paused, gameover
let player;
let opponents = [];
let trails = {}; // player and opponent trails
let direction;
let nextDirection;
let speed;
let baseSpeed;
let score;
let highScore = 0;
let boostActive = false;
let boostTimer = 0;
let particles = [];
let animationId;
let opponentCount = 2;

// Sound system
let audioContext;
let masterVolume = 0.3;

function initSound() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio API not supported');
    }
}

function playSound(frequency, duration, type = 'sine', volume = 0.1) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume * masterVolume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playEngineSound() {
    playSound(80, 0.1, 'sawtooth', 0.05);
}

function playBoostSound() {
    playSound(200, 0.3, 'square', 0.15);
}

function playCollisionSound() {
    playSound(150, 0.4, 'sawtooth', 0.2);
    setTimeout(() => playSound(100, 0.2, 'square', 0.15), 100);
}

function playGameOverSound() {
    playSound(300, 0.2, 'square', 0.2);
    setTimeout(() => playSound(200, 0.2, 'square', 0.2), 200);
    setTimeout(() => playSound(100, 0.3, 'square', 0.2), 400);
}

// Canvas setup
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 120;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
initSound();

function startGame() {
    gameState = 'playing';
    
    player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        color: '#00ffff',
        trailColor: '#00cccc',
        alive: true
    };
    
    // Initialize opponents
    opponents = [];
    const colors = ['#ff00ff', '#ffff00', '#ff8800', '#00ff00'];
    for (let i = 0; i < opponentCount; i++) {
        const angle = (Math.PI * 2 * i) / opponentCount;
        const distance = Math.min(canvas.width, canvas.height) * 0.3;
        opponents.push({
            x: canvas.width / 2 + Math.cos(angle) * distance,
            y: canvas.height / 2 + Math.sin(angle) * distance,
            color: colors[i % colors.length],
            trailColor: colors[i % colors.length] + '88',
            direction: ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)],
            nextDirection: null,
            alive: true,
            aiTimer: 0,
            speed: baseSpeed * 0.8 // AI slightly slower
        });
    }
    
    trails = {
        player: [],
        opponents: opponents.map(() => [])
    };
    
    direction = "right";
    nextDirection = "right";
    baseSpeed = 4;
    speed = baseSpeed;
    score = 0;
    boostActive = false;
    boostTimer = 0;
    particles = [];
    
    // Update UI
    document.getElementById("menu").style.display = "none";
    document.getElementById("gameOver").style.display = "none";
    document.getElementById("score").innerText = "Score: 0";
    document.getElementById("highScore").innerText = "High Score: " + highScore;
    
    gameLoop();
}

function restartGame(){
    startGame();
}

function setDirection(dir) {
    if (gameState !== 'playing') return;
    
    // Prevent 180-degree turns
    const opposites = {
        'up': 'down',
        'down': 'up',
        'left': 'right',
        'right': 'left'
    };
    
    if (opposites[dir] !== direction) {
        nextDirection = dir;
    }
}

function boost() {
    if (gameState !== 'playing' || boostActive) return;
    
    boostActive = true;
    speed = baseSpeed * 2;
    boostTimer = 60; // 1 second at 60fps
    
    playBoostSound();
    
    // Create boost particles
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: player.x,
            y: player.y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 30,
            color: '#ffff00'
        });
    }
}

function gameLoop() {
    if (gameState !== 'playing') {
        cancelAnimationFrame(animationId);
        return;
    }
    
    animationId = requestAnimationFrame(gameLoop);

    ctx.fillStyle="rgba(0,0,0,0.2)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    drawGrid();

    // Update boost
    if (boostActive) {
        boostTimer--;
        if (boostTimer <= 0) {
            boostActive = false;
            speed = baseSpeed;
        }
    }
    
    // Update direction at grid boundaries for smoother turns
    if (Math.floor(player.x / GRID_SIZE) !== Math.floor((player.x + (direction === 'right' ? speed : direction === 'left' ? -speed : 0)) / GRID_SIZE) ||
        Math.floor(player.y / GRID_SIZE) !== Math.floor((player.y + (direction === 'down' ? speed : direction === 'up' ? -speed : 0)) / GRID_SIZE)) {
        direction = nextDirection;
    }
    
    // Update opponents
    updateOpponents();
    
    // Move player
    if (player.alive) {
        movePlayer();
        trails.player.push({ x: player.x, y: player.y });
        
        // Limit trail length
        if (trails.player.length > MAX_TRAIL_LENGTH) {
            trails.player.shift();
        }
    }
    
    // Move opponents
    opponents.forEach((opponent, index) => {
        if (opponent.alive) {
            moveOpponent(opponent);
            trails.opponents[index].push({ x: opponent.x, y: opponent.y });
            
            if (trails.opponents[index].length > MAX_TRAIL_LENGTH) {
                trails.opponents[index].shift();
            }
        }
    });
    
    // Update particles
    updateParticles();

    // Draw all trails
    drawTrail(trails.player, player.trailColor);
    
    opponents.forEach((opponent, index) => {
        if (opponent.alive) {
            drawTrail(trails.opponents[index], opponent.trailColor);
        }
    });
    
    // Draw all players
    if (player.alive) {
        drawPlayer(player);
    }
    
    opponents.forEach(opponent => {
        if (opponent.alive) {
            drawPlayer(opponent);
        }
    });
    
    // Draw particles
    drawParticles();
    
    // Update score display
    if (player.alive) {
        score++;
        document.getElementById("score").innerText = "Score: " + score;
        document.getElementById("highScore").innerText = "High Score: " + highScore;
        
        // Play engine sound occasionally
        if (score % 30 === 0) {
            playEngineSound();
        }
    }
    
    checkCollisions();
}

function movePlayer() {
    switch (direction) {
        case "up":
            player.y -= speed;
            break;
        case "down":
            player.y += speed;
            break;
        case "left":
            player.x -= speed;
            break;
        case "right":
            player.x += speed;
            break;
    }
}

function updateOpponents() {
    opponents.forEach((opponent, index) => {
        if (!opponent.alive) return;
        
        // Simple AI: change direction every 10 frames
        opponent.aiTimer++;
        if (opponent.aiTimer >= 10) {
            opponent.aiTimer = 0;
            const directions = ['up', 'down', 'left', 'right'];
            const currentDirectionIndex = directions.indexOf(opponent.direction);
            const nextDirectionIndex = (currentDirectionIndex + 1) % directions.length;
            opponent.nextDirection = directions[nextDirectionIndex];
        }
        
        // Update direction
        if (opponent.nextDirection) {
            opponent.direction = opponent.nextDirection;
            opponent.nextDirection = null;
        }
    });
}

function moveOpponent(opponent) {
    switch (opponent.direction) {
        case "up":
            opponent.y -= opponent.speed;
            break;
        case "down":
            opponent.y += opponent.speed;
            break;
        case "left":
            opponent.x -= opponent.speed;
            break;
        case "right":
            opponent.x += opponent.speed;
            break;
    }
}

function checkCollisions() {
    // Check player collisions
    if (player.alive) {
        // Wall collision
        if (player.x < 0 || player.x > canvas.width ||
            player.y < 0 || player.y > canvas.height) {
            eliminatePlayer();
        }
        
        // Self collision
        for (let i = 0; i < trails.player.length - 5; i++) {
            const dx = player.x - trails.player[i].x;
            const dy = player.y - trails.player[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < COLLISION_RADIUS) {
                eliminatePlayer();
                break;
            }
        }
        
        // Collision with opponent trails
        trails.opponents.forEach((opponentTrail, index) => {
            if (opponents[index].alive) {
                for (let i = 0; i < opponentTrail.length; i++) {
                    const dx = player.x - opponentTrail[i].x;
                    const dy = player.y - opponentTrail[i].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < COLLISION_RADIUS) {
                        eliminatePlayer();
                        break;
                    }
                }
            }
        });
    }
    
    // Check opponent collisions
    opponents.forEach((opponent, index) => {
        if (!opponent.alive) return;
        
        // Wall collision
        if (opponent.x < 0 || opponent.x > canvas.width ||
            opponent.y < 0 || opponent.y > canvas.height) {
            eliminateOpponent(index);
            return;
        }
        
        // Self collision
        for (let i = 0; i < trails.opponents[index].length - 5; i++) {
            const dx = opponent.x - trails.opponents[index][i].x;
            const dy = opponent.y - trails.opponents[index][i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < COLLISION_RADIUS) {
                eliminateOpponent(index);
                return;
            }
        }
        
        // Collision with player trail
        for (let i = 0; i < trails.player.length; i++) {
            const dx = opponent.x - trails.player[i].x;
            const dy = opponent.y - trails.player[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < COLLISION_RADIUS) {
                eliminateOpponent(index);
                score += 100; // Bonus points for eliminating opponent
                return;
            }
        }
        
        // Collision with other opponents
        trails.opponents.forEach((otherTrail, otherIndex) => {
            if (index !== otherIndex && opponents[otherIndex].alive) {
                for (let i = 0; i < otherTrail.length; i++) {
                    const dx = opponent.x - otherTrail[i].x;
                    const dy = opponent.y - otherTrail[i].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < COLLISION_RADIUS) {
                        eliminateOpponent(index);
                        return;
                    }
                }
            }
        });
    });
    
    // Check win condition
    if (!player.alive || opponents.every(op => !op.alive)) {
        gameOver();
    }
}

function eliminatePlayer() {
    if (player.alive) {
        player.alive = false;
        playCollisionSound();
    }
}

function eliminateOpponent(index) {
    if (opponents[index].alive) {
        opponents[index].alive = false;
        playCollisionSound();
    }
}

function gameOver() {
    gameState = 'gameover';
    
    // Update high score
    if (score > highScore) {
        highScore = score;
    }
    
    playGameOverSound();
    
    // Create explosion particles
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: player.x,
            y: player.y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 60,
            color: player.color
        });
    }
    
    // Show game over screen with scores
    document.getElementById("finalScore").innerText = score;
    document.getElementById("finalHighScore").innerText = highScore;
    document.getElementById("gameOver").style.display = "block";
    
    // Draw final frame with explosion
    drawFinalFrame();
}

function drawGrid() {
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    
    for (let x = 0; x < canvas.width; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawTrail(trail, color) {
    if (trail.length === 0) return;
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
    }
    
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawPlayer(entity) {
    ctx.shadowBlur = 20;
    ctx.shadowColor = entity.color;
    ctx.fillStyle = entity.color;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.vx *= 0.98;
        p.vy *= 0.98;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(p => {
        const alpha = p.life / 60;
        ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawFinalFrame() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawGrid();
    
    // Draw all trails
    drawTrail(trails.player, player.trailColor);
    
    opponents.forEach((opponent, index) => {
        if (trails.opponents[index]) {
            drawTrail(trails.opponents[index], opponent.trailColor);
        }
    });
    
    // Draw explosion
    drawParticles();
}

document.addEventListener("keydown", function (e) {
    if (gameState === 'playing') {
        switch (e.key.toLowerCase()) {
            case "w":
                setDirection("up");
                break;
            case "s":
                setDirection("down");
                break;
            case "a":
                setDirection("left");
                break;
            case "d":
                setDirection("right");
                break;
            case "shift":
                boost();
                break;
            case "escape":
                pauseGame();
                break;
        }
    } else if (gameState === 'gameover' && e.key === ' ') {
        restartGame();
    } else if (gameState === 'menu' && e.key === ' ') {
        startGame();
    }
});

function pauseGame() {
    if (gameState === 'playing') {
        gameState = 'paused';
    } else if (gameState === 'paused') {
        gameState = 'playing';
        gameLoop();
    }
}