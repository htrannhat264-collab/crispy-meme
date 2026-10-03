const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

class GameWebSocketClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.isAuthenticated = false;
        this.sessionId = null;
        this.latestTxData = null;
        this.latestMd5Data = null;
        this.lastUpdateTime = {
            tx: null,
            md5: null
        };
        this.refreshInterval = null;
    }

    connect() {
        console.log('🔗 Connecting to WebSocket server...');

        try {
            this.ws = new WebSocket(this.url, {
                headers: {
                    'Host': 'apisao.net',
                    'Origin': 'https://play.sao789a.me',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
                    'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
                    'Sec-WebSocket-Version': '13'
                },
                handshakeTimeout: 15000
            });

            this.setupEventHandlers();
        } catch (err) {
            console.error('❌ Failed to create WebSocket:', err.message);
            this.handleReconnect();
        }
    }

    setupEventHandlers() {
        this.ws.on('open', () => {
            console.log('✅ Connected to WebSocket server');
            this.reconnectAttempts = 0;
            this.sendAuthentication();
        });

        this.ws.on('message', (data) => {
            this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
        });

        this.ws.on('close', (code, reason) => {
            console.log(`🔌 Connection closed. Code: ${code}, Reason: ${reason}`);
            this.isAuthenticated = false;
            this.sessionId = null;
            this.handleReconnect();
        });

        this.ws.on('pong', () => {
            console.log('❤️  Heartbeat received from server');
        });
    }

    sendAuthentication() {
        console.log('🔐 Sending authentication...');

        const authMessage = [
            1,
            "MiniGame",
            "wanglin2019",
            "WangFlang1",
            {
                "signature": "18F85DA15FE2D7A07B2371D0CA9E0E8CBCC689545B6690A306ED6B117395F43DC107F7A385B1493705069EF3F62CADB0B45E5F47318C5833F5310E5BB760E92E9046771065691FE9FF7873A7BA8A7BDC47CD5CAEF517E18C77F20CF2961A48ABEF7EB92EAEA3D61CB5C0C12442361D30BC4AC8ABCD2320EB1710B5A93E73DE45",
                "info": {
                    "cs": "cb9094c448d778f4364c3540a3e884d7",
                    "phone": "84345692813",
                    "ipAddress": "113.185.45.88",
                    "isMerchant": false,
                    "userId": "43ff3d83-a436-4626-ac0f-599d0acc8a24",
                    "deviceId": "050105373613600053736078036024",
                    "isMktAccount": false,
                    "username": "wanglin2019",
                    "timestamp": 1766473806587
                },
                "pid": 4
            }
        ];

        this.sendRaw(authMessage);
    }

    sendPluginMessages() {
        console.log('🚀 Sending plugin initialization messages...');

        const pluginMessages = [
            [6, "MiniGame", "taixiuPlugin", { "cmd": 1005 }],
            [6, "MiniGame", "taixiuMd5Plugin", { "cmd": 1105 }],
            [6, "MiniGame", "taixiuLiveRoomPlugin", { "cmd": 1305, "rid": 0 }],
            [6, "MiniGame", "taixiuMd5v2Plugin", { "cmd": 1405 }],
            [6, "MiniGame", "lobbyPlugin", { "cmd": 10001 }]
        ];

        pluginMessages.forEach((message, index) => {
            setTimeout(() => {
                console.log(`📤 Sending plugin ${index + 1}/${pluginMessages.length}: ${message[2]}`);
                this.sendRaw(message);
            }, index * 1000);
        });

        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            this.refreshGameData();
        }, 30000);
    }

    refreshGameData() {
        if (this.isAuthenticated && this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('🔄 Refreshing game data...');

            this.sendRaw([6, "MiniGame", "taixiuPlugin", { "cmd": 1005 }]);
            setTimeout(() => {
                this.sendRaw([6, "MiniGame", "taixiuMd5Plugin", { "cmd": 1105 }]);
            }, 1000);
        }
    }

    sendRaw(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const jsonString = JSON.stringify(data);
            this.ws.send(jsonString);
            console.log('📤 Sent raw:', jsonString);
            return true;
        } else {
            console.log('⚠️ Cannot send, WebSocket not open');
            return false;
        }
    }

    handleMessage(data) {
        try {
            const parsed = JSON.parse(data);

            if (parsed[0] === 5 && parsed[1] && parsed[1].cmd === 1005) {
                console.log('🎯 Nhận được dữ liệu cmd 1005 (Bàn TX)');
                const gameData = parsed[1];
                if (gameData.htr && gameData.htr.length > 0) {
                    const latestSession = gameData.htr.reduce((prev, current) => {
                        return (current.sid > prev.sid) ? current : prev;
                    });
                    console.log(`🎲 Bàn TX - Phiên gần nhất: ${latestSession.sid} (${latestSession.d1},${latestSession.d2},${latestSession.d3})`);
                    this.latestTxData = gameData;
                    this.lastUpdateTime.tx = new Date();
                }
            }
            else if (parsed[0] === 5 && parsed[1] && parsed[1].cmd === 1105) {
                console.log('🎯 Nhận được dữ liệu cmd 1105 (Bàn MD5)');
                const gameData = parsed[1];
                if (gameData.htr && gameData.htr.length > 0) {
                    const latestSession = gameData.htr.reduce((prev, current) => {
                        return (current.sid > prev.sid) ? current : prev;
                    });
                    console.log(`🎲 Bàn MD5 - Phiên gần nhất: ${latestSession.sid} (${latestSession.d1},${latestSession.d2},${latestSession.d3})`);
                    this.latestMd5Data = gameData;
                    this.lastUpdateTime.md5 = new Date();
                }
            }
            else if (parsed[0] === 5 && parsed[1] && parsed[1].u) {
                console.log('🔑 Authentication successful!');
                const userData = parsed[1];
                console.log(`✅ User: ${userData.u}`);
                this.isAuthenticated = true;

                setTimeout(() => {
                    console.log('🔄 Starting to send plugin messages...');
                    this.sendPluginMessages();
                }, 2000);
            }
            else if (parsed[0] === 1 && parsed[4] === "MiniGame") {
                console.log('✅ Session initialized');
                this.sessionId = parsed[3];
                console.log(`📋 Session ID: ${this.sessionId}`);
            }
            else if (parsed[0] === 7) {
                console.log(`🔄 Plugin ${parsed[2]} response received`);
            }
            else if (parsed[0] === 0) {
                console.log('❤️  Heartbeat received');
            }

        } catch (e) {
            console.log('📥 Raw message:', data.toString());
            console.error('❌ Parse error:', e.message);
        }
    }

    getLatestTxSession() {
        if (!this.latestTxData || !this.latestTxData.htr || this.latestTxData.htr.length === 0) {
            return {
                error: "Không có dữ liệu bàn TX",
                message: "Chưa nhận được dữ liệu từ server hoặc dữ liệu trống"
            };
        }

        try {
            const latestSession = this.latestTxData.htr.reduce((prev, current) => {
                return (current.sid > prev.sid) ? current : prev;
            });

            const tong = latestSession.d1 + latestSession.d2 + latestSession.d3;
            const ket_qua = (tong >= 11 && tong <= 18) ? "tài" : "xỉu";

            return {
                phien: latestSession.sid,
                xuc_xac_1: latestSession.d1,
                xuc_xac_2: latestSession.d2,
                xuc_xac_3: latestSession.d3,
                tong: tong,
                ket_qua: ket_qua,
                timestamp: new Date().toISOString(),
                ban: "tai_xiu",
                last_updated: this.lastUpdateTime.tx ? this.lastUpdateTime.tx.toISOString() : null
            };
        } catch (error) {
            return {
                error: "Lỗi xử lý dữ liệu TX",
                message: error.message
            };
        }
    }

    getLatestMd5Session() {
        if (!this.latestMd5Data || !this.latestMd5Data.htr || this.latestMd5Data.htr.length === 0) {
            return {
                error: "Không có dữ liệu bàn MD5",
                message: "Chưa nhận được dữ liệu từ server hoặc dữ liệu trống"
            };
        }

        try {
            const latestSession = this.latestMd5Data.htr.reduce((prev, current) => {
                return (current.sid > prev.sid) ? current : prev;
            });

            const tong = latestSession.d1 + latestSession.d2 + latestSession.d3;
            const ket_qua = (tong >= 11 && tong <= 18) ? "tài" : "xỉu";

            return {
                phien: latestSession.sid,
                xuc_xac_1: latestSession.d1,
                xuc_xac_2: latestSession.d2,
                xuc_xac_3: latestSession.d3,
                tong: tong,
                ket_qua: ket_qua,
                timestamp: new Date().toISOString(),
                ban: "md5",
                last_updated: this.lastUpdateTime.md5 ? this.lastUpdateTime.md5.toISOString() : null
            };
        } catch (error) {
            return {
                error: "Lỗi xử lý dữ liệu MD5",
                message: error.message
            };
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * this.reconnectAttempts;

            console.log(`🔄 Attempting to reconnect in ${delay}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
                console.log('🔄 Reconnecting...');
                this.connect();
            }, delay);
        } else {
            console.log('❌ Max reconnection attempts reached, resetting...');
            // Reset để tiếp tục thử lại sau 60s
            this.reconnectAttempts = 0;
            setTimeout(() => this.connect(), 60000);
        }
    }

    startHeartbeat() {
        setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const heartbeatMsg = [0, this.sessionId || ""];
                this.ws.send(JSON.stringify(heartbeatMsg));
                console.log('❤️  Sending heartbeat...');
            }
        }, 25000);
    }

    close() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        if (this.ws) {
            this.ws.close();
        }
    }
}

// ================== EXPRESS SERVER ==================
const app = express();
const PORT = process.env.PORT || 3012;

app.use(cors());
app.use(express.json());

// ✅ Route health check cho Render (phải trả 200 ngay lập tức)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Tạo WebSocket client
const client = new GameWebSocketClient(
    'wss://apisao.net/websocket?d=YUdkaWIySnF8MjF8MTc2NjQ3MzgwNjA1OXwyOTkyZDYyNTY3N2NjMjU5ZTFmNWU0NjMzYmU5ZDY3ZXxkYmZhNjZmYTg2ZDdhMGZiODEzNGE2YWQ4YjE3ODllOA=='
);

client.connect();

// Routes
app.get('/api/tx', (req, res) => {
    try {
        const latestSession = client.getLatestTxSession();
        if (latestSession.error) return res.status(404).json(latestSession);
        res.json(latestSession);
    } catch (error) {
        res.status(500).json({ error: "Lỗi server", message: error.message });
    }
});

app.get('/api/md5', (req, res) => {
    try {
        const latestSession = client.getLatestMd5Session();
        if (latestSession.error) return res.status(404).json(latestSession);
        res.json(latestSession);
    } catch (error) {
        res.status(500).json({ error: "Lỗi server", message: error.message });
    }
});

app.get('/api/all', (req, res) => {
    try {
        const txSession = client.getLatestTxSession();
        const md5Session = client.getLatestMd5Session();
        res.json({
            tai_xiu: txSession.error ? { error: txSession.error } : txSession,
            md5: md5Session.error ? { error: md5Session.error } : md5Session,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: "Lỗi server", message: error.message });
    }
});

app.get('/api/status', (req, res) => {
    const hasTxData = client.latestTxData && client.latestTxData.htr && client.latestTxData.htr.length > 0;
    const hasMd5Data = client.latestMd5Data && client.latestMd5Data.htr && client.latestMd5Data.htr.length > 0;

    res.json({
        status: "running",
        websocket_connected: client.ws ? client.ws.readyState === WebSocket.OPEN : false,
        authenticated: client.isAuthenticated,
        has_tx_data: hasTxData,
        has_md5_data: hasMd5Data,
        tx_data_count: hasTxData ? client.latestTxData.htr.length : 0,
        md5_data_count: hasMd5Data ? client.latestMd5Data.htr.length : 0,
        tx_latest_sid: hasTxData ? client.latestTxData.htr.reduce((p, c) => c.sid > p.sid ? c : p).sid : null,
        md5_latest_sid: hasMd5Data ? client.latestMd5Data.htr.reduce((p, c) => c.sid > p.sid ? c : p).sid : null,
        tx_last_updated: client.lastUpdateTime.tx ? client.lastUpdateTime.tx.toISOString() : null,
        md5_last_updated: client.lastUpdateTime.md5 ? client.lastUpdateTime.md5.toISOString() : null,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/refresh', (req, res) => {
    if (client.isAuthenticated && client.ws && client.ws.readyState === WebSocket.OPEN) {
        client.refreshGameData();
        res.json({ message: "Đã gửi yêu cầu refresh dữ liệu cả 2 bàn", timestamp: new Date().toISOString() });
    } else {
        res.status(400).json({ error: "Không thể refresh", message: "WebSocket chưa kết nối hoặc chưa xác thực" });
    }
});

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>🎲 Sảnh Tài Xỉu - API</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background: #f0f2f5; }
                    h1 { color: #333; text-align: center; }
                    .container { max-width: 900px; margin: 0 auto; }
                    .endpoint { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    code { background: #e0e0e0; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
                    .api-link { color: #1890ff; text-decoration: none; }
                    .api-link:hover { text-decoration: underline; }
                    .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
                    .connected { background: #d4edda; color: #155724; }
                    .disconnected { background: #f8d7da; color: #721c24; }
                    .btn { background: #1890ff; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
                    .btn:hover { background: #40a9ff; }
                    .board { display: inline-block; padding: 10px; margin: 5px; border-radius: 5px; }
                    .board-tx { background: #e6f7ff; border: 1px solid #91d5ff; }
                    .board-md5 { background: #f6ffed; border: 1px solid #b7eb8f; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🎲 Sảnh Tài Xỉu - API</h1>
                    <div id="status" class="endpoint"><h2>📡 Đang kiểm tra trạng thái...</h2></div>
                    <div class="endpoint">
                        <h2>📊 API Endpoints:</h2>
                        <ul>
                            <li><code>GET <a class="api-link" href="/api/tx">/api/tx</a></code></li>
                            <li><code>GET <a class="api-link" href="/api/md5">/api/md5</a></code></li>
                            <li><code>GET <a class="api-link" href="/api/all">/api/all</a></code></li>
                            <li><code>GET <a class="api-link" href="/api/status">/api/status</a></code></li>
                            <li><code>GET <a class="api-link" href="/api/refresh">/api/refresh</a></code></li>
                            <li><code>GET <a class="api-link" href="/health">/health</a></code></li>
                        </ul>
                    </div>
                    <div id="data-display" class="endpoint">
                        <h2>📋 Data Display:</h2>
                        <div id="tx-data"></div>
                        <div id="md5-data"></div>
                    </div>
                </div>
                <script>
                    function updateStatus() {
                        fetch('/api/status').then(r => r.json()).then(data => {
                            const isConnected = data.websocket_connected;
                            const hasTxData = data.has_tx_data;
                            const hasMd5Data = data.has_md5_data;
                            document.getElementById('status').innerHTML = \`
                                <h2>📡 Trạng thái hệ thống:</h2>
                                <div class="status \${isConnected ? 'connected' : 'disconnected'}">
                                    <p><strong>WebSocket:</strong> \${isConnected ? '✅ Đã kết nối' : '❌ Mất kết nối'}</p>
                                    <p><strong>Xác thực:</strong> \${data.authenticated ? '✅ Đã xác thực' : '⏳ Chưa xác thực'}</p>
                                    <div class="board board-tx">
                                        <p><strong>Bàn TX:</strong> \${hasTxData ? '✅ ' + data.tx_data_count + ' phiên' : '⏳ Đang chờ'}</p>
                                    </div>
                                    <div class="board board-md5">
                                        <p><strong>Bàn MD5:</strong> \${hasMd5Data ? '✅ ' + data.md5_data_count + ' phiên' : '⏳ Đang chờ'}</p>
                                    </div>
                                </div>\`;
                            if (hasTxData) getTX();
                            if (hasMd5Data) getMD5();
                        }).catch(() => {});
                    }
                    function getTX() {
                        fetch('/api/tx').then(r => r.json()).then(data => {
                            if (data.error) return;
                            document.getElementById('tx-data').innerHTML = \`
                                <div class="board board-tx">
                                    <h3>🎲 Bàn Tài Xỉu</h3>
                                    <p><strong>Phiên:</strong> \${data.phien}</p>
                                    <p><strong>Xúc xắc:</strong> \${data.xuc_xac_1}, \${data.xuc_xac_2}, \${data.xuc_xac_3}</p>
                                    <p><strong>Tổng:</strong> \${data.tong} (<span style="color:\${data.ket_qua==='tài'?'red':'blue'}">\${data.ket_qua}</span>)</p>
                                </div>\`;
                        });
                    }
                    function getMD5() {
                        fetch('/api/md5').then(r => r.json()).then(data => {
                            if (data.error) return;
                            document.getElementById('md5-data').innerHTML = \`
                                <div class="board board-md5">
                                    <h3>🔐 Bàn MD5</h3>
                                    <p><strong>Phiên:</strong> \${data.phien}</p>
                                    <p><strong>Xúc xắc:</strong> \${data.xuc_xac_1}, \${data.xuc_xac_2}, \${data.xuc_xac_3}</p>
                                    <p><strong>Tổng:</strong> \${data.tong} (<span style="color:\${data.ket_qua==='tài'?'red':'blue'}">\${data.ket_qua}</span>)</p>
                                </div>\`;
                        });
                    }
                    updateStatus();
                    setInterval(updateStatus, 5000);
                </script>
            </body>
        </html>
    `);
});

// ✅ Bắt đầu lắng nghe với host 0.0.0.0 để Render truy cập được
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server đang chạy tại: http://0.0.0.0:${PORT}`);
    console.log(`🌐 Render URL: https://<your-app>.onrender.com`);
});

// Xử lý lỗi không bắt được để app không bị crash
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});

// Heartbeat sau khi kết nối
setTimeout(() => {
    client.startHeartbeat();
}, 10000);

// Tắt chương trình sạch
process.on('SIGINT', () => {
    console.log('\n👋 Closing...');
    client.close();
    server.close();
    process.exit();
});

module.exports = { GameWebSocketClient, app };
