import React, { useState, useEffect } from 'react';
import { Activity, Radio, Cpu, Send, ShieldCheck } from 'lucide-react';
import { io } from 'socket.io-client';

const VisionBoard = () => {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:8000');

        socket.on('agent_event', (data) => {
            let agent = 'System';
            let message = 'Unknown event';
            let icon = Radio;
            let color = 'var(--accent-blue)';

            if (data.event === 'content_briefs_ready') {
                agent = 'Strategist (Agent 01)';
                message = `Strategized new content: ID ${data.brief_id}`;
                icon = Cpu;
                color = 'var(--accent-purple)';
            } else if (data.event === 'post_published') {
                agent = 'Writer (Agent 02)';
                message = `Published article: ID ${data.post_id}`;
                icon = Send;
                color = 'var(--accent-green)';
            } else if (data.event === 'audit_complete') {
                agent = 'Auditor (Agent 03)';
                message = `Audit result: ${data.reason}`;
                icon = ShieldCheck;
                color = 'var(--accent-red)';
            }

            const evt = {
                id: Date.now() + Math.random(),
                agent,
                message,
                icon,
                color,
                time: new Date().toLocaleTimeString()
            };

            setEvents(prev => [evt, ...prev].slice(0, 12));
        });

        return () => socket.disconnect();
    }, []);

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Activity className="text-blue" /> Vision Board
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>Real-time event stream from autonomous agents.</p>
            </header>

            <div className="card" style={{ background: 'var(--bg-app)', borderStyle: 'dashed' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>📡 Live Activity Feed</h2>
                    <span className="badge progress">WebSocket Live</span>
                </div>

                {events.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <Radio size={40} style={{ margin: '0 auto 1.5rem', opacity: 0.2 }} />
                        <p>Waiting for agent signals...</p>
                    </div>
                ) : (
                    <div className="event-feed">
                        {events.map((ev) => (
                            <div key={ev.id} className="event-item" style={{ borderLeftColor: ev.color, background: 'var(--bg-card)' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
                                    <div style={{ 
                                        width: '40px', 
                                        height: '40px', 
                                        background: ev.color + '20', 
                                        borderRadius: '10px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        color: ev.color
                                    }}>
                                        <ev.icon size={20} />
                                    </div>
                                    <div>
                                        <strong style={{ display: 'block', fontSize: '0.8rem', color: ev.color, opacity: 0.8, textTransform: 'uppercase' }}>{ev.agent}</strong>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{ev.message}</span>
                                    </div>
                                </div>
                                <div className="event-time" style={{ opacity: 0.6 }}>{ev.time}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
export default VisionBoard;
