const peer = new Peer({
    debug: 2,
    config: {'iceServers': [
        { url: 'stun:stun.l.google.com:19302' },
        { url: 'stun:stun1.l.google.com:19302' },
        { url: 'stun:stun2.l.google.com:19302' }
    ]}
});

// Mantener la conexión activa (ping al servidor de señalización)
setInterval(() => {
    if (peer.disconnected) {
        console.warn('Peer desconectado del servidor. Intentando reconectar...');
        peer.reconnect();
    }
}, 5000);

let myId = null;
let myUsername = "Anónimo";
let connections = {}; // Arreglo para múltiples conexiones Mesh
let calls = {};       // Arreglo para múltiples videollamadas
let localStream = null;
let currentFacingMode = 'user'; // 'user' para frontal, 'environment' para trasera (Legacy)
let videoDevices = [];         // Lista de cámaras disponibles
let currentDeviceIndex = 0;    // Índice de la cámara actual
let peerUsernames = {}; // Mapa para guardar los nombres de cada Peer
let chatHistory = [];   // Historial de mensajes descentralizado
let mediaRecorder = null;
let audioChunks = [];
let recordingTimerInterval = null;
let isRecording = false;
let pendingCall = null;         // Para guardar la llamada entrante mientras se acepta

// Lógica de URL para invitaciones automáticas
const urlParams = new URLSearchParams(window.location.search);
const roomToJoin = urlParams.get('room');

// Elementos del DOM - Pantallas
const screenLogin = document.getElementById('login-screen');
const screenConnection = document.getElementById('connection-screen');
const screenChat = document.getElementById('chat-screen');

// Elementos - Login
const usernameInput = document.getElementById('username-input');
const btnLogin = document.getElementById('btn-login');

// Elementos - Conexión
const btnCreate = document.getElementById('btn-create');
const myIdContainer = document.getElementById('my-id-container');
const myIdDisplay = document.getElementById('my-id');
const btnCopy = document.getElementById('btn-copy');
const btnShareLink = document.getElementById('btn-share-link');
const btnShowQr = document.getElementById('btn-show-qr');
const qrContainer = document.getElementById('qr-container');
const qrImage = document.getElementById('qr-image');
const joinIdInput = document.getElementById('join-id');
const btnJoin = document.getElementById('btn-join');

// Elementos - Chat
const connectedPeerIdDisplay = document.getElementById('connected-peer-id');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const btnSend = document.getElementById('btn-send');
const btnDisconnect = document.getElementById('btn-disconnect');
const btnAttach = document.getElementById('btn-attach');
const btnInvite = document.getElementById('btn-invite');
const fileInput = document.getElementById('file-input');
const btnMenuToggle = document.getElementById('btn-menu-toggle');
const headerMenu = document.getElementById('header-menu');

// Elementos - Lightbox
const lightbox = document.getElementById('media-lightbox');
const lightboxMedia = document.getElementById('lightbox-media-container');
const lightboxDownload = document.getElementById('lightbox-download');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxOverlay = document.querySelector('.lightbox-overlay');
const lightboxFilename = document.getElementById('lightbox-filename');

// Elementos - Video
const btnCall = document.getElementById('btn-call');
const btnEndCall = document.getElementById('btn-end-call');
const btnSwitchCamera = document.getElementById('btn-switch-camera');
const mediaContainer = document.getElementById('media-container');
const videoGrid = document.getElementById('video-grid');

// Nuevos Elementos - Llamadas y Audio
const incomingCallOverlay = document.getElementById('incoming-call-overlay');
const callerNameDisplay = document.getElementById('caller-name');
const btnAcceptCall = document.getElementById('btn-accept-call');
const btnDeclineCall = document.getElementById('btn-decline-call');
const btnRecord = document.getElementById('btn-record');
const recordingStatus = document.getElementById('recording-status');
const recordingTimer = document.getElementById('recording-timer');

/**
 * =======================
 * EVENTOS DE PEERJS
 * =======================
 */

peer.on('open', (id) => {
    myId = id;
    console.log('Mi ID de PeerJS es: ' + id);
});

// Cuando ALGUIEN se conecta a NOSOTROS
peer.on('connection', (connection) => {
    setupConnection(connection, true);
});

// Cuando alguien llama (Videollamada MESH)
peer.on('call', (call) => {
    if (!localStream) {
        // En lugar de confirm(), mostramos el nuevo overlay
        pendingCall = call;
        const callerId = call.peer;
        const callerName = peerUsernames[callerId] || "Alguien";
        callerNameDisplay.textContent = `${callerName} quiere iniciar una videollamada`;
        incomingCallOverlay.classList.remove('hidden');
    } else {
        // Si ya tenemos stream local activo, contestamos automáticamente
        call.answer(localStream);
        setupCallEvents(call);
    }
});

// Lógica de los botones del Overlay de Llamada
btnAcceptCall.addEventListener('click', async () => {
    incomingCallOverlay.classList.add('hidden');
    if (pendingCall) {
        try {
            // Primero intentamos obtener permiso para que aparezcan las cámaras en la lista
            const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
            startLocalStream(stream); // Esta función no estaba definida explícitamente, pero el código la usaba. La definiremos mejor.
            pendingCall.answer(stream);
            setupCallEvents(pendingCall);
            pendingCall = null;
            // Actualizar lista de dispositivos después de obtener permiso
            updateDeviceList();
        } catch (err) {
            console.error(err);
            alert("No se pudo acceder a la cámara o micrófono.");
            pendingCall.close();
            pendingCall = null;
        }
    }
});

btnDeclineCall.addEventListener('click', () => {
    incomingCallOverlay.classList.add('hidden');
    if (pendingCall) {
        pendingCall.close();
        pendingCall = null;
    }
});

function startLocalStream(stream) {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    localStream = stream;
    mediaContainer.classList.remove('hidden');
    
    // Actualizar video local en la UI
    const localVideo = document.getElementById('video-local');
    if (localVideo) {
        localVideo.srcObject = stream;
    } else {
        addVideoElement('local', stream, 'Tú');
    }
}

peer.on('error', (err) => {
    console.error('Error de Peer:', err);
    if (err.type === 'disconnected' || err.type === 'network' || err.type === 'server-error') {
        console.warn(`Error de red (${err.type}). Intentando reconectar...`);
        setTimeout(() => {
            if (peer.disconnected) peer.reconnect();
        }, 3000);
    } else {
        alert('Error: ' + err.message);
    }
});

// Evento cuando se pierde la conexión con el servidor de señalización (pero el ID sigue siendo válido)
peer.on('disconnected', () => {
    console.warn('Desconectado del servidor de señalización. Intentando reconectar...');
    peer.reconnect();
});

/**
 * =======================
 * INTERFAZ: LOGIN
 * =======================
 */

function proceedLogin() {
    const name = usernameInput.value.trim();
    if (name) {
        myUsername = name;
        screenLogin.classList.remove('active');
        screenConnection.classList.add('active');
        
        // Autoconectar si venimos de un enlace
        if (roomToJoin) {
            joinIdInput.value = roomToJoin;
            btnJoin.click();
        }
    } else {
        alert("Por favor, ingresa un nombre o alias.");
    }
}

btnLogin.addEventListener('click', proceedLogin);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') proceedLogin();
});

/**
 * =======================
 * INTERFAZ: CONEXIÓN
 * =======================
 */

btnCreate.addEventListener('click', () => {
    btnCreate.classList.add('hidden');
    myIdContainer.classList.remove('hidden');
    
    if (myId) {
        myIdDisplay.textContent = myId;
    } else {
        const checkId = setInterval(() => {
            if(myId) {
                myIdDisplay.textContent = myId;
                clearInterval(checkId);
            }
        }, 100);
    }
});

btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(myId);
    const icon = btnCopy.textContent;
    btnCopy.textContent = '✅';
    setTimeout(() => btnCopy.textContent = icon, 2000);
});

if (btnShareLink) {
    btnShareLink.addEventListener('click', async () => {
        const baseUrl = window.location.href.split('?')[0]; 
        const inviteLink = `${baseUrl}?room=${myId}`;
        
        if (navigator.share) {
            try {
                // Abre el panel nativo de compartir en celular (WhatsApp, etc.) sin minimizar totalmente el navegador
                await navigator.share({
                    title: 'Únete a mi sala P2P',
                    text: 'Haz clic en este enlace para entrar a nuestro chat privado en Nexus P2P:',
                    url: inviteLink
                });
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            navigator.clipboard.writeText(inviteLink);
            alert('¡Enlace de invitación copiado! Pégalo en tu chat para invitar a tus amigos.');
        }
    });
}

if (btnShowQr) {
    btnShowQr.addEventListener('click', () => {
        if (qrContainer.classList.contains('hidden')) {
            const baseUrl = window.location.href.split('?')[0]; 
            const inviteLink = `${baseUrl}?room=${myId}`;
            qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(inviteLink)}&bgcolor=255-255-255`;
            qrContainer.classList.remove('hidden');
            btnShowQr.textContent = '📱 Ocultar QR';
        } else {
            qrContainer.classList.add('hidden');
            btnShowQr.textContent = '📱 Código QR';
        }
    });
}

btnJoin.addEventListener('click', () => {
    const targetId = joinIdInput.value.trim();
    if (!targetId) return alert('Por favor, ingresa el código de la sala.');
    if (targetId === myId) return alert('No puedes conectarte a ti mismo.');
    if (connections[targetId]) return alert('Ya estás conectado a esta sala.');
    
    btnJoin.disabled = true;
    btnJoin.innerHTML = 'Conectando... <span class="pulse-dot" style="display:inline-block; margin-left:5px"></span>';

    const connection = peer.connect(targetId, { reliable: true, metadata: { isDirectJoin: true } });
    setupConnection(connection, false);
});

/**
 * =======================
 * TOPOLOGÍA MESH (RED P2P GRUPAL)
 * =======================
 */

function setupConnection(conn, isIncoming = false) {
    conn.on('open', () => {
        if (!connections[conn.peer]) {
            connections[conn.peer] = conn;
            updateRoomUI();
            
            // MESH SYNC: Le avisamos al nuevo conectado quiénes más están en la sala
            // y también nos presentamos enviando nuestro alias.
            conn.send({ type: 'profile', username: myUsername });
            
            // Sincronizar Historial de Chat
            // SOLO conectamos el historial si nos llamaron directamente con nuestro código, 
            // y tenemos la casilla de "Pasar Historial" marcada.
            const shareCb = document.getElementById('share-history-cb');
            const shouldShareHistory = shareCb ? shareCb.checked : true;
            const isDirectJoin = conn.metadata && conn.metadata.isDirectJoin;

            if (isIncoming && isDirectJoin && shouldShareHistory && chatHistory.length > 0) {
                conn.send({ type: 'history_sync', history: chatHistory });
            }

            const knownPeers = Object.keys(connections).filter(id => id !== conn.peer);
            if (knownPeers.length > 0) {
                conn.send({ type: 'mesh_sync', peers: knownPeers });
            }
        }
    });

    conn.on('data', (data) => {
        if (data.type === 'profile') {
            peerUsernames[conn.peer] = data.username;
        }
        else if (data.type === 'history_sync') {
            // El primero que nos mandé el historial se queda.
            if (chatHistory.length === 0 && data.history && data.history.length > 0) {
                data.history.forEach(msg => {
                    chatHistory.push(msg); // Lo guardamos localmente
                    addMessage(msg.content, 'received', msg.senderPseudo, true);
                });
                addMessage(`⏳ Se han recuperado ${data.history.length} mensajes previos.`, 'system');
            }
        }
        else if (data.type === 'mesh_sync') {
            // Un nodo nos notifica de la existencia de otros nodos para armar la malla
            data.peers.forEach(peerId => {
                if (peerId !== myId && !connections[peerId]) {
                    const newConn = peer.connect(peerId, { reliable: true, metadata: { isMeshSync: true } });
                    setupConnection(newConn, false);
                }
            });
        }
        else if (data.type === 'text') {
            chatHistory.push({ content: data.content, senderPseudo: data.senderPseudo });
            addMessage(data.content, 'received', data.senderPseudo);
        } 
        else if (data.type === 'file') {
            chatHistory.push({ content: `[📎 Archivo Adjunto: ${data.filename}]`, senderPseudo: data.senderPseudo });
            addFileMessage(data.file, data.filetype, data.filename, 'received', data.senderPseudo, data.isVoiceNote);
        }
    });

    conn.on('close', () => removePeer(conn.peer));
    conn.on('error', () => removePeer(conn.peer));
}

function removePeer(peerId) {
    if (connections[peerId]) {
        delete connections[peerId];
        updateRoomUI();
    }
    if (calls[peerId]) {
        calls[peerId].close();
        delete calls[peerId];
    }
    removeVideoElement(peerId);

    if (Object.keys(connections).length === 0) {
        resetToConnectionScreen();
    }
}

/**
 * =======================
 * INTERFAZ: CHAT & MENSAJES
 * =======================
 */

function updateRoomUI() {
    const count = Object.keys(connections).length;
    if (count > 0 && !screenChat.classList.contains('active')) {
        screenConnection.classList.remove('active');
        screenChat.classList.add('active');
        addMessage("🔐 Conectado a la Sala de forma segura.", "system");
        
        btnJoin.disabled = false;
        btnJoin.textContent = 'Conectarse';
    }
    connectedPeerIdDisplay.textContent = `Participantes: ${count + 1}`; // +1 por nosotros
}

function resetToConnectionScreen() {
    endAllCalls();
    Object.values(connections).forEach(c => c.close());
    connections = {};
    chatHistory = []; // Vaciamos el historial local
    
    screenChat.classList.remove('active');
    screenConnection.classList.add('active');
    chatMessages.innerHTML = '';
    
    joinIdInput.value = '';
    btnCreate.classList.remove('hidden');
    myIdContainer.classList.add('hidden');
}

btnDisconnect.addEventListener('click', resetToConnectionScreen);

btnInvite.addEventListener('click', () => {
    navigator.clipboard.writeText(myId);
    const originalText = btnInvite.innerHTML;
    btnInvite.innerHTML = '<span class="icon">✅</span> Copiado';
    setTimeout(() => {
        btnInvite.innerHTML = originalText;
        headerMenu.classList.add('hidden');
    }, 2000);
});

// Lógica del Menú Desplegable
if (btnMenuToggle) {
    btnMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        headerMenu.classList.toggle('hidden');
    });
}

// Cerrar menú al hacer clic en cualquier botón de acción (excepto el de invitar que tiene delay)
document.querySelectorAll('.menu-item-btn:not(#btn-invite)').forEach(btn => {
    btn.addEventListener('click', () => headerMenu.classList.add('hidden'));
});

// Cerrar menú al hacer clic fuera
document.addEventListener('click', (e) => {
    if (headerMenu && !headerMenu.contains(e.target) && e.target !== btnMenuToggle) {
        headerMenu.classList.add('hidden');
    }
});

// Lógica de Cierre de Lightbox
if (lightboxClose) {
    const closeLightbox = () => {
        lightbox.classList.add('hidden');
        lightboxMedia.innerHTML = '';
    };
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxOverlay.addEventListener('click', closeLightbox);
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || Object.keys(connections).length === 0) return;

    // Guardar en el historial local
    chatHistory.push({ content: text, senderPseudo: myUsername });

    // Broadcasting a toda la malla
    Object.values(connections).forEach(c => {
        c.send({ type: 'text', content: text, senderPseudo: myUsername });
    });

    addMessage(text, 'sent', 'Tú');
    messageInput.value = '';
}

btnSend.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function addMessage(text, type, senderName = '', isHistory = false) {
    const div = document.createElement('div');
    div.classList.add('message');
    if(type !== 'system') div.classList.add(type);
    
    // Si es un mensaje cargado del historial, le damos un poco de opacidad baja
    if (isHistory && type !== 'system') {
        div.style.opacity = '0.85';
    }

    if (type === 'system') {
        div.className = 'system-message';
        div.textContent = text;
    } else {
        if (type === 'received') {
            div.innerHTML = `<div style="font-size:0.75rem; opacity:0.7; margin-bottom:4px; font-weight: bold;">${senderName}</div>${text}`;
        } else {
            div.textContent = text; // sent message
        }
    }
    
    chatMessages.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * =======================
 * ENVÍO DE ARCHIVOS
 * =======================
 */

btnAttach.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || Object.keys(connections).length === 0) return;

    const blob = new Blob([file], { type: file.type });
    const messageDiv = addFileMessage(blob, file.type, file.name, 'sent', 'Tú');
    
    // UI de progreso (simplificada para MESH)
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressContainer.appendChild(progressBar);
    messageDiv.appendChild(progressContainer);

    const safeType = file.type || '';
    const fileObj = { type: 'file', file: blob, filename: file.name, filetype: safeType, senderPseudo: myUsername };
    
    // Guardamos evidencia del archivo en el historial textual (protegiendo el uso de memoria RAM)
    chatHistory.push({ content: `[📎 Archivo Adjunto: ${file.name}]`, senderPseudo: myUsername });

    // Broadcast Mesh
    Object.values(connections).forEach(c => c.send(fileObj));

    // Monitoreo del buffer (solo usando la primera conexión como proxy visual)
    setTimeout(() => {
        let dc = Object.values(connections)[0]?.dataChannel;
        if (!dc) {
            progressContainer.remove();
            return;
        }
        let initialBuffer = dc.bufferedAmount || file.size;
        const interval = setInterval(() => {
            const currentBuffer = dc.bufferedAmount;
            if (currentBuffer === 0) {
                clearInterval(interval);
                progressBar.style.width = '100%';
                setTimeout(() => progressContainer.remove(), 1000);
            } else {
                let percent = ((initialBuffer - currentBuffer) / initialBuffer) * 100;
                progressBar.style.width = Math.max(0, Math.min(99, percent)) + '%';
            }
        }, 50);
    }, 10);

    fileInput.value = ''; 
});

function addFileMessage(fileData, type, name, sender, senderName = '', isVoiceNote = false) {
    const div = document.createElement('div');
    div.classList.add('message', sender);
    
    let senderHtml = '';
    if (sender === 'received') {
        senderHtml = `<div style="font-size:0.75rem; opacity:0.7; margin-bottom:4px; font-weight: bold;">${senderName}</div>`;
    }

    const safeType = type || '';
    let blob = fileData;
    if (!(fileData instanceof Blob)) {
        blob = new Blob([fileData], { type: safeType });
    }
    const url = URL.createObjectURL(blob);

    // Contenedor interno del archivo
    const contentDiv = document.createElement('div');
    
    if (safeType.startsWith('image/') || safeType.startsWith('video/')) {
        contentDiv.className = 'media-attachment';
        
        let mediaEl;
        if (safeType.startsWith('image/')) {
            mediaEl = document.createElement('img');
            mediaEl.src = url;
        } else {
            mediaEl = document.createElement('video');
            mediaEl.src = url;
            mediaEl.muted = true;
        }
        
        const dlBtn = document.createElement('a');
        dlBtn.href = url;
        dlBtn.download = name;
        dlBtn.className = 'media-dl-overlay';
        dlBtn.innerHTML = '⬇️';
        dlBtn.title = 'Descargar';
        dlBtn.onclick = (e) => e.stopPropagation();
        
        contentDiv.appendChild(mediaEl);
        contentDiv.appendChild(dlBtn);
        
        contentDiv.addEventListener('click', () => {
            lightboxMedia.innerHTML = '';
            let bigMedia;
            if (safeType.startsWith('image/')) {
                bigMedia = document.createElement('img');
                bigMedia.src = url;
            } else {
                bigMedia = document.createElement('video');
                bigMedia.src = url;
                bigMedia.controls = true;
                bigMedia.autoplay = true;
            }
            lightboxMedia.appendChild(bigMedia);
            lightboxDownload.href = url;
            lightboxDownload.download = name;
            lightboxFilename.textContent = name;
            lightbox.classList.remove('hidden');
        });
    } else if (safeType.startsWith('audio/')) {
        // Manejo de Audio (Música o Nota de Voz)
        contentDiv.className = 'audio-msg-container';
        const audio = document.createElement('audio');
        audio.src = url;
        audio.controls = true;
        contentDiv.appendChild(audio);

        if (!isVoiceNote) {
            // Solo añadir botón de descarga si NO es una nota de voz
            const dlLink = document.createElement('a');
            dlLink.href = url;
            dlLink.download = name;
            dlLink.className = 'file-dl-btn';
            dlLink.style.marginTop = '10px';
            dlLink.style.display = 'flex';
            dlLink.innerHTML = '⬇️ Descargar';
            contentDiv.appendChild(dlLink);
        }
    } else {
        // Archivo genérico
        const dlLink = document.createElement('div');
        dlLink.className = 'file-download';
        
        dlLink.innerHTML = `
            <div class="file-info">
                <span class="file-download-icon">📄</span>
                <span class="file-name">${name}</span>
            </div>
            <a href="${url}" download="${name}" class="file-dl-btn" title="Descargar">⬇️</a>
        `;
        
        contentDiv.appendChild(dlLink);
    }

    div.innerHTML = senderHtml;
    div.appendChild(contentDiv);
    
    chatMessages.appendChild(div);
    scrollToBottom();
    return div;
}

/**
 * =======================
 * LÓGICA DE VIDEOLLAMADAS GRID
 * =======================
 */

async function updateDeviceList() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log("Cámaras detectadas:", videoDevices);
    } catch (err) {
        console.error("Error enumerando dispositivos:", err);
    }
}

btnCall.addEventListener('click', async () => {
    if (Object.keys(connections).length === 0) return;
    if (localStream) return;

    await updateDeviceList();
    startVideoCall();
});

async function startVideoCall(deviceId = null) {
    try {
        let constraints = {
            audio: true,
            video: true
        };

        if (deviceId) {
            constraints.video = { deviceId: { exact: deviceId } };
        } else if (videoDevices.length > 0) {
            constraints.video = { deviceId: { exact: videoDevices[currentDeviceIndex].deviceId } };
        } else {
            constraints.video = { facingMode: currentFacingMode };
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        startLocalStream(stream);
        
        if (videoDevices.length === 0) {
            await updateDeviceList();
        }

        const videoTrack = stream.getVideoTracks()[0];
        Object.values(calls).forEach(call => {
            const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack).catch(e => console.error("Error reemplazando track:", e));
        });

        Object.keys(connections).forEach(peerId => {
            if (!calls[peerId]) {
                const call = peer.call(peerId, stream);
                setupCallEvents(call);
            }
        });
    } catch (err) {
        console.error(err);
        alert("No se pudo acceder a la cámara seleccionada.");
    }
}

function switchNextCamera() {
    if (videoDevices.length < 2) {
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        startVideoCall();
        return;
    }

    currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
    startVideoCall(videoDevices[currentDeviceIndex].deviceId);
}

btnSwitchCamera.addEventListener('click', () => {
    if (!localStream) return;
    switchNextCamera();
});

/**
 * =======================
 * LÓGICA DE AUDIOS (HOLD TO RECORD)
 * =======================
 */

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        isRecording = true;

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            sendAudioMessage(audioBlob);
            stream.getTracks().forEach(track => track.stop());
            isRecording = false;
        };

        mediaRecorder.start();
        btnRecord.classList.add('recording');
        recordingStatus.classList.remove('hidden');
        startRecordingTimer();
    } catch (err) {
        console.error("Error al grabar:", err);
        alert("No se pudo acceder al micrófono.");
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        btnRecord.classList.remove('recording');
        recordingStatus.classList.add('hidden');
        stopRecordingTimer();
    }
}

function startRecordingTimer() {
    let seconds = 0;
    recordingTimer.textContent = "0:00";
    recordingTimerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        recordingTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopRecordingTimer() {
    clearInterval(recordingTimerInterval);
}

function sendAudioMessage(blob) {
    if (Object.keys(connections).length === 0) return;

    const filename = `Audio_${new Date().getTime()}.webm`;
    const audioObj = { 
        type: 'file', 
        file: blob, 
        filename: filename, 
        filetype: 'audio/webm', 
        senderPseudo: myUsername,
        isVoiceNote: true // Marcamos como nota de voz
    };

    // Broadcast Mesh
    Object.values(connections).forEach(c => c.send(audioObj));
    
    // UI Local
    addFileMessage(blob, 'audio/webm', filename, 'sent', 'Tú', true);
}

// Eventos "Hold to Record"
btnRecord.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startRecording();
});

btnRecord.addEventListener('mouseup', (e) => {
    e.preventDefault();
    stopRecording();
});

btnRecord.addEventListener('mouseleave', (e) => {
    if (isRecording) stopRecording();
});

// Soporte Touch para móviles
btnRecord.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startRecording();
});

btnRecord.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopRecording();
});

function setupCallEvents(call) {
    calls[call.peer] = call;
    call.on('stream', (remoteStream) => {
        // Mostrar contenedor por si acaso la videollamada era recibida
        mediaContainer.classList.remove('hidden');
        let displayedName = peerUsernames[call.peer] || "Amigo";
        addVideoElement(call.peer, remoteStream, displayedName);
    });
    call.on('close', () => {
        removeVideoElement(call.peer);
        delete calls[call.peer];
    });
}

function addVideoElement(id, stream, labelText) {
    // Si ya existe, no duplicar (sucede con algunos eventos de WebRTC)
    if (document.getElementById('video-' + id)) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'video-wrap-' + id;
    wrapper.className = 'video-wrapper';
    
    const video = document.createElement('video');
    video.id = 'video-' + id;
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    if (id === 'local') {
        video.muted = true;
        // Aplicar efecto espejo si es la cámara frontal por defecto
        if (currentFacingMode === 'user') {
            video.classList.add('facing-user');
        }
    }
    
    const label = document.createElement('span');
    label.className = 'video-label';
    label.textContent = labelText;

    wrapper.appendChild(video);
    wrapper.appendChild(label);
    videoGrid.appendChild(wrapper);
}

function removeVideoElement(id) {
    const wrap = document.getElementById('video-wrap-' + id);
    if (wrap) wrap.remove();
}

btnEndCall.addEventListener('click', () => {
    endAllCalls();
});

function endAllCalls() {
    // Cerramos todas las conexiones de medios
    Object.values(calls).forEach(call => call.close());
    calls = {};
    
    // Apagamos cámara local
    if(localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Limpiamos la UI
    videoGrid.innerHTML = '';
    mediaContainer.classList.add('hidden');
}
