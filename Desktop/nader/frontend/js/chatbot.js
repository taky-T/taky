(function () {
    // 1. Create and inject CSS
    const css = `
        #ai-chatbot-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            font-family: 'Tajawal', sans-serif;
            direction: rtl;
        }

        #ai-chat-toggle {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1, #ec4899);
            box-shadow: 0 5px 20px rgba(99, 102, 241, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: 0.3s;
            color: white;
            font-size: 1.8rem;
        }

        #ai-chat-toggle:hover {
            transform: scale(1.1) rotate(5deg);
        }

        #ai-chat-window {
            position: absolute;
            bottom: 80px;
            right: 0;
            width: 350px;
            height: 500px;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            display: none;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
            animation: fadeInChat 0.3s ease-out;
        }

        @keyframes fadeInChat {
            from { opacity: 0; transform: translateY(20px) scale(0.9); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .chat-header {
            padding: 15px 20px;
            background: linear-gradient(90deg, #6366f1, #ec4899);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .chat-header h3 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 900;
        }

        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .message {
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 18px;
            font-size: 0.95rem;
            line-height: 1.5;
            word-wrap: break-word;
        }

        .message-ai {
            align-self: flex-start;
            background: rgba(255, 255, 255, 0.1);
            color: #f8fafc;
            border-bottom-right-radius: 4px;
        }

        .message-user {
            align-self: flex-end;
            background: #6366f1;
            color: white;
            border-bottom-left-radius: 4px;
        }

        .chat-input-area {
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            gap: 10px;
        }

        #chat-input {
            flex: 1;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 10px 15px;
            color: white;
            font-family: inherit;
            outline: none;
        }

        #chat-send {
            background: #6366f1;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 10px;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: 0.3s;
        }

        #chat-send:hover {
            background: #ec4899;
        }

        .typing-indicator {
            font-size: 0.8rem;
            color: #94a3b8;
            margin-bottom: 5px;
            display: none;
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.innerText = css;
    document.head.appendChild(styleSheet);

    // 2. Create and inject HTML
    const container = document.createElement('div');
    container.id = 'ai-chatbot-container';
    container.innerHTML = `
        <div id="ai-chat-window">
            <div class="chat-header">
                <h3>مساعد NBS-AI</h3>
                <span id="close-chat" style="cursor:pointer; font-size:1.2rem;">&times;</span>
            </div>
            <div class="chat-messages" id="chat-messages">
                <div class="message message-ai">أهلاً بك! أنا مساعد NBS-AI. كيف يمكنني مساعدتك اليوم؟</div>
            </div>
            <div class="typing-indicator" id="typing-indicator" style="padding: 0 20px;">AI يكتب...</div>
            <div class="chat-input-area">
                <input type="text" id="chat-input" placeholder="اكتب سؤالك هنا...">
                <button id="chat-send">➤</button>
            </div>
        </div>
        <div id="ai-chat-toggle">💬</div>
    `;
    document.body.appendChild(container);

    // 3. Chat Logic
    const toggle = document.getElementById('ai-chat-toggle');
    const windowEl = document.getElementById('ai-chat-window');
    const closeBtn = document.getElementById('close-chat');
    const sendBtn = document.getElementById('chat-send');
    const inputEl = document.getElementById('chat-input');
    const messagesEl = document.getElementById('chat-messages');
    const typingEl = document.getElementById('typing-indicator');

    let chatHistory = [];

    toggle.onclick = () => {
        const isVisible = windowEl.style.display === 'flex';
        windowEl.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) inputEl.focus();
    };

    closeBtn.onclick = () => {
        windowEl.style.display = 'none';
    };

    async function sendMessage() {
        const text = inputEl.value.trim();
        if (!text) return;

        // User message
        addMessage(text, 'user');
        inputEl.value = '';

        // Show typing
        typingEl.style.display = 'block';
        messagesEl.scrollTop = messagesEl.scrollHeight;

        try {
            const res = await apiPost('/api/ai/chat', {
                message: text,
                history: chatHistory
            });

            const data = await res.json();
            typingEl.style.display = 'none';

            if (data.reply) {
                addMessage(data.reply, 'ai');
                chatHistory.push({ role: 'user', content: text });
                chatHistory.push({ role: 'assistant', content: data.reply });
            } else {
                addMessage('عذراً، حدث خطأ في النظام.', 'ai');
            }
        } catch (err) {
            typingEl.style.display = 'none';
            addMessage('لا يمكن الاتصال بالخادم الآن.', 'ai');
            console.error(err);
        }
    }

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message message-${sender}`;
        msgDiv.innerText = text;
        messagesEl.appendChild(msgDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    sendBtn.onclick = sendMessage;
    inputEl.onkeypress = (e) => {
        if (e.key === 'Enter') sendMessage();
    };

})();
