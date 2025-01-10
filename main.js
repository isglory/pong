const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 캔버스 크기 설정
canvas.width = 800;
canvas.height = 400;

// 게임 객체
const paddleWidth = 10;
const paddleHeight = 60;
const ballSize = 8;

// 패들 객체
const leftPaddle = {
    x: 50,
    y: canvas.height / 2 - paddleHeight / 2,
    speed: 5
};

const rightPaddle = {
    x: canvas.width - 50 - paddleWidth,
    y: canvas.height / 2 - paddleHeight / 2,
    speed: 5
};

// 공 객체
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    speedX: 5,
    speedY: 5
};

// 점수
let playerScore = 0;
let computerScore = 0;

// 키 입력 상태
const keys = {
    w: false,
    s: false,
    ArrowUp: false,
    ArrowDown: false
};

// 키 이벤트 리스너
document.addEventListener('keydown', (e) => {
    if (e.key in keys) {
        keys[e.key] = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key in keys) {
        keys[e.key] = false;
    }
});

// 게임 업데이트 함수
function update() {
    // 왼쪽 패들 이동
    if (keys.w && leftPaddle.y > 0) {
        leftPaddle.y -= leftPaddle.speed;
    }
    if (keys.s && leftPaddle.y < canvas.height - paddleHeight) {
        leftPaddle.y += leftPaddle.speed;
    }

    // 오른쪽 패들 이동
    if (keys.ArrowUp && rightPaddle.y > 0) {
        rightPaddle.y -= rightPaddle.speed;
    }
    if (keys.ArrowDown && rightPaddle.y < canvas.height - paddleHeight) {
        rightPaddle.y += rightPaddle.speed;
    }

    // 공 이동
    ball.x += ball.speedX;
    ball.y += ball.speedY;

    // 벽 충돌 체크
    if (ball.y <= 0 || ball.y >= canvas.height) {
        ball.speedY = -ball.speedY;
    }

    // 패들 충돌 체크
    if (checkPaddleCollision(leftPaddle) || checkPaddleCollision(rightPaddle)) {
        ball.speedX = -ball.speedX * 1.1; // 속도 증가
    }

    // 점수 체크
    if (ball.x <= 0) {
        computerScore++;
        resetBall();
    } else if (ball.x >= canvas.width) {
        playerScore++;
        resetBall();
    }

    // 점수 업데이트
    document.getElementById('player-score').textContent = playerScore;
    document.getElementById('computer-score').textContent = computerScore;
}

// 패들 충돌 체크 함수
function checkPaddleCollision(paddle) {
    return ball.x >= paddle.x && 
           ball.x <= paddle.x + paddleWidth &&
           ball.y >= paddle.y && 
           ball.y <= paddle.y + paddleHeight;
}

// 공 리셋 함수
function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedX = (Math.random() > 0.5 ? 1 : -1) * 5;
    ball.speedY = (Math.random() > 0.5 ? 1 : -1) * 5;
}

// 그리기 함수
function draw() {
    // 캔버스 지우기
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 패들 그리기
    ctx.fillStyle = '#fff';
    ctx.fillRect(leftPaddle.x, leftPaddle.y, paddleWidth, paddleHeight);
    ctx.fillRect(rightPaddle.x, rightPaddle.y, paddleWidth, paddleHeight);

    // 공 그리기
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballSize, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.closePath();

    // 중앙선 그리기
    ctx.setLineDash([5, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.strokeStyle = '#fff';
    ctx.stroke();
}

// 게임 루프
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// 게임 시작
gameLoop();
