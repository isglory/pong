const roomId = new URLSearchParams(window.location.search).get('room') || 
               Math.random().toString(36).substring(7);

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = wsProtocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
    console.log('WebSocket 연결 성공!');
    console.log('방 ID:', roomId);
    ws.send(JSON.stringify({ type: 'join', roomId }));
    if (!window.location.search.includes('room')) {
        window.history.pushState({}, '', `?room=${roomId}`);
    }
};

ws.onerror = (error) => {
    console.error('WebSocket 에러:', error);
    alert('연결 에러가 발생했습니다. 콘솔을 확인해주세요.');
};

ws.onclose = (event) => {
    console.log('WebSocket 연결 종료:', event.code, event.reason);
    alert('연결이 종료되었습니다.');
}; 