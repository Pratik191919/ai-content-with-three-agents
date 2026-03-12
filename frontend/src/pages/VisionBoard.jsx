import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { io } from 'socket.io-client';

const VisionBoard = () => {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        // Connect to WebSocket Server
        const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:8000');

        socket.on('connect', () => {
            console.log('Connected to Agent Vision Board Stream');
        });

        socket.on('agent_event', (data) => {
            console.log('Got live event', data);

            let agent = 'System';
            let message = 'Unknown event';
            if (data.event === 'content_briefs_ready') {
                agent = 'Agent 01';
                message = `New brief generated and sent to Writer Queue (Brief ID: ${data.brief_id})`;
            } else if (data.event === 'post_published') {
                agent = 'Agent 02';
                message = `Successfully generated & published CMS Post (Post ID: ${data.post_id})`;
            } else if (data.event === 'audit_complete') {
                agent = 'Agent 03';
                message = `Audit complete. Reason: ${data.reason}`;
            }

            const evt = {
                id: Date.now() + Math.random(),
                type: data.event,
                agent,
                message,
                time: new Date().toLocaleTimeString()
            };

            setEvents(prev => [evt, ...prev].slice(0, 15)); // Keep last 15
        });

        return () => socket.disconnect();
    }, []);

    return (
        <div className="vision-board">
            <h1 style={{ marginBottom: '2rem', fontSize: '1.75rem', fontWeight: 700 }}>Vision Board (Live Agent Stream)</h1>

            <div className="card" style={{ maxWidth: '800px' }}>
                <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity className="text-blue-500" />
                    Live Agent Activity
                </h2>

                {events.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)' }}>Waiting for agents to broadcast events... Try running Agent 01!</p>
                )}

                <div className="event-feed">
                    {events.map((ev) => (
                        <div key={ev.id} className="event-item">
                            <div style={{ flex: 1 }}>
                                <strong style={{ color: 'var(--accent-blue)', display: 'block', marginBottom: '0.25rem' }}>{ev.agent}</strong>
                                <span>{ev.message}</span>
                            </div>
                            <div className="event-time">{ev.time}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default VisionBoard;
