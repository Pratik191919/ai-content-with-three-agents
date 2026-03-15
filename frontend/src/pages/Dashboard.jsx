import React, { useState, useEffect } from 'react';
import { Target, CheckCircle, TrendingUp, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/content';

const Dashboard = () => {
    const [stats, setStats] = useState([
        { title: 'Briefs Generated', value: '—', color: 'var(--accent-purple)' },
        { title: 'Posts Published',  value: '—', color: 'var(--accent-green)'  },
        { title: 'Avg SEO Score',    value: '—', color: 'var(--accent-blue)'   },
        { title: 'Rewrite Queue',    value: '—', color: 'var(--accent-red)'    },
    ]);
    const [recentPosts, setRecentPosts] = useState([]);
    const [recentBriefs, setRecentBriefs] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [briefsRes, postsRes, perfRes] = await Promise.all([
                    axios.get(`${API_BASE}/briefs`),
                    axios.get(`${API_BASE}/posts`),
                    axios.get(`${API_BASE}/performance`)
                ]);

                const briefs = briefsRes.data || [];
                const posts  = postsRes.data  || [];
                const perfs  = perfRes.data   || [];

                const avgSeo = posts.length > 0
                    ? Math.round(posts.reduce((acc, p) => acc + (p.seo_score || 0), 0) / posts.length)
                    : 0;
                const rewrites = perfs.filter(p => p.score < 60).length;

                setStats([
                    { title: 'Briefs Generated', value: briefs.length, color: 'var(--accent-purple)' },
                    { title: 'Posts Published',  value: posts.length,  color: 'var(--accent-green)'  },
                    { title: 'Avg SEO Score',    value: `${avgSeo}%`,  color: 'var(--accent-blue)'   },
                    { title: 'Rewrite Queue',    value: rewrites,      color: 'var(--accent-red)'    },
                ]);

                setRecentPosts(posts.slice(0, 6));
                setRecentBriefs(briefs.slice(0, 4));
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <h1 style={{ marginBottom: '1.75rem', fontSize: '1.6rem', fontWeight: 700 }}>
                Overview Pipeline
            </h1>

            {/* Stat Cards */}
            <div className="grid-cards">
                {stats.map((s, i) => (
                    <div key={i} className="card" style={{ borderTop: `3px solid ${s.color}` }}>
                        <div className="stat-title">{s.title}</div>
                        <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Published Posts Grid with Thumbnails */}
            <div className="card" style={{ marginBottom: '1.75rem' }}>
                <h2 style={{ marginBottom: '1.25rem', fontSize: '1.15rem' }}>
                    🖼️ Recent AI-Published Posts
                </h2>

                {recentPosts.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                        No posts published yet. Backend agents will generate the first post shortly!
                    </p>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: '1rem'
                    }}>
                        {recentPosts.map((post, i) => (
                            <div key={post.id || i} style={{
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '10px',
                                border: '1px solid var(--border-color)',
                                overflow: 'hidden',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; }}>
                                {/* Thumbnail */}
                                <div style={{ position: 'relative', height: '160px', background: 'var(--bg-card)', overflow: 'hidden' }}>
                                    {post.featured_image_url ? (
                                        <img
                                            src={post.featured_image_url}
                                            alt={post.title}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={e => { e.target.style.display='none'; }}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                                            🤖
                                        </div>
                                    )}
                                    {/* SEO badge */}
                                    {post.seo_score && (
                                        <span style={{
                                            position: 'absolute', top: '8px', right: '8px',
                                            background: 'rgba(16,185,129,0.9)', color: '#fff',
                                            fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
                                            borderRadius: '9999px'
                                        }}>
                                            SEO {post.seo_score}%
                                        </span>
                                    )}
                                </div>

                                {/* Card body */}
                                <div style={{ padding: '0.875rem' }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', lineHeight: '1.4',
                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {post.title}
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {post.live_url && post.live_url.startsWith('http') && (
                                            <a href={post.live_url} target="_blank" rel="noopener noreferrer"
                                                style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
                                                <ExternalLink size={12} /> Live Post
                                            </a>
                                        )}
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                                            {new Date(post.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recent Briefs Table */}
            <div className="card">
                <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>📋 Recent Briefs</h2>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Keyword</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentBriefs.map((b, i) => (
                                <tr key={b.id || i}>
                                    <td style={{ fontWeight: 500 }}>{b.title}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{b.target_keyword}</td>
                                    <td>
                                        <span className={`badge ${(b.status || '').toLowerCase()}`}>{b.status}</span>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{new Date(b.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                            {recentBriefs.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No briefs found. Agents will generate soon!
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

export default Dashboard;
