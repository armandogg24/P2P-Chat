# 🌐 Nexus P2P - Chat Seguro & Descentralizado

![Nexus P2P App](https://img.shields.io/badge/Status-Active-success) ![License](https://img.shields.io/badge/License-MIT-blue) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

**Nexus P2P** es una aplicación de mensajería y videollamadas grupales **100% de Código Abierto (Full Open Source)**, construida completamente sobre tecnologías web estándar. Funciona directamente en el navegador sin necesidad de servidores intermediarios (backend), garantizando la privacidad absoluta mediante conexiones Peer-to-Peer (P2P).

Todo el tráfico de datos, audio, y video está protegido por el cifrado nativo de WebRTC.

## ✨ Características Principales

*   **100% Descentralizado:** Arquitectura de red en malla (Mesh), donde los clientes se comunican directamente. No hay base de datos ni servidor de medios central.
*   **Mensajería Privada y Segura:** Intercambio de mensajes de texto encriptados de extremo a extremo gracias a WebRTC.
*   **Videollamadas Grupales:** Sistema de videoconferencias nativo sin límites artificiales (restringido únicamente por el ancho de banda y la potencia de cada cliente).
*   **Intercambio de Archivos:** Comparte imágenes, videos y documentos de cualquier tamaño de manera directa. Los datos nunca tocan un servidor de terceros.
*   **Sincronización de Historial:** Los nuevos participantes reciben el contexto del chat de forma descentralizada al unirse a la sala.
*   **Salas Privadas por Código:** Funciona mediante un código de invitación seguro y efímero que actúa como llave de entrada.
*   **Topología Mesh Automática:** Cuando un nuevo usuario entra con tu código, su navegador negocia la conexión automáticamente con el resto de participantes de la sala.

## 🚀 Tecnologías Utilizadas

*   **HTML5 & CSS3 Vanilla:** Diseño "Glassmorphism" moderno, responsivo y dinámico, sin frameworks pesados.
*   **JavaScript (ES6):** Toda la lógica de negocio y gestión de estados de la interfaz.
*   **WebRTC:** Protocolo subyacente de comunicación en tiempo real para transmisión de datos y flujos multimedia.
*   **PeerJS** (`v1.5.2`): Librería puente para facilitar el descubrimiento y la señalización WebRTC. (Utilizando servidores STUN gratuitos de Google para resolución de NAT).

## 🛠️ Cómo Usar / Instalación Local

Dado que *Nexus P2P* no requiere un backend, puedes ejecutarlo estáticamente en tu navegador en segundos.

1.  **Clona este repositorio:**
    ```bash
    git clone https://github.com/armandogg24/Nexus-P2P.git
    ```
2.  **Abre el proyecto:**
    Navega a la carpeta generada:
    ```bash
    cd Nexus-P2P
    ```
3.  **Ejecuta la app:**
    Simplemente abre el archivo `index.html` en cualquier navegador moderno (Chrome, Firefox, Edge, Safari) o sirve los archivos con herramientas como Live Server (VS Code).
    ```bash
    # Alternativamente, si usas Node.js, puedes usar http-server:
    npx http-server .
    ```

## 🤝 Contribuciones (Full Open Source)

¡Este proyecto está abierto para toda la comunidad! 

La filosofía de **Nexus P2P** es crear una herramienta de comunicación libre de telemetría y recolección de datos corporativos. Si quieres mejorar el proyecto:

1. Realiza un **Fork** al repositorio.
2. Crea tu rama para la nueva funcionalidad (`git checkout -b feature/NuevaCaracteristica`).
3. Haz **Commit** a tus cambios (`git commit -m 'Añade una nueva característica'`).
4. Haz **Push** a la rama (`git push origin feature/NuevaCaracteristica`).
5. Abre un **Pull Request** para revisión.

### Ideas para aportar
*   Implementar notificaciones del navegador (Desktop Notifications).
*   Añadir botones para silenciar micrófono / apagar cámara independientemente.
*   Mejorar los indicadores de progreso para subidas de archivos masivos.
*   Soporte para compartir pantalla (Screen Sharing).
*   Indicadores de "Escribiendo...".

## 🛡️ Privacidad & Seguridad

Al ser una aplicación de comunicación P2P pura, la seguridad de **Nexus P2P** radica en que:
- Las direcciones IP se resuelven a través de los servidores STUN de Google, pero el tráfico subsiguiente es directo (peer-to-peer).
- No existe persistencia de los mensajes fuera de la memoria RAM del navegador. Al recargar o abandonar la página de todos los miembros, el historial se esfuma permanentemente.
- Todo intercambio a través de `RTCDataChannel` está cifrado por defecto (DTLS/SRTP).

---
*Construido con ❤️ por la comunidad Open Source.*
