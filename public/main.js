const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 캔소켓 연결
let ws;
let playerNumber = 0;
let roomId = new URLSearchParams(window.location.search).get('room') || 
             Math.random().toString(36).substring(7);

// 게임 상태
let gameStarted = false;
let waitingMessage = '상대방을 기다리는 중...';
let isPaused = false;

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
    
    // ESC 키 처리
    if (e.key === 'Escape' && gameStarted) {
        isPaused = !isPaused;
        // 일시정지 시 모든 키 입력 초기화
        if (isPaused) {
            Object.keys(keys).forEach(key => {
                keys[key] = false;
            });
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key in keys) {
        keys[e.key] = false;
    }
});

// 웹소켓 연결 함수
function connectWebSocket() {
    ws = new WebSocket('ws://' + window.location.hostname + ':3000');
    
    ws.onopen = () => {
        console.log('WebSocket 연결 성공!');
        // 방에 참여 요청 전송
        ws.send(JSON.stringify({ 
            type: 'join', 
            roomId,
            isCreator: !window.location.search.includes('room') // 방 생성자 여부 전송
        }));
    };

    ws.onerror = (error) => {
        console.error('WebSocket 에러:', error);
        alert('연결 에러가 발생했습니다. 콘솔을 확인해주세요.');
    };

    ws.onclose = (event) => {
        console.log('WebSocket 연결 종료:', event.code, event.reason);
    };

    // onmessage 핸들러를 여기로 이동
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
            case 'player':
                playerNumber = data.number;
                // 플레이어 번호 할당 후 게임 화면 표시
                modeSelection.style.display = 'none';
                onlineModeMenu.style.display = 'none';
                gameScreen.style.display = 'block';
                break;

            case 'start':
                gameStarted = true;
                gameEnded = false;
                restartButton.style.display = 'none';
                // 게임 시작 시 컨트롤 설명 표시
                document.querySelector('.controls').innerHTML = `
                    <p>왼쪽 패들: W/S 키</p>
                    <p>오른쪽 패들: ↑/↓ 키</p>
                    <button id="restartButton" style="display: none;">게임 다시 시작</button>
                    <button id="backToMenu">메인 메뉴로</button>
                `;
                // 게임 루프 시작
                if (!gameLoopStarted) {
                    gameLoopStarted = true;
                    gameLoop();
                }
                break;

            case 'restart':
                restartGame();
                break;

            case 'gameOver':
                gameEnded = true;
                restartButton.style.display = 'block';
                break;

            case 'paddleMove':
                if (data.playerNumber === 1) {
                    leftPaddle.y = data.y;
                } else {
                    rightPaddle.y = data.y;
                }
                break;

            case 'ballUpdate':
                if (playerNumber === 2) {
                    ball.x = canvas.width - data.ball.x;
                    ball.y = data.ball.y;
                    ball.speedX = -data.ball.speedX;
                    ball.speedY = data.ball.speedY;
                    playerScore = data.score.computerScore;
                    computerScore = data.score.playerScore;
                }
                break;

            case 'opponentLeft':
                gameStarted = false;
                waitingMessage = '상대방이 게임을 나갔습니다.';
                // 컨트롤 영역에 메인 메뉴로 돌아가기 버튼 다시 추가
                document.querySelector('.controls').innerHTML = `
                    <p>${waitingMessage}</p>
                    <button id="backToMenu">메인 메뉴로</button>
                `;
                
                // 메인 메뉴로 버튼에 이벤트 리스너 다시 연결
                document.getElementById('backToMenu').addEventListener('click', () => {
                    if (ws) {
                        ws.close();
                    }
                    
                    // 게임 화면 숨기기
                    gameScreen.style.display = 'none';
                    onlineModeMenu.style.display = 'none';
                    offlineModeMenu.style.display = 'none';
                    
                    // 모드 선택 화면 표시
                    modeSelection.style.display = 'block';
                    
                    // URL에서 room 파라미터 제거
                    window.history.pushState({}, '', window.location.pathname);
                    
                    // 게임 상태 초기화
                    gameStarted = false;
                    isOnlineMode = false;
                    playerScore = 0;
                    computerScore = 0;
                    document.getElementById('player-score').textContent = '0';
                    document.getElementById('computer-score').textContent = '0';
                });
                break;

            case 'roundEnd':
                resetBall();
                break;
        }
    };
}

// 게임 업데이트 함수
function update() {
    if (!gameStarted || isPaused) return;

    // 패들 이동 로직
    if (playerNumber === 1) {
        if (keys.w && leftPaddle.y > 0) {
            leftPaddle.y -= leftPaddle.speed;
            ws.send(JSON.stringify({
                type: 'paddleMove',
                y: leftPaddle.y
            }));
        }
        if (keys.s && leftPaddle.y < canvas.height - paddleHeight) {
            leftPaddle.y += leftPaddle.speed;
            ws.send(JSON.stringify({
                type: 'paddleMove',
                y: leftPaddle.y
            }));
        }
    } else if (!isPaused) {
        if (keys.ArrowUp && rightPaddle.y > 0) {
            rightPaddle.y -= rightPaddle.speed;
            ws.send(JSON.stringify({
                type: 'paddleMove',
                y: rightPaddle.y
            }));
        }
        if (keys.ArrowDown && rightPaddle.y < canvas.height - paddleHeight) {
            rightPaddle.y += rightPaddle.speed;
            ws.send(JSON.stringify({
                type: 'paddleMove',
                y: rightPaddle.y
            }));
        }
    }

    // 공 업데이트는 플레이어 1만 수행하고 일시정지 상태가 아닐 때만 수행
    if (playerNumber === 1 && !isPaused) {
        // 공 이동
        ball.x += ball.speedX;
        ball.y += ball.speedY;

        // 벽 충돌 체크
        if (ball.y <= 0 || ball.y >= canvas.height) {
            ball.speedY = -ball.speedY;
        }

        // 왼쪽 벽 충돌 (오른쪽 플레이어 득점)
        if (ball.x <= 0) {
            computerScore++;
            document.getElementById('computer-score').textContent = computerScore;
            updateScore(2, computerScore);
            
            if (computerScore >= 5) {
                handleWin(2);
            } else {
                resetBall();
                if (isOnlineMode) {
                    ws.send(JSON.stringify({
                        type: 'roundEnd',
                        roomId: roomId
                    }));
                }
            }
        }
        
        // 오른쪽 벽 충돌 (왼쪽 플레이어 득점)
        if (ball.x >= canvas.width) {
            playerScore++;
            document.getElementById('player-score').textContent = playerScore;
            updateScore(1, playerScore);
            
            if (playerScore >= 5) {
                handleWin(1);
            } else {
                resetBall();
                if (isOnlineMode) {
                    ws.send(JSON.stringify({
                        type: 'roundEnd',
                        roomId: roomId
                    }));
                }
            }
        }

        // 패들 충돌 체크
        if (checkPaddleCollision(leftPaddle) || checkPaddleCollision(rightPaddle)) {
            ball.speedX = -ball.speedX * 1.1; // 속도 증가
        }

        // 공 위치 전송
        if (isOnlineMode) {
            ws.send(JSON.stringify({
                type: 'ballUpdate',
                ball: {
                    x: ball.x,
                    y: ball.y,
                    speedX: ball.speedX,
                    speedY: ball.speedY
                },
                score: {
                    playerScore,
                    computerScore
                }
            }));
        }
    }
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
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!gameStarted) {
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(waitingMessage, canvas.width / 2, canvas.height / 2);
        ctx.font = '16px Arial';
        ctx.fillText(`방 코드: ${roomId}`, canvas.width / 2, canvas.height / 2 + 30);
        return;
    }

    if (gameEnded) {
        // 게임 종료 메시지 표시
        ctx.fillStyle = '#fff';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        const winner = playerScore > computerScore ? '왼쪽' : '오른쪽';
        ctx.fillText(
            `${winner} 플레이어 승리!`,
            canvas.width / 2,
            canvas.height / 2 - 30
        );
    }

    // 패들 그리기
    ctx.fillStyle = '#fff';
    ctx.fillRect(leftPaddle.x, leftPaddle.y, paddleWidth, paddleHeight);
    ctx.fillRect(rightPaddle.x, rightPaddle.y, paddleWidth, paddleHeight);

    // 공 그리기
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballSize, 0, Math.PI * 2);
    
    // 공의 속도 계산 (speedX와 speedY의 벡터 합)
    const ballSpeed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);
    
    // 속도에 따른 색상 계산
    // 기본 속도(5)일 때는 흰색에 가깝게, 최대 속도(약 15)일 때는 진한 빨간색이 되도록 설정
    const minSpeed = 5;  // 초기 속도
    const maxSpeed = 15; // 예상 최대 속도
    const intensity = Math.min((ballSpeed - minSpeed) / (maxSpeed - minSpeed), 1);
    
    // RGB 값 계산 (흰색 -> 빨간색)
    const red = 255;  // 빨간색은 항상 최대
    const green = Math.floor(255 * (1 - intensity));
    const blue = Math.floor(255 * (1 - intensity));
    
    ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
    ctx.fill();
    ctx.closePath();

    // 중앙선 그리기
    ctx.setLineDash([5, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    // 일시중지 상태일 때 메시지 표시
    if (isPaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('일시중지', canvas.width / 2, canvas.height / 2);
        ctx.font = '20px Arial';
        ctx.fillText('계속하려면 ESC를 누르세요', canvas.width / 2, canvas.height / 2 + 40);
    }
}

// 게임 루드
let isOnlineMode = false;

// DOM 요소
const modeSelection = document.getElementById('modeSelection');
const gameScreen = document.getElementById('gameScreen');
const offlineModeBtn = document.getElementById('offlineMode');
const onlineModeBtn = document.getElementById('onlineMode');
const backToMenuBtn = document.getElementById('backToMenu');
const restartButton = document.getElementById('restartButton');
const onlineModeMenu = document.getElementById('onlineModeMenu');
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const backToModeSelect = document.getElementById('backToModeSelect');
const offlineModeMenu = document.getElementById('offlineModeMenu');
const startOfflineGameBtn = document.getElementById('startOfflineGame');
const backToModeSelectOffline = document.getElementById('backToModeSelectOffline');

// 모드 선택 이벤트 리스너
offlineModeBtn.addEventListener('click', () => {
    isOnlineMode = false;
    modeSelection.style.display = 'none';
    offlineModeMenu.style.display = 'block';
});

// 온라인 모드 버튼 클릭 이벤트 리스너
onlineModeBtn.addEventListener('click', () => {
    // 모드 선택 화면을 숨기고 온라인 모드 메뉴 표시
    modeSelection.style.display = 'none';
    onlineModeMenu.style.display = 'block';
    
    // 방 만들기/참여하기 버튼 초기 상태로 복원
    createRoomBtn.style.display = 'block';
    joinRoomBtn.style.display = 'block';
    roomCodeDisplay.style.display = 'none';
});

backToMenuBtn.addEventListener('click', () => {
    // 웹소켓 연결이 있다면 종료
    if (ws) {
        ws.close();
    }
    
    // 게임 화면 숨기기
    gameScreen.style.display = 'none';
    onlineModeMenu.style.display = 'none';
    offlineModeMenu.style.display = 'none';
    
    // 모드 선택 화면 표시
    modeSelection.style.display = 'block';
    
    // URL에서 room 파라미터 제거
    window.history.pushState({}, '', window.location.pathname);
    
    // 게임 상태 초기화
    gameStarted = false;
    isOnlineMode = false;
    playerScore = 0;
    computerScore = 0;
    document.getElementById('player-score').textContent = '0';
    document.getElementById('computer-score').textContent = '0';
});

// 게임 시작 함수
function startGame() {
    if (isOnlineMode) {
        initOnlineMode();
    } else {
        gameScreen.style.display = 'block';
        initOfflineMode();
    }
}

// 온라인 모드 초기화
function initOnlineMode() {
    connectWebSocket(); // 웹소켓 연결 함수 호출
}

// 오프라인 모드 초기화
function initOfflineMode() {
    gameStarted = true;
    gameEnded = false;
    
    // AI 움직임 추가
    function updateAI() {
        if (!gameStarted || gameEnded) return;
        
        // 간단한 AI: 공을 따라 움직임
        const paddleCenter = rightPaddle.y + paddleHeight / 2;
        const ballCenter = ball.y;
        
        if (paddleCenter < ballCenter - 10) {
            rightPaddle.y += rightPaddle.speed;
        } else if (paddleCenter > ballCenter + 10) {
            rightPaddle.y -= rightPaddle.speed;
        }
    }
    
    // 오프라인 모드의 update 함수
    function offlineUpdate() {
        if (!gameStarted || gameEnded || isPaused) return;
        
        // 왼쪽 패들 (플레이어) 이동
        if (keys.w && leftPaddle.y > 0) {
            leftPaddle.y -= leftPaddle.speed;
        }
        if (keys.s && leftPaddle.y < canvas.height - paddleHeight) {
            leftPaddle.y += leftPaddle.speed;
        }
        
        // AI 업데이트
        updateAI();
        
        // 공 이동
        ball.x += ball.speedX;
        ball.y += ball.speedY;
        
        // 벽 충돌 체크
        if (ball.y <= 0 || ball.y >= canvas.height) {
            ball.speedY = -ball.speedY;
        }
        
        // 패들 충돌 체크
        if (checkPaddleCollision(leftPaddle) || checkPaddleCollision(rightPaddle)) {
            ball.speedX = -ball.speedX * 1.1;
        }
        
        // 점수 체크
        if (ball.x <= 0) {
            computerScore++;
            document.getElementById('computer-score').textContent = computerScore;
            if (computerScore >= 5) {
                gameEnded = true;
                restartButton.style.display = 'block';
            }
            resetBall();
        } else if (ball.x >= canvas.width) {
            playerScore++;
            document.getElementById('player-score').textContent = playerScore;
            if (playerScore >= 5) {
                gameEnded = true;
                restartButton.style.display = 'block';
            }
            resetBall();
        }
    }
    
    // 오프라인 모드용 게임 루프
    function offlineGameLoop() {
        offlineUpdate();
        draw();
        requestAnimationFrame(offlineGameLoop);
    }
    
    // 오프라인 게임 시작
    offlineGameLoop();
}

// 게임이 시작되기 전에는 게임 루프를 시작하지 않음
let gameLoopStarted = false;

// 기존의 gameLoop 함수 수정
function gameLoop() {
    if (isOnlineMode) {
        update();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

// URL에 room 파라미터가 있을 때의 처리 수정
if (window.location.search.includes('room')) {
    isOnlineMode = true;
    roomId = new URLSearchParams(window.location.search).get('room');
    startGame();
}

// 재시작 함수
function restartGame() {
    // 점수 초기화
    playerScore = 0;
    computerScore = 0;
    document.getElementById('player-score').textContent = '0';
    document.getElementById('computer-score').textContent = '0';
    
    // 패들 위치 초기화
    leftPaddle.y = canvas.height / 2 - paddleHeight / 2;
    rightPaddle.y = canvas.height / 2 - paddleHeight / 2;
    
    // 공 초기화
    resetBall();
    
    // 게임 상태 초기화
    gameEnded = false;
    gameStarted = true;
    
    // 재시작 버튼 숨기기
    restartButton.style.display = 'none';
    
    // 온라인 모드일 경우 상대방에게 재시작 알림
    if (isOnlineMode && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'restart', roomId }));
    }
}

// 재시작 버튼 이벤트 리스너
restartButton.addEventListener('click', restartGame);

// 점수 체크 함수 (온라인/오프라인 모드 공통)
function checkScore(isLeftScore) {
    if (isLeftScore) {
        computerScore++;
        document.getElementById('computer-score').textContent = computerScore;
        if (computerScore >= 5) {
            gameEnded = true;
            restartButton.style.display = 'block';
            if (isOnlineMode) {
                ws.send(JSON.stringify({ type: 'gameOver', roomId }));
            }
        }
    } else {
        playerScore++;
        document.getElementById('player-score').textContent = playerScore;
        if (playerScore >= 5) {
            gameEnded = true;
            restartButton.style.display = 'block';
            if (isOnlineMode) {
                ws.send(JSON.stringify({ type: 'gameOver', roomId }));
            }
        }
    }
    resetBall();
}

// 방 만들기 버튼 클릭 핸들러
createRoomBtn.addEventListener('click', () => {
    const newRoomId = Math.random().toString(36).substring(7);
    
    // 게임 화면으로 전환하고 대기 화면 표시
    onlineModeMenu.style.display = 'none';
    gameScreen.style.display = 'block';
    document.querySelector('.controls').innerHTML = `
        <div class="waiting-message">
            <p>방 코드: ${newRoomId}</p>
            <p>다른 플레이어의 참가를 기다리는 중...</p>
            <button id="backToOnlineMenu" class="menu-button">뒤로가기</button>
        </div>
    `;

    // 뒤로가기 버튼에 이벤트 리스너 추가
    document.getElementById('backToOnlineMenu').addEventListener('click', () => {
        // 게임 화면 숨기기
        gameScreen.style.display = 'none';
        
        // 온라인 모드 메뉴로 돌아가기
        onlineModeMenu.style.display = 'block';
        
        // URL에서 room 파라미터 제거
        window.history.pushState({}, '', window.location.pathname);
        
        // 웹소켓 연결 종료
        if (ws) {
            ws.close();
        }
        
        // 게임 상태 초기화
        gameStarted = false;
        isOnlineMode = false;
    });
    
    isOnlineMode = true;
    roomId = newRoomId;
    window.history.pushState({}, '', `?room=${newRoomId}`);
    startGame();
});

// 방 참여하기 버튼 클릭 핸들러
joinRoomBtn.addEventListener('click', () => {
    const roomId = prompt('참여할 방 코드를 입력하세요:');
    if (roomId) {
        window.open(`${window.location.origin}?room=${roomId}`, '_blank');
    }
});

// 뒤로가기 버튼 클릭 핸들러
backToModeSelect.addEventListener('click', () => {
    // 온라인 모드 메뉴를 숨기고 모드 선택 화면으로 돌아가기
    onlineModeMenu.style.display = 'none';
    modeSelection.style.display = 'block';
    
    // 버튼들 초기 상태로 복원
    createRoomBtn.style.display = 'block';
    joinRoomBtn.style.display = 'block';
    roomCodeDisplay.style.display = 'none';
});

// 오프라인 게임 시작 버튼 이벤트 추가
startOfflineGameBtn.addEventListener('click', () => {
    offlineModeMenu.style.display = 'none';
    startGame();
});

// 오프라인 모드 뒤로가기 버튼 이벤트 추가
backToModeSelectOffline.addEventListener('click', () => {
    offlineModeMenu.style.display = 'none';
    modeSelection.style.display = 'block';
});

function handleScore() {
    if (playerScore >= 5 || computerScore >= 5) {
        gameEnded = true;
        // 게임 종료 처리
    } else {
        // 라운드 종료 시 서버에 알림
        if (isOnlineMode && ws) {
            ws.send(JSON.stringify({
                type: 'roundEnd',
                roomId
            }));
        } else {
            resetBall();
        }
    }
}

// 승리 처리 함수 수정
function handleWin(winner) {
    if (isOnlineMode && ws) {
        // 온라인 모드일 때 서버로 승리 정보 전송
        ws.send(JSON.stringify({
            type: 'gameWin',
            roomId: roomId,
            winner: winner
        }));
    }
    
    // 게임 종료 처리
    gameEnded = true;
    restartButton.style.display = 'block';
}

function updateScore(player, score) {
    if (isOnlineMode && ws) {
        // 온라인 모드일 때 서버로 점수 전송
        ws.send(JSON.stringify({
            type: 'updateScore',
            roomId: roomId,
            score: score,
            player: player
        }));
    }
    
    // 화면에 점수 표시
    if (player === 1) {
        document.getElementById('player-score').textContent = score;
    } else {
        document.getElementById('computer-score').textContent = score;
    }
}

// 소켓 이벤트 리스너 추가
if (isOnlineMode) {
    // WebSocket 메시지 이벤트 리스너
    ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'gameStateUpdate':
                ball.x = data.ball.x;
                ball.y = data.ball.y;
                ball.speedX = data.ball.speedX;
                ball.speedY = data.ball.speedY;
                break;
                
            case 'scoreUpdated':
                // 상대방의 점수 업데이트 수신
                if (data.player === 1) {
                    document.getElementById('player-score').textContent = data.score;
                } else {
                    document.getElementById('computer-score').textContent = data.score;
                }
                break;
                
            case 'gameResult':
                // 게임 결과 수신
                gameEnded = true;
                restartButton.style.display = 'block';
                break;
        }
    });
}
