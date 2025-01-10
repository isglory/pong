const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();

// CORS 설정 추가
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ 
    server,
    verifyClient: () => true,
    path: '/'
});

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 연결된 플레이어들을 저장
const rooms = new Map();

wss.on('connection', (ws, req) => {
    console.log('새로운 클라이언트 연결됨');
    console.log('클라이언트 IP:', req.socket.remoteAddress);
    
    let roomId = '';
    let playerNumber = 0;

    ws.on('message', (message) => {
        try {
            console.log('받은 메시지:', message.toString());
            const data = JSON.parse(message);
            console.log('파싱된 데이터:', data);

            switch (data.type) {
                case 'join':
                    roomId = data.roomId;
                    console.log(`클라이언트가 방 ${roomId}에 참여 시도`);
                    
                    if (!rooms.has(roomId)) {
                        console.log('새로운 방 생성');
                        rooms.set(roomId, [ws]);
                        playerNumber = 1;
                        ws.send(JSON.stringify({ type: 'player', number: 1 }));
                    } else if (rooms.get(roomId).length === 1) {
                        console.log('기존 방에 참여');
                        rooms.get(roomId).push(ws);
                        playerNumber = 2;
                        ws.send(JSON.stringify({ type: 'player', number: 2 }));
                        // 게임 시작을 양쪽 플레이어에게 알림
                        rooms.get(roomId).forEach(client => {
                            client.send(JSON.stringify({ type: 'start' }));
                        });
                    } else {
                        console.log('방이 가득 참');
                        ws.send(JSON.stringify({ type: 'error', message: '방이 가득 찼습니다.' }));
                    }
                    break;

                case 'paddleMove':
                    if (rooms.has(roomId)) {
                        rooms.get(roomId).forEach(client => {
                            if (client !== ws) {
                                client.send(JSON.stringify({
                                    type: 'paddleMove',
                                    y: data.y,
                                    playerNumber
                                }));
                            }
                        });
                    }
                    break;

                case 'ballUpdate':
                    if (rooms.has(roomId)) {
                        rooms.get(roomId).forEach(client => {
                            if (client !== ws) {
                                client.send(JSON.stringify({
                                    type: 'ballUpdate',
                                    ball: data.ball,
                                    score: data.score
                                }));
                            }
                        });
                    }
                    break;

                case 'restart':
                    if (rooms.has(roomId)) {
                        rooms.get(roomId).forEach(client => {
                            if (client !== ws) {
                                client.send(JSON.stringify({ type: 'restart' }));
                            }
                        });
                    }
                    break;

                case 'gameOver':
                    if (rooms.has(roomId)) {
                        rooms.get(roomId).forEach(client => {
                            if (client !== ws) {
                                client.send(JSON.stringify({ type: 'gameOver' }));
                            }
                        });
                    }
                    break;
            }
        } catch (error) {
            console.error('메시지 처리 중 에러:', error);
        }
    });

    ws.on('close', () => {
        console.log('클라이언트 연결 종료');
        if (rooms.has(roomId)) {
            const updatedClients = rooms.get(roomId).filter(client => client !== ws);
            if (updatedClients.length === 0) {
                rooms.delete(roomId);
            } else {
                rooms.set(roomId, updatedClients);
                updatedClients.forEach(client => {
                    client.send(JSON.stringify({ type: 'opponentLeft' }));
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 