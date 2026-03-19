import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { Eye, ExternalLink } from 'lucide-react';

const Analytics = () => {
    const [posts, setPosts] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/content/posts`);
                setPosts(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                setPosts([]);
                console.error('Failed to fetch posts for analytics', err);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const getPreviewUrl = (url) => {
        if (!url) return '#';
        // Ensure preview links point to the current frontend domain
        return url.replace('http://localhost:5173', window.location.origin);
    };

    return (
        <div className="card">
            <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Performance Analytics</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>GSC and ranking data retrieved by Agent 03 Content Auditor.</p>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Post Title</th>
                            <th>Category</th>
                            <th>SEO Score</th>
                            <th>Status</th>
                            <th>Actions</th>
                            <th>Published At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.map((p, i) => (
                            <tr key={p.id || i}>
                                <td style={{ fontWeight: 500 }}>{p.title}</td>
                                <td>
                                    <span className="badge" style={{ fontSize: '0.65rem' }}>{p.category || 'General'}</span>
                                </td>
                                <td style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{p.seo_score}%</td>
                                <td>
                                    <span className={`badge ${p.status.toLowerCase()}`}>{p.status}</span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <a 
                                            href={getPreviewUrl(p.live_url)} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="nav-item"
                                            style={{ 
                                                padding: '0.4rem 0.8rem', 
                                                fontSize: '0.75rem', 
                                                background: 'rgba(59, 130, 246, 0.1)', 
                                                color: 'var(--accent-blue)',
                                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                                textDecoration: 'none',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}
                                        >
                                            <Eye size={14} /> Preview
                                        </a>
                                    </div>
                                </td>
                                <td style={{ color: 'var(--text-secondary)' }}>{new Date(p.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                        {posts.length === 0 && (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No published posts found yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default Analytics;
