import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ContentCalendar = () => {
    const [briefs, setBriefs] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/content/briefs`);
                setBriefs(res.data);
            } catch (err) { }
        };
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="card">
            <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Publishing Calendar</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Upcoming posts managed by Agent 02 Blog Writer.</p>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Added to Queue</th>
                        </tr>
                    </thead>
                    <tbody>
                        {briefs.map((b, i) => (
                            <tr key={b.id || i}>
                                <td style={{ fontWeight: 500 }}>{b.title}</td>
                                <td>
                                    <span className={`badge ${b.status.toLowerCase()}`}>{b.status}</span>
                                </td>
                                <td style={{ color: 'var(--text-secondary)' }}>{new Date(b.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                        {briefs.length === 0 && (
                            <tr>
                                <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No queued items.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default ContentCalendar;
