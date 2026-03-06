const canvas = document.getElementById("gamecanvas");
const ctx = canvas.getcontext("2d")

canvas.width = window.innerWidth;
canvas.height = window.innerHeight - 120;

let player;
let trail;
let direction;
let speed;
let score;
let gameRunning=false;

function startGame(){

player ={
x:canvas.width/2,
y:canvas.height/2
};

trail=[];
direction="right";
speed=4;
score=0;

document.getElementById("menu").style.display='none';
document.getElementById("gameOver").style.display="none";

gameRunning=true;

gameLoop();
}

function restartGame(){
startGame();
}

function setDirection(dir){
direction=dir;
}

function boost(){
speed=8;
setTimeout(()=>{
speed=4;
},1000)
}

function gameLoop(){

if(!gameRunning) return;

requestAnimationFrame(gameLoop);

ctx.fillstyle="rgba(0,0,0,0.2)";
ctx.fillRect(0,0,canvas.width,canvas.height);

drawGrid();

movePlayer();

trail.push({x:player.x,y:player.y});

ctx.strokestyle="cyan";
ctx.lineWidth=3;
ctx.beginPath();

for(let i=0;i<trail.lenght;i++){
ctr.lineTo(trail[i].x,trail[i].y);
}

ctx.stroke();

ctx.fillstyle="cyan";
ctx.beginpath();
ctx.arc(player.x,player.y,5,0,Math.PI*2);
ctx.fill();

score++;
document.getElementById("score").innerText="score: "+score;

checkCollision();

}

function movePlayer(){

if(direction==="up") player.y-=speed;
if(direction==="down") player.y+=speed;
if(direction==="left") player.x-=speed;
if(direction==="right") player.x+=speed;

}

function cheskCollision(){

if(
player.x<0||
player.x>canvas.width||
player.y<0||
player.y>canvas.height 
){
gameOver();
}

for(let i=0;i<trail.leght-10;i++){

let dx=player.x-trail[i].x;
let dy=player.y-trail[i].y;

let distance=Math.sqrt(dx*dx+dy*dy);

if(distance<5){
gameOver();
}

}

}

function gameOver(){

gameRunning=false;

document.getElementById("gameOver").style.display="block";

}

function drawGrid(){

ctx.strokeStyle="#0a0a0a";

for(let x=0;x<canvas.width;x+=40){

ctx.beginPath();
ctx.moveTo(x,0);
ctx.lineTo(x,canvas.height);
ctx.stroke();

}

for(let y=0;y<canvas.height;y+=40){

ctx.beginPath();
ctx.moveTo(0,y);
ctx.lineTo(canvas.width,y);
ctx.stroke();

}

}

document.addEventListener("keydown",function(e){

if(e.key==="w") direction="up";
if(e.key==="s") direction="down";
if(e.key==="a") direction="left";
if(e.key==="d") direction="right";

if(e.key==="Shift") boost();

});