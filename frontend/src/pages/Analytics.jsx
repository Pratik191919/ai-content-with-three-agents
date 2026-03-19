import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, ExternalLink, Calendar, Search } from 'lucide-react';

const Analytics = () => {
    const [posts, setPosts] = useState([]);
    const [search, setSearch] = useState('');

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

    const filtered = posts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

    const getPreviewUrl = (url) => {
        if (!url) return '#';
        return url.replace('http://localhost:5173', window.location.origin);
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Performance Analytics</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Detailed auditing and GSC ranking data.</p>
                </div>
                <div style={{ position: 'relative', width: '300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                    <input 
                      type="text" 
                      placeholder="Search content..." 
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '10px 10px 10px 40px', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border-color)', 
                        background: 'var(--bg-card)', 
                        color: 'var(--text-primary)' 
                      }} 
                    />
                </div>
            </header>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Post Title</th>
                                <th>Category</th>
                                <th style={{ textAlign: 'center' }}>SEO Score</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Action</th>
                                <th>Published At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p, i) => (
                                <tr key={p.id || i}>
                                    <td style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.title}</td>
                                    <td><span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>{p.category || 'General'}</span></td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontWeight: 800, color: 'var(--accent-blue)' }}>{p.seo_score}%</span>
                                            <div style={{ width: '40px', height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '2px' }}>
                                                <div style={{ width: `${p.seo_score}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: '2px' }} />
                                            </div>
                                        </div>
                                    </td>
                                    <td><span className={`badge ${p.status.toLowerCase()}`}>{p.status}</span></td>
                                    <td style={{ textAlign: 'center' }}>
                                        <a 
                                            href={getPreviewUrl(p.live_url)} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="nav-item"
                                            style={{ 
                                                padding: '0.4rem 1rem', 
                                                fontSize: '0.75rem', 
                                                border: '1px solid var(--accent-blue)', 
                                                color: 'var(--accent-blue)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}
                                        >
                                            <Eye size={14} /> Preview
                                        </a>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
export default Analytics;
