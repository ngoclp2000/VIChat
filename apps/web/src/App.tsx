import { useEffect, useMemo, useState } from 'react';
import ChatKit from '@vichat/sdk';
import type { ConversationDescriptor, MessagePayload } from '@vichat/shared';
import './App.css';

interface MessageForm {
  text: string;
}

function createMockConversation(): ConversationDescriptor {
  return {
    id: 'conv-demo',
    type: 'dm',
    tenantId: 'tenant-demo',
    members: ['user:demo']
  };
}

export default function App() {
  const [chat, setChat] = useState<ChatKit>();
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [status, setStatus] = useState('disconnected');
  const [form, setForm] = useState<MessageForm>({ text: '' });

  const conversation = useMemo(createMockConversation, []);

  useEffect(() => {
    async function bootstrap() {
      const instance = await ChatKit.init({
        tenantId: 'tenant-demo',
        clientId: 'demo-app',
        token: 'demo-token',
        device: {
          id: 'web-demo-device',
          platform: 'web'
        },
        realtimeUrl: 'ws://localhost:4000/realtime'
      });

      instance.on('state', setStatus);
      instance.on('message', (message) => {
        setMessages((prev) => [...prev, message]);
      });

      const handle = await instance.conversationsOpen(conversation);
      handle.on('message', (message) => {
        setMessages((prev) => [...prev, message]);
      });

      setChat(instance);
    }

    void bootstrap();
  }, [conversation]);

  const sendMessage = async () => {
    if (!chat || !form.text.trim()) return;
    const message = await chat.sendText(conversation, form.text);
    setMessages((prev) => [...prev, message]);
    setForm({ text: '' });
  };

  return (
    <div className="app">
      <header>
        <h1>VIChat Reference App</h1>
        <p>Realtime status: {status}</p>
      </header>
      <main>
        <section className="messages">
          {messages.map((message) => (
            <article key={message.id} className="message">
              <span className="author">{message.senderId}</span>
              <p>{message.body.ciphertext}</p>
            </article>
          ))}
        </section>
        <section className="composer">
          <textarea
            placeholder="Nhập tin nhắn E2EE..."
            value={form.text}
            onChange={(event) => setForm({ text: event.target.value })}
          />
          <button type="button" onClick={sendMessage}>
            Gửi
          </button>
        </section>
      </main>
    </div>
  );
}
