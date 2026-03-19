import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Clock, Hash, Tag } from 'lucide-react';

const Briefs = () => {
    const [briefs, setBriefs] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/content/briefs`);
                setBriefs(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                setBriefs([]);
                console.error('Failed to fetch briefs', err);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Content Briefs</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Strategic outlines generated from real-time trends.</p>
            </header>

            <div className="card" style={{ padding: 0 }}>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={14}/> Title</div></th>
                                <th><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Tag size={14}/> Category</div></th>
                                <th><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Hash size={14}/> Keyword</div></th>
                                <th>Status</th>
                                <th><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={14}/> Date</div></th>
                            </tr>
                        </thead>
                        <tbody>
                            {briefs.map((b, i) => (
                                <tr key={b.id || i}>
                                    <td style={{ fontWeight: 600, fontSize: '0.95rem', maxWidth: '300px' }}>{b.title}</td>
                                    <td>
                                        <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-purple)' }}>
                                            {b.category || 'General'}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{b.target_keyword}</td>
                                    <td>
                                        <span className={`badge ${b.status.toLowerCase()}`}>{b.status}</span>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        {new Date(b.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                            {briefs.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                        No briefs found. Agent 01 is scanning for trends...
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
export default Briefs;
