import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock } from 'lucide-react';

const ContentCalendar = () => {
    const [briefs, setBriefs] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/content/briefs`);
                setBriefs(Array.isArray(res.data) ? res.data : []);
            } catch (err) { }
        };
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Content Calendar</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Upcoming publishing schedule managed by Agent 02 Writer.</p>
            </header>

            <div className="card" style={{ padding: 0 }}>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={14}/> Topic</div></th>
                                <th>Status</th>
                                <th><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={14}/> Queue Date</div></th>
                            </tr>
                        </thead>
                        <tbody>
                            {briefs.map((b, i) => (
                                <tr key={b.id || i}>
                                    <td style={{ fontWeight: 600, fontSize: '0.95rem' }}>{b.title}</td>
                                    <td>
                                        <span className={`badge ${b.status.toLowerCase()}`}>{b.status}</span>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        {new Date(b.created_at).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {briefs.length === 0 && (
                                <tr>
                                    <td colSpan="3" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                        No items currently in queue.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
export default ContentCalendar;
