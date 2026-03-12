import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Analytics = () => {
    const [posts, setPosts] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/content/posts`);
                setPosts(res.data);
            } catch (err) {
                console.error('Failed to fetch posts for analytics', err);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="card">
            <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Performance Analytics</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>GSC and ranking data retrieved by Agent 03 Content Auditor.</p>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Post Title</th>
                            <th>SEO Score</th>
                            <th>Status</th>
                            <th>Live URL</th>
                            <th>Published At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.map((p, i) => (
                            <tr key={p.id || i}>
                                <td style={{ fontWeight: 500 }}>{p.title}</td>
                                <td style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{p.seo_score}%</td>
                                <td>
                                    <span className={`badge ${p.status.toLowerCase()}`}>{p.status}</span>
                                </td>
                                <td style={{ color: 'var(--text-secondary)' }}>
                                    <a href={p.live_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-purple)' }}>{p.live_url}</a>
                                </td>
                                <td style={{ color: 'var(--text-secondary)' }}>{new Date(p.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                        {posts.length === 0 && (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No published posts found yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default Analytics;
